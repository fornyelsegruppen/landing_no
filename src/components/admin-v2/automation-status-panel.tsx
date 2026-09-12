"use client";

import { useEffect, useState } from "react";

type AutomationSourceFreshness = "unknown" | "stale" | "fresh" | "no-data";

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
    status: "running" | "completed" | "failed" | "attention";
    startedAt: string;
    finishedAt: string | null;
    errorCode: string | null;
  };
  nextConfiguredRunAt: string;
  pendingApprovalCount: number;
  sources: {
    searchConsole: {
      access: "configuration_required" | "unverified" | "verified" | "failed";
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
  },
} satisfies Record<Locale, Record<string, string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isFreshness(value: unknown): value is AutomationSourceFreshness {
  return ["unknown", "stale", "fresh", "no-data"].includes(String(value));
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
    typeof value.nextConfiguredRunAt !== "string" ||
    typeof value.pendingApprovalCount !== "number"
  )
    return null;
  if (
    !["configuration_required", "unverified", "verified", "failed"].includes(
      String(searchConsole.access),
    ) ||
    !isFreshness(searchConsole.freshness) ||
    !isNullableString(searchConsole.lastSuccessAt)
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
      typeof value.lastRun.startedAt !== "string" ||
      !isNullableString(value.lastRun.finishedAt) ||
      !isNullableString(value.lastRun.errorCode)
    )
      return null;
  }
  return value as BlogAutomationStatusDto;
}

export async function fetchBlogAutomationStatus(
  fetcher: typeof fetch = fetch,
): Promise<BlogAutomationStatusDto | null> {
  try {
    const response = await fetcher("/api/admin/blog/automation", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return null;
    return parseBlogAutomationStatus(await response.json());
  } catch {
    return null;
  }
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
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
              ? `${data.lastRun.status} · #${data.lastRun.id}`
              : text.noRun}
          </p>
          {data.lastRun ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {formatDate(data.lastRun.startedAt, locale)}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {text.sources}
          </p>
          <p className="mt-2 text-sm">
            {text.searchConsole}:{" "}
            <strong>{data.sources.searchConsole.freshness}</strong>
          </p>
          <p className="mt-1 text-sm">
            {text.trends}: <strong>{data.sources.trends.freshness}</strong>
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
    let active = true;
    void fetchBlogAutomationStatus().then((data) => {
      if (active)
        setState(data ? { kind: "loaded", data } : { kind: "unavailable" });
    });
    return () => {
      active = false;
    };
  }, []);
  return <AutomationStatusPanel locale={locale} state={state} />;
}
