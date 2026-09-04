"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { EnturAddressSuggestionV1 } from "@/lib/providers/entur-geocoder-v3";
import { normalizeEnturAutocompleteQueryV1 } from "@/lib/providers/entur-geocoder-v3";

const clientCache = new Map<string, EnturAddressSuggestionV1[]>();

export function resetRoofFusionAddressAutocompleteCacheForTests() {
  clientCache.clear();
}

export function AdminNextRoofFusionAddressAutocomplete({
  inputClassName,
  label,
  onMeasurementBlockedChange,
  placeholder,
}: {
  inputClassName: string;
  label: string;
  onMeasurementBlockedChange?: (blocked: boolean) => void;
  placeholder: string;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<EnturAddressSuggestionV1[]>(
    [],
  );
  const [selected, setSelected] = useState<EnturAddressSuggestionV1 | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle");
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const normalized = normalizeEnturAutocompleteQueryV1(query);
    if (normalized.length < 3 || selected?.label === query) {
      return;
    }
    const cached = clientCache.get(normalized.toLocaleLowerCase("nb-NO"));
    if (cached) {
      const cachedUpdate = window.setTimeout(() => {
        if (requestSequence.current !== sequence) return;
        setSuggestions(cached);
        setStatus(cached.length ? "ready" : "empty");
        setActiveIndex(-1);
        onMeasurementBlockedChange?.(cached.length > 0);
      }, 0);
      return () => window.clearTimeout(cachedUpdate);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus("loading");
      void fetch(
        `/api/admin/roof-fusion/address-autocomplete?q=${encodeURIComponent(normalized)}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("AUTOCOMPLETE_UNAVAILABLE");
          return (await response.json()) as {
            suggestions?: EnturAddressSuggestionV1[];
          };
        })
        .then((body) => {
          if (requestSequence.current !== sequence) return;
          const next = (body.suggestions ?? []).slice(0, 6);
          clientCache.set(normalized.toLocaleLowerCase("nb-NO"), next);
          setSuggestions(next);
          setStatus(next.length ? "ready" : "empty");
          setActiveIndex(-1);
          onMeasurementBlockedChange?.(next.length > 0);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestSequence.current !== sequence)
            return;
          void error;
          setSuggestions([]);
          setStatus("error");
          setActiveIndex(-1);
          onMeasurementBlockedChange?.(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [onMeasurementBlockedChange, query, selected?.label]);

  const choose = (suggestion: EnturAddressSuggestionV1) => {
    setSelected(suggestion);
    setQuery(suggestion.label);
    setSuggestions([]);
    setStatus("idle");
    setActiveIndex(-1);
    onMeasurementBlockedChange?.(suggestion.kind === "street");
  };
  const expanded = focused && query.trim().length >= 3 && status !== "idle";

  return (
    <label className="relative grid gap-2 text-sm font-bold">
      {label}
      <input
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-busy={status === "loading"}
        aria-controls={listboxId}
        aria-expanded={expanded}
        autoComplete="off"
        className={inputClassName}
        id="roof-fusion-address-query"
        maxLength={180}
        minLength={4}
        name="addressQuery"
        onBlur={() => window.setTimeout(() => setFocused(false), 100)}
        onChange={(event) => {
          const normalized = normalizeEnturAutocompleteQueryV1(
            event.target.value,
          );
          requestSequence.current += 1;
          setQuery(event.target.value);
          setSelected(null);
          setSuggestions([]);
          setStatus("idle");
          setActiveIndex(-1);
          onMeasurementBlockedChange?.(normalized.length >= 3);
        }}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setSuggestions([]);
            setStatus("idle");
            setActiveIndex(-1);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (!suggestions.length) return;
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) =>
              current < 0
                ? direction > 0
                  ? 0
                  : suggestions.length - 1
                : (current + direction + suggestions.length) %
                  suggestions.length,
            );
            return;
          }
          if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            choose(suggestions[activeIndex]!);
          }
        }}
        placeholder={placeholder}
        required
        role="combobox"
        value={query}
      />
      {selected?.address ? (
        <>
          <input
            name="selectedAddressId"
            type="hidden"
            value={selected.address.id}
          />
          <input
            name="selectedAddressLabel"
            type="hidden"
            value={selected.address.label}
          />
          <input
            name="selectedAddressPostalCode"
            type="hidden"
            value={selected.address.postalCode}
          />
          <input
            name="selectedAddressCity"
            type="hidden"
            value={selected.address.city}
          />
          <input
            name="selectedAddressLatitude"
            type="hidden"
            value={selected.address.latitude}
          />
          <input
            name="selectedAddressLongitude"
            type="hidden"
            value={selected.address.longitude}
          />
        </>
      ) : null}
      {expanded ? (
        <div
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-white/15 bg-[#111722] shadow-2xl"
          id={listboxId}
          role="listbox"
        >
          {status === "loading" ? (
            <p
              className="flex items-center gap-2 px-3 py-3 text-xs text-[#ddd8cd]"
              role="status"
            >
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Ieškoma oficialių adresų…
            </p>
          ) : null}
          {status === "empty" ? (
            <p className="px-3 py-3 text-xs text-[#aaa69d]" role="status">
              Pasiūlymų nerasta. Galite tęsti rankinę paiešką.
            </p>
          ) : null}
          {status === "error" ? (
            <p className="px-3 py-3 text-xs text-[#f3c66b]" role="status">
              Adresų pasiūlymai laikinai nepasiekiami. Rankinė paieška veikia.
            </p>
          ) : null}
          {status === "ready"
            ? suggestions.map((suggestion, index) => (
                <button
                  aria-selected={activeIndex === index}
                  className={`block min-h-11 w-full px-3 py-2 text-left text-sm ${activeIndex === index ? "bg-[#e8a317]/15 text-[#f3c66b]" : "text-[#ddd8cd] hover:bg-white/5"}`}
                  id={`${listboxId}-option-${index}`}
                  key={suggestion.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(suggestion)}
                  role="option"
                  type="button"
                >
                  <span className="block font-semibold">
                    {suggestion.label}
                  </span>
                  <span className="block text-[10px] text-[#aaa69d]">
                    {suggestion.kind === "address"
                      ? "Oficialus adresas"
                      : "Gatvė — įrašykite namo numerį"}
                  </span>
                </button>
              ))
            : null}
        </div>
      ) : null}
      {selected?.kind === "street" ? (
        <span className="text-xs font-medium text-[#f3c66b]" role="alert">
          Įrašykite namo numerį ir pasirinkite konkretų oficialų adresą.
        </span>
      ) : null}
    </label>
  );
}
