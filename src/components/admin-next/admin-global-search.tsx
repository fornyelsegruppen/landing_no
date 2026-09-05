"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSearchResult } from "@/lib/admin-v2/dashboard";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS,
  AdminAsyncFeedback,
} from "./admin-async-feedback";
import { AdminOverlay } from "./admin-overlay";

const copy = {
  nb: {
    label: "Globalt søk",
    placeholder: "Kunde, adresse, telefon, dokument eller stabil ID",
    hint: "Skriv minst to tegn",
    empty: "Ingen tillatte resultater.",
    error: "Søket kunne ikke fullføres",
    close: "Lukk søk",
    permissionNote:
      "Resultatene filtreres etter tilgangene til den innloggede brukeren.",
    pendingAction: "Søker i tillatte oppføringer",
    errorAction: "Søk",
  },
  lt: {
    label: "Globali paieška",
    placeholder: "Klientas, adresas, telefonas, dokumentas arba stabilus ID",
    hint: "Įveskite bent du ženklus",
    empty: "Leidžiamų rezultatų nerasta.",
    error: "Paieškos atlikti nepavyko",
    close: "Uždaryti paiešką",
    permissionNote:
      "Rezultatai filtruojami pagal prisijungusio naudotojo teises.",
    pendingAction: "Ieškoma leidžiamuose įrašuose",
    errorAction: "Paieška",
  },
  en: {
    label: "Global search",
    placeholder: "Customer, address, phone, document or stable ID",
    hint: "Enter at least two characters",
    empty: "No permitted results.",
    error: "Search could not be completed",
    close: "Close search",
    permissionNote: "Results are filtered by the signed-in user's permissions.",
    pendingAction: "Searching permitted records",
    errorAction: "Search",
  },
} as const;

const typeLabels: Record<
  PanelLocale,
  Record<AdminSearchResult["type"], string>
> = {
  nb: {
    contract: "Kontrakt",
    document: "Dokument",
    invoice: "Faktura",
    lead: "Sak / kunde",
    quote: "Tilbud",
    warranty: "Garanti",
    workOrder: "Arbeid",
  },
  lt: {
    contract: "Sutartis",
    document: "Dokumentas",
    invoice: "Sąskaita",
    lead: "Byla / klientas",
    quote: "Pasiūlymas",
    warranty: "Garantija",
    workOrder: "Darbas",
  },
  en: {
    contract: "Contract",
    document: "Document",
    invoice: "Invoice",
    lead: "Case / customer",
    quote: "Quote",
    warranty: "Warranty",
    workOrder: "Work",
  },
};

export function groupAdminSearchResults(results: AdminSearchResult[]) {
  return results.reduce<
    Partial<Record<AdminSearchResult["type"], AdminSearchResult[]>>
  >((groups, item) => {
    (groups[item.type] ||= []).push(item);
    return groups;
  }, {});
}

export function shouldOpenAdminGlobalSearchShortcut(
  event: Pick<KeyboardEvent, "ctrlKey" | "key" | "metaKey">,
  trigger: Pick<HTMLElement, "getClientRects"> | null,
) {
  return (
    Boolean(trigger?.getClientRects().length) &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "k"
  );
}

export function AdminGlobalSearch({ locale }: { locale: PanelLocale }) {
  const t = copy[locale];
  const pathname = usePathname();
  const shortcutTriggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        shouldOpenAdminGlobalSearchShortcut(event, shortcutTriggerRef.current)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("pending");
      try {
        const response = await fetch(
          `/api/admin/search?q=${encodeURIComponent(query)}`,
          {
            headers: { accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("search_failed");
        const body = (await response.json()) as {
          results?: AdminSearchResult[];
        };
        setResults(body.results || []);
        setState("idle");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }, 120);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const grouped = useMemo(() => groupAdminSearchResults(results), [results]);

  return (
    <>
      <button
        aria-keyshortcuts="Control+K Meta+K"
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] px-3 text-left text-sm text-[var(--an-text-subtle)] hover:border-[var(--an-border-strong)]"
        onClick={() => setOpen(true)}
        ref={shortcutTriggerRef}
        type="button"
      >
        <Search aria-hidden="true" className="size-[18px] shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t.placeholder}</span>
        <kbd className="rounded border border-[var(--an-border)] bg-[var(--an-surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--an-text-muted)]">
          Ctrl K
        </kbd>
      </button>
      <AdminOverlay
        description={`${t.hint}. ${t.permissionNote}`}
        locale={locale}
        onOpenChange={setOpen}
        open={open}
        title={t.label}
      >
        <label className="sr-only" htmlFor="unified-admin-search">
          {t.label}
        </label>
        <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-canvas)] px-3 focus-within:border-[var(--an-action)] focus-within:ring-2 focus-within:ring-[var(--an-action-soft)]">
          <Search
            aria-hidden="true"
            className="size-5 text-[var(--an-text-subtle)]"
          />
          <input
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--an-text-subtle)]"
            id="unified-admin-search"
            maxLength={80}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim().length < 2) {
                setResults([]);
                setState("idle");
              }
            }}
            placeholder={t.placeholder}
            ref={inputRef}
            type="search"
            value={query}
          />
        </div>
        <div className="mt-4 min-h-16" aria-live="polite">
          {state === "pending" ? (
            <AdminAsyncFeedback
              action={t.pendingAction}
              delayMs={ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS}
              locale={locale}
              state="pending"
            />
          ) : null}
          {state === "error" ? (
            <AdminAsyncFeedback
              action={t.errorAction}
              locale={locale}
              message={t.error}
              state="error"
            />
          ) : null}
          {state === "idle" && query.trim().length < 2 ? (
            <p className="py-4 text-sm text-[var(--an-text-muted)]">{t.hint}</p>
          ) : null}
          {state === "idle" &&
          query.trim().length >= 2 &&
          results.length === 0 ? (
            <p className="py-4 text-sm text-[var(--an-text-muted)]">
              {t.empty}
            </p>
          ) : null}
          {state === "idle" && results.length > 0 ? (
            <div className="grid gap-4">
              {Object.entries(grouped).map(([type, items]) => (
                <section aria-labelledby={`search-group-${type}`} key={type}>
                  <h3
                    className="text-xs font-bold tracking-[.16em] text-[var(--an-text-subtle)] uppercase"
                    id={`search-group-${type}`}
                  >
                    {typeLabels[locale][type as AdminSearchResult["type"]]}
                  </h3>
                  <div className="mt-2 grid gap-1">
                    {items?.map((item) => (
                      <Link
                        className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 hover:border-[var(--an-border)] hover:bg-[var(--an-surface-soft)]"
                        href={`${item.href}${item.href.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(pathname)}`}
                        key={`${item.type}-${item.id}`}
                        onClick={() => setOpen(false)}
                      >
                        <span className="min-w-0">
                          <strong className="block truncate text-sm">
                            {item.reference}
                          </strong>
                          {item.subtitle ? (
                            <small className="block truncate text-[var(--an-text-muted)]">
                              {item.subtitle}
                            </small>
                          ) : null}
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-[var(--an-text-subtle)] group-hover:text-[var(--an-action)]"
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </AdminOverlay>
    </>
  );
}
