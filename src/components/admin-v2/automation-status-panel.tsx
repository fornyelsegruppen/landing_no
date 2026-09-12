"use client";

import { useEffect, useState } from "react";

type AutomationSourceFreshness = "unknown" | "stale" | "fresh" | "no-data";
type AutomationSourceAccess =
  "configuration_required" | "unverified" | "verified" | "failed";
type AutomationRunStatus = "running" | "completed" | "failed" | "attention";

export const BLOG_AUTOMATION_STATUS_TIMEOUT_MS = 8_000;

export type BlogAutomationStatusDto = {
  features: { draftsEnabled: boolean; approvedPublisherEnabled: boolean };
  executor: {
    state: "paused" | "unknown";
    verifiedAt: null;
    targetMatches: null;
  };
  timeZone: "Europe/Oslo";
  lastRun: null | {
    id: number;
    status: AutomationRunStatus;
    startedAt: string;
    finishedAt: string | null;
    errorCode: string | null;
  };
  nextConfiguredRunAt: string;
  pendingApprovalCount: number;
  sources: {
    searchConsole: {
      access: AutomationSourceAccess;
      freshness: AutomationSourceFreshness;
      lastSuccessAt: string | null;
    };
    trends: { access: "unverified"; freshness: "unknown"; lastSuccessAt: null };
  };
};

type Locale = "nb" | "en" | "lt";
type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; data: BlogAutomationStatusDto }
  | { kind: "unavailable" };

const copy = {
  nb: {
    title: "Bloggautomatisering",
    loading: "Henter automatiseringsstatus …",
    unavailable: "Automatiseringsstatus er ikke tilgjengelig.",
    paused: "Automatiseringen er satt på pause.",
    unknown:
      "Automatiseringen er konfigurert, men kjøringen er ikke verifisert.",
    next: "Neste konfigurerte tidsvindu",
    nextHint: "Teoretisk tidspunkt — ikke en bekreftet kjøring.",
    pending: "Venter på godkjenning",
    lastRun: "Siste kjøring",
    noRun: "Ingen registrert kjøring.",
    sources: "Datakilder",
    searchConsole: "Search Console",
    trends: "Trender",
    approval: "Menneskelig godkjenning er fortsatt påkrevd.",
    lastSuccess: "Siste vellykkede oppdatering",
    invalidDate: "Ikke tilgjengelig",
    runError: "Kjøringen trenger manuell oppfølging.",
  },
  lt: {
    title: "Tinklaraščio automatizavimas",
    loading: "Gaunama automatizavimo būsena …",
    unavailable: "Automatizavimo būsena nepasiekiama.",
    paused: "Automatizavimas sustabdytas.",
    unknown: "Automatizavimas sukonfigūruotas, bet vykdymas nepatvirtintas.",
    next: "Kitas sukonfigūruotas laiko langas",
    nextHint: "Teorinis laikas — ne patvirtintas vykdymas.",
    pending: "Laukia patvirtinimo",
    lastRun: "Paskutinis vykdymas",
    noRun: "Vykdymų dar neužregistruota.",
    sources: "Duomenų šaltiniai",
    searchConsole: "Search Console",
    trends: "Tendencijos",
    approval: "Žmogaus patvirtinimas vis dar būtinas.",
    lastSuccess: "Paskutinis sėkmingas atnaujinimas",
    invalidDate: "Nepasiekiama",
    runError: "Vykdymą reikia peržiūrėti rankiniu būdu.",
  },
  en: {
    title: "Blog automation",
    loading: "Loading automation status …",
    unavailable: "Automation status is unavailable.",
    paused: "Automation is paused.",
    unknown: "Automation is configured, but its execution is not verified.",
    next: "Next configured time window",
    nextHint: "Theoretical time — not a verified execution.",
    pending: "Pending approval",
    lastRun: "Last run",
    noRun: "No recorded run.",
    sources: "Data sources",
    searchConsole: "Search Console",
    trends: "Trends",
    approval: "Human approval remains required.",
    lastSuccess: "Last successful update",
    invalidDate: "Unavailable",
    runError: "The run needs manual review.",
  },
} satisfies Record<Locale, Record<string, string>>;

const sourceAccessCopy = {
  nb: {
    configuration_required: "Konfigurasjon kreves",
    unverified: "Ikke verifisert",
    verified: "Verifisert",
    failed: "Kontroll mislyktes",
  },
  lt: {
    configuration_required: "Reikalinga konfigūracija",
    unverified: "Nepatvirtinta",
    verified: "Patvirtinta",
    failed: "Patikra nepavyko",
  },
  en: {
    configuration_required: "Configuration required",
    unverified: "Unverified",
    verified: "Verified",
    failed: "Check failed",
  },
} satisfies Record<Locale, Record<AutomationSourceAccess, string>>;

const freshnessCopy = {
  nb: {
    unknown: "Ukjent",
    stale: "Utdatert",
    fresh: "Oppdatert",
    "no-data": "Ingen data",
  },
  lt: {
    unknown: "Nežinoma",
    stale: "Pasenę",
    fresh: "Švieži",
    "no-data": "Nėra duomenų",
  },
  en: {
    unknown: "Unknown",
    stale: "Stale",
    fresh: "Fresh",
    "no-data": "No data",
  },
} satisfies Record<Locale, Record<AutomationSourceFreshness, string>>;

const runStatusCopy = {
  nb: {
    running: "Pågår",
    completed: "Fullført",
    failed: "Mislyktes",
    attention: "Krever oppfølging",
  },
  lt: {
    running: "Vykdoma",
    completed: "Baigta",
    failed: "Nepavyko",
    attention: "Reikia peržiūros",
  },
  en: {
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    attention: "Needs review",
  },
} satisfies Record<Locale, Record<AutomationRunStatus, string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isFreshness(value: unknown): value is AutomationSourceFreshness {
  return ["unknown", "stale", "fresh", "no-data"].includes(String(value));
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  return !Number.isNaN(new Date(value).valueOf());
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isValidIsoDate(value);
}

export function parseBlogAutomationStatus(
  value: unknown,
): BlogAutomationStatusDto | null {
  if (
    !isRecord(value) ||
    !isRecord(value.features) ||
    !isRecord(value.executor) ||
    !isRecord(value.sources)
  )
    return null;
  const searchConsole = value.sources.searchConsole;
  const trends = value.sources.trends;
  if (!isRecord(searchConsole) || !isRecord(trends)) return null;
  if (
    typeof value.features.draftsEnabled !== "boolean" ||
    typeof value.features.approvedPublisherEnabled !== "boolean"
  )
    return null;
  if (
    !["paused", "unknown"].includes(String(value.executor.state)) ||
    value.executor.verifiedAt !== null ||
    value.executor.targetMatches !== null
  )
    return null;
  if (
    value.timeZone !== "Europe/Oslo" ||
    !isValidIsoDate(value.nextConfiguredRunAt) ||
    typeof value.pendingApprovalCount !== "number" ||
    !Number.isFinite(value.pendingApprovalCount) ||
    value.pendingApprovalCount < 0
  )
    return null;
  if (
    !["configuration_required", "unverified", "verified", "failed"].includes(
      String(searchConsole.access),
    ) ||
    !isFreshness(searchConsole.freshness) ||
    !isNullableIsoDate(searchConsole.lastSuccessAt)
  )
    return null;
  if (
    trends.access !== "unverified" ||
    trends.freshness !== "unknown" ||
    trends.lastSuccessAt !== null
  )
    return null;
  if (value.lastRun !== null) {
    if (
      !isRecord(value.lastRun) ||
      typeof value.lastRun.id !== "number" ||
      !["running", "completed", "failed", "attention"].includes(
        String(value.lastRun.status),
      ) ||
      !isValidIsoDate(value.lastRun.startedAt) ||
      !isNullableIsoDate(value.lastRun.finishedAt) ||
      !isNullableString(value.lastRun.errorCode)
    )
      return null;
  }
  return value as BlogAutomationStatusDto;
}

export async function fetchBlogAutomationStatus(
  fetcher: typeof fetch = fetch,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BlogAutomationStatusDto | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? BLOG_AUTOMATION_STATUS_TIMEOUT_MS,
  );
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetcher("/api/admin/blog/automation", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parseBlogAutomationStatus(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return copy[locale].invalidDate;
  return new Intl.DateTimeFormat(
    locale === "lt" ? "lt-LT" : locale === "nb" ? "nb-NO" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    },
  ).format(date);
}

export function AutomationStatusPanel({
  state,
  locale = "en",
}: {
  state: LoadState;
  locale?: Locale;
}) {
  const text = copy[locale];
  if (state.kind !== "loaded") {
    return (
      <section
        aria-live="polite"
        className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5"
      >
        <h2 className="font-bold">{text.title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {state.kind === "loading" ? text.loading : text.unavailable}
        </p>
      </section>
    );
  }
  const { data } = state;
  return (
    <section
      aria-live="polite"
      className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{text.title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.executor.state === "paused" ? text.paused : text.unknown}
          </p>
        </div>
        <span className="border-accent/25 bg-accent/10 text-accent rounded-full border px-3 py-1 text-xs font-bold">
          {text.pending}: {data.pendingApprovalCount}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {text.next}
          </p>
          <p className="mt-2 font-semibold">
            {formatDate(data.nextConfiguredRunAt, locale)} ({data.timeZone})
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{text.nextHint}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {text.lastRun}
          </p>
          <p className="mt-2 font-semibold">
            {data.lastRun
              ? `${runStatusCopy[locale][data.lastRun.status]} · #${data.lastRun.id}`
              : text.noRun}
          </p>
          {data.lastRun ? (
            <>
              <p className="text-muted-foreground mt-1 text-xs">
                {formatDate(data.lastRun.startedAt, locale)}
              </p>
              {data.lastRun.errorCode ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {text.runError}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {text.sources}
          </p>
          <p className="mt-2 text-sm">
            {text.searchConsole}:{" "}
            <strong>
              {sourceAccessCopy[locale][data.sources.searchConsole.access]} ·{" "}
              {freshnessCopy[locale][data.sources.searchConsole.freshness]}
            </strong>
          </p>
          {data.sources.searchConsole.lastSuccessAt ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {text.lastSuccess}:{" "}
              {formatDate(data.sources.searchConsole.lastSuccessAt, locale)}
            </p>
          ) : null}
          <p className="mt-1 text-sm">
            {text.trends}:{" "}
            <strong>
              {sourceAccessCopy[locale][data.sources.trends.access]} ·{" "}
              {freshnessCopy[locale][data.sources.trends.freshness]}
            </strong>
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-4 text-sm font-semibold">
        {text.approval}
      </p>
    </section>
  );
}

export function BlogAutomationStatusLoader({
  locale = "en",
}: {
  locale?: Locale;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchBlogAutomationStatus(fetch, { signal: controller.signal }).then(
      (data) => {
        if (active)
          setState(data ? { kind: "loaded", data } : { kind: "unavailable" });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  return <AutomationStatusPanel locale={locale} state={state} />;
}
