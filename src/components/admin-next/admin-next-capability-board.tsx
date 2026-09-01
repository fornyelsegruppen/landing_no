import Link from "next/link";
import { ArrowRight, CircleDashed, Layers3, ShieldCheck } from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type {
  AdminNextCapabilityState,
  AdminNextModuleId,
  AdminNextRolloutView,
} from "@/lib/admin-next/rollout-view";

const copy = {
  nb: {
    eyebrow: "Admin Next",
    title: "Trygg innføring uten å miste dagens verktøy",
    intro:
      "Hver modul får sin egen status og beholder en tydelig vei til dagens funksjon frem til den har bestått alle produksjonsporter.",
    current: "Dagens Admin V2 er aktiv",
    preview: "Beskyttet forhåndsvisning",
    active: "Godkjent for full drift",
    fallback: "Bruk dagens funksjon",
    details: "Tekniske avhengigheter",
    dependencies: "Funksjonsavhengigheter",
    integrations: "Mangler konfigurasjon",
    none: "Ingen",
    modules: {
      today: "I dag",
      caseWorkspace: "Saksoversikt",
      roofWorkbench: "Takmåling og R4",
      documentPreflight: "Dokumentpakke og preflight",
      fieldVisit: "Medarbeiderbesøk",
    },
    states: {
      legacy_active: "Dagens funksjon er aktiv",
      implemented_disabled: "Implementert, men ikke aktivert",
      blocked_configuration: "Venter på konfigurasjon",
      preview_ready: "Klar for Preview-test",
      enabled: "Aktivert",
      planned: "Planlagt",
    },
  },
  lt: {
    eyebrow: "Admin Next",
    title: "Saugus atnaujinimas neprarandant dabartinių įrankių",
    intro:
      "Kiekvienas modulis turi atskirą būseną ir aiškų kelią į dabartinę funkciją, kol praeina visus production vartus.",
    current: "Dabartinis Admin V2 aktyvus",
    preview: "Apsaugota peržiūra",
    active: "Patvirtinta pilnam veikimui",
    fallback: "Naudoti dabartinę funkciją",
    details: "Techninės priklausomybės",
    dependencies: "Funkcijų priklausomybės",
    integrations: "Trūksta konfigūracijos",
    none: "Nėra",
    modules: {
      today: "Šiandien",
      caseWorkspace: "Bylos apžvalga",
      roofWorkbench: "Stogo matavimas ir R4",
      documentPreflight: "Dokumentų paketas ir preflight",
      fieldVisit: "Darbuotojo vizitas",
    },
    states: {
      legacy_active: "Dabartinė funkcija aktyvi",
      implemented_disabled: "Įgyvendinta, bet neįjungta",
      blocked_configuration: "Laukia konfigūracijos",
      preview_ready: "Paruošta Preview testui",
      enabled: "Įjungta",
      planned: "Suplanuota",
    },
  },
  en: {
    eyebrow: "Admin Next",
    title: "Safe rollout without losing the current tools",
    intro:
      "Every module has an explicit state and a clear route to the current function until it passes every production gate.",
    current: "Current Admin V2 is active",
    preview: "Protected preview",
    active: "Approved for full operation",
    fallback: "Use current function",
    details: "Technical dependencies",
    dependencies: "Feature dependencies",
    integrations: "Missing configuration",
    none: "None",
    modules: {
      today: "Today",
      caseWorkspace: "Case overview",
      roofWorkbench: "Roof measurement and R4",
      documentPreflight: "Document package and preflight",
      fieldVisit: "Worker visit",
    },
    states: {
      legacy_active: "Current function active",
      implemented_disabled: "Implemented but disabled",
      blocked_configuration: "Waiting for configuration",
      preview_ready: "Ready for Preview testing",
      enabled: "Enabled",
      planned: "Planned",
    },
  },
} as const;

const stateStyles: Record<AdminNextCapabilityState, string> = {
  legacy_active: "border-white/15 bg-white/5 text-white/75",
  implemented_disabled: "border-sky-400/35 bg-sky-400/10 text-sky-200",
  blocked_configuration: "border-danger/40 bg-danger/10 text-danger",
  preview_ready: "border-accent/45 bg-accent/10 text-accent",
  enabled: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  planned: "border-white/10 bg-black/15 text-muted-foreground",
};

function rolloutLabel(
  locale: PanelLocale,
  state: AdminNextRolloutView["state"],
) {
  const t = copy[locale];
  if (state === "preview") return t.preview;
  if (state === "active") return t.active;
  return t.current;
}

export function AdminNextPreviewNotice({
  locale,
  rollout,
}: {
  locale: PanelLocale;
  rollout: AdminNextRolloutView;
}) {
  if (rollout.state === "legacy") return null;
  const t = copy[locale];

  return (
    <Link
      className="mx-auto mb-5 flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-accent/35 bg-accent/8 px-4 py-3 text-sm transition hover:border-accent/65 hover:bg-accent/12"
      href="/admin-next-preview/today"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Layers3 aria-hidden="true" className="size-5 shrink-0 text-accent" />
        <span className="min-w-0">
          <strong className="block">{t.eyebrow}</strong>
          <span className="block truncate text-xs text-muted-foreground">
            {rolloutLabel(locale, rollout.state)}
          </span>
        </span>
      </span>
      <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-accent" />
    </Link>
  );
}

export function AdminNextCapabilityBoard({
  locale,
  rollout,
}: {
  locale: PanelLocale;
  rollout: AdminNextRolloutView;
}) {
  const t = copy[locale];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-accent">
          {t.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.intro}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/8 px-3 py-1.5 text-xs font-bold text-accent">
          <ShieldCheck aria-hidden="true" className="size-4" />
          {rolloutLabel(locale, rollout.state)}
        </div>
      </header>

      <section aria-label={t.eyebrow} className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {rollout.modules.map((module) => (
          <article
            className="flex min-h-64 flex-col rounded-3xl border border-white/10 bg-background-elevated/75 p-5"
            data-capability-state={module.state}
            key={module.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <CircleDashed aria-hidden="true" className="size-5 text-accent" />
                <h2 className="mt-3 text-lg font-bold">
                  {t.modules[module.id as AdminNextModuleId]}
                </h2>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${stateStyles[module.state]}`}
              >
                {t.states[module.state]}
              </span>
            </div>

            <details className="mt-5 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold hover:text-white">
                {t.details}
              </summary>
              <dl className="mt-3 grid gap-2">
                <div>
                  <dt className="font-semibold text-white/70">{t.dependencies}</dt>
                  <dd className="mt-1 break-words">
                    {module.dependencies.join(" · ") || t.none}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-white/70">{t.integrations}</dt>
                  <dd className="mt-1 break-words">
                    {module.unavailableIntegrations.join(" · ") || t.none}
                  </dd>
                </div>
              </dl>
            </details>

            <Link
              className="mt-auto flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold transition hover:border-accent/50 hover:bg-white/5"
              href={module.legacyHref}
            >
              {t.fallback}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
