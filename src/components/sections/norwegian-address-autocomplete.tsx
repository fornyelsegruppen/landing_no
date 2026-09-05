"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type NorwegianAddressSelection = {
  provider: "kartverket-address-rest-v1";
  providerAddressId: string;
  canonicalLabel: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
};

type SearchState = "idle" | "loading" | "results" | "empty" | "error";

type AddressAutocompleteProps = {
  id: string;
  locale: "no" | "en";
  value: string;
  postalCode: string;
  selection: NorwegianAddressSelection | null;
  manualMode: boolean;
  onValueChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onSelectionChange: (selection: NorwegianAddressSelection | null) => void;
  onManualModeChange: (manual: boolean) => void;
};

const copy = {
  no: {
    placeholder: "Begynn å skrive gateadresse og husnummer",
    searchHint: "Skriv minst 4 tegn for å søke i Kartverkets adresseregister.",
    loading: "Søker etter adresser…",
    empty:
      "Ingen adresser funnet. Kontroller skrivemåten eller bruk manuell adresse.",
    error:
      "Adressesøket er midlertidig utilgjengelig. Du kan fortsatt skrive adressen manuelt.",
    manual: "Skriv adressen manuelt",
    manualActive:
      "Manuell adresse er valgt. Denne adressen har ikke koordinater fra Kartverket.",
    searchAgain: "Søk i adresseregisteret",
    selected: "Valgt adresse fra Kartverket",
    conflict: (selectedPostal: string, enteredPostal: string) =>
      `Den valgte adressen har postnummer ${selectedPostal}, men du skrev ${enteredPostal}. Velg hvilken opplysning som skal brukes.`,
    useSelectedPostal: "Bruk postnummeret fra valgt adresse",
    keepManual: "Behold mine opplysninger manuelt",
    results: "Adresseforslag",
  },
  en: {
    placeholder: "Start typing the street address and house number",
    searchHint:
      "Enter at least 4 characters to search Kartverket's address register.",
    loading: "Searching for addresses…",
    empty:
      "No addresses found. Check the spelling or enter the address manually.",
    error:
      "Address search is temporarily unavailable. You can still enter the address manually.",
    manual: "Enter address manually",
    manualActive:
      "Manual address is selected. This address has no coordinates from Kartverket.",
    searchAgain: "Search the address register",
    selected: "Address selected from Kartverket",
    conflict: (selectedPostal: string, enteredPostal: string) =>
      `The selected address uses postal code ${selectedPostal}, but you entered ${enteredPostal}. Choose which information to use.`,
    useSelectedPostal: "Use the selected address postal code",
    keepManual: "Keep my details as a manual address",
    results: "Address suggestions",
  },
} as const;

function isAddressSelection(
  value: unknown,
): value is NorwegianAddressSelection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.provider === "kartverket-address-rest-v1" &&
    typeof candidate.providerAddressId === "string" &&
    typeof candidate.canonicalLabel === "string" &&
    typeof candidate.streetAddress === "string" &&
    typeof candidate.postalCode === "string" &&
    typeof candidate.city === "string" &&
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude)
  );
}

export function hasAddressPostalConflict(
  selection: NorwegianAddressSelection | null,
  postalCode: string,
) {
  return Boolean(
    selection &&
    postalCode.trim() &&
    selection.postalCode.trim() !== postalCode.trim(),
  );
}

export function NorwegianAddressAutocomplete({
  id,
  locale,
  value,
  postalCode,
  selection,
  manualMode,
  onValueChange,
  onPostalCodeChange,
  onSelectionChange,
  onManualModeChange,
}: AddressAutocompleteProps) {
  const listboxId = useId();
  const statusId = useId();
  const [items, setItems] = useState<NorwegianAddressSelection[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const requestSequence = useRef(0);
  const text = copy[locale];
  const conflict = hasAddressPostalConflict(selection, postalCode);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    const query = value.trim();

    if (manualMode || (selection && value === selection.canonicalLabel)) {
      return;
    }
    if (query.length < 4 || query.length > 180) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState("loading");
      setOpen(true);
      setActiveIndex(-1);

      void fetch(`/api/address-search?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("address search unavailable");
          return (await response.json()) as { items?: unknown };
        })
        .then((payload) => {
          if (requestSequence.current !== requestId) return;
          const nextItems = Array.isArray(payload.items)
            ? payload.items.filter(isAddressSelection).slice(0, 10)
            : [];
          setItems(nextItems);
          setState(nextItems.length ? "results" : "empty");
          setOpen(true);
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            (error instanceof DOMException && error.name === "AbortError") ||
            requestSequence.current !== requestId
          ) {
            return;
          }
          setItems([]);
          setState("error");
          setOpen(true);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [manualMode, selection, value]);

  function selectAddress(candidate: NorwegianAddressSelection) {
    onValueChange(candidate.canonicalLabel);
    onSelectionChange(candidate);
    onManualModeChange(false);
    setItems([]);
    setState("idle");
    setOpen(false);
    setActiveIndex(-1);
  }

  function useManualAddress() {
    // A selected value is displayed with postal code and city for clarity.
    // Manual fallback must keep only the structured street part so the Lead
    // does not persist those components twice.
    if (selection && value === selection.canonicalLabel) {
      onValueChange(selection.streetAddress);
    }
    onSelectionChange(null);
    onManualModeChange(true);
    setItems([]);
    setState("idle");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (manualMode) return;
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? items.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      selectAddress(items[activeIndex]);
    }
  }

  const statusMessage =
    state === "loading"
      ? text.loading
      : state === "empty"
        ? text.empty
        : state === "error"
          ? text.error
          : "";

  return (
    <div className="space-y-2" data-address-autocomplete>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (selection) onSelectionChange(null);
            onValueChange(nextValue);
            const queryLength = nextValue.trim().length;
            if (queryLength < 4 || queryLength > 180) {
              setItems([]);
              setState("idle");
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (
              items.length ||
              state === "loading" ||
              state === "empty" ||
              state === "error"
            ) {
              setOpen(true);
            }
          }}
          role={manualMode ? undefined : "combobox"}
          aria-autocomplete={manualMode ? undefined : "list"}
          aria-expanded={manualMode ? undefined : open}
          aria-controls={manualMode ? undefined : listboxId}
          aria-activedescendant={
            !manualMode && open && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-describedby={statusId}
          autoComplete="street-address"
          placeholder={text.placeholder}
          maxLength={200}
        />
        {state === "loading" ? (
          <LoaderCircle
            aria-hidden="true"
            className="text-muted-foreground absolute top-3 right-3 size-5 animate-spin"
          />
        ) : !manualMode ? (
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-3 right-3 size-5"
          />
        ) : null}
      </div>

      {!manualMode && open && state === "results" ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={text.results}
          className="border-border bg-card overflow-hidden rounded-xl border shadow-xl"
        >
          {items.map((candidate, index) => (
            <button
              key={candidate.providerAddressId}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              data-address-option
              className="hover:bg-accent/10 focus-visible:bg-accent/10 flex min-h-11 w-full touch-manipulation items-start px-3 py-3 text-left text-sm outline-none aria-selected:bg-white/10"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectAddress(candidate)}
            >
              {candidate.canonicalLabel}
            </button>
          ))}
        </div>
      ) : null}

      <p
        id={statusId}
        role={state === "error" ? "alert" : "status"}
        aria-live="polite"
        className="text-muted-foreground text-xs"
      >
        {manualMode
          ? text.manualActive
          : selection
            ? `${text.selected}: ${selection.canonicalLabel}`
            : statusMessage || text.searchHint}
      </p>

      {!manualMode && !selection && state !== "loading" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={useManualAddress}
        >
          {text.manual}
        </Button>
      ) : null}

      {manualMode ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onManualModeChange(false)}
        >
          {text.searchAgain}
        </Button>
      ) : null}

      {conflict && selection ? (
        <div
          className="border-accent/40 bg-accent/10 space-y-3 rounded-xl border p-3"
          role="alert"
        >
          <p className="text-sm">
            {text.conflict(selection.postalCode, postalCode.trim())}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              onClick={() => onPostalCodeChange(selection.postalCode)}
            >
              {text.useSelectedPostal}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={useManualAddress}
            >
              {text.keepManual}
            </Button>
          </div>
        </div>
      ) : null}

      {selection && !conflict ? (
        <p className="text-accent flex items-center gap-1 text-xs font-medium">
          <Check aria-hidden="true" className="size-4" />
          {text.selected}
        </p>
      ) : null}
    </div>
  );
}
