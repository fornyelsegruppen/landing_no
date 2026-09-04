import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FolderOpen,
  ImageIcon,
  Mail,
  MapPin,
  MessageSquareText,
  Ruler,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type {
  AdminNextCaseStageId,
  AdminNextCaseStageState,
  AdminNextAuditTimelineDetails,
  AdminNextCaseWorkspaceView,
  AdminNextEvidenceKind,
  AdminNextEvidenceState,
  AdminNextTimelineKind,
} from "@/lib/admin-next/case-workspace-contract";
import {
  AdminNextCaseWorkspaceContextNav,
  AdminNextCaseWorkspaceHistoryRail,
} from "./admin-next-case-workspace-navigation";
import {
  BlockerSummary,
  DueIndicator,
  StatusBadge,
} from "./admin-status-primitives";

const copy = {
  nb: {
    back: "Tilbake til I dag",
    case: "Sak",
    synthetic: "Syntetiske Preview-data",
    canonical: "Canonical Preview-data",
    attention: "Krever oppmerksomhet",
    on_track: "På plan",
    waiting: "Venter",
    owner: "Ansvarlig",
    sla: "SLA-frist",
    today: "I dag",
    overdue: "Forsinket",
    minutes: "min",
    due_soon: "Forfaller snart",
    slaUnknown: "Ingen frist registrert",
    next: "Neste nødvendige handling",
    currentFallback: "Åpne fungerende sak",
    interactionReasons: {
      capability_denied: "Handlingen er skrivebeskyttet uten bekreftet tilgang.",
      no_action: "Saken krever ingen handling nå.",
      target_unavailable: "Et eksakt operatørmål er ikke tilgjengelig.",
    },
    process: "Saksforløp",
    processIntro: "Ett felles bilde av fremdrift og blokkeringer.",
    contextNavigation: "Navigasjon i saken",
    contextSummary: "Sammendrag",
    contextEvidence: "Dokumentasjon",
    contextHistory: "Historikk",
    historyToggle: "Vis eller skjul historikk",
    historyStates: {
      ready: "Hendelser tilgjengelige",
      empty: "Ingen hendelser",
      unavailable: "Midlertidig utilgjengelig",
      denied: "Ingen tilgang",
    },
    showProgress: "Vis hele forløpet",
    of: "av",
    evidence: "Dokumentasjon og bevis",
    evidenceIntro: "Alt som støtter neste beslutning, samlet på ett sted.",
    openEvidence: "Åpne i dagens løsning",
    evidenceUnavailable: "Ingen operatorflate",
    reviewMeasurement: "Kontroller R4",
    documentPreflight: "Kontroller pakke",
    timeline: "Tidslinje",
    timelineIntro: "Siste hendelser med kilde og tidspunkt.",
    timelineEmpty: "Ingen revisjonshendelser er registrert for denne saken.",
    timelineUnavailable: "Revisjonshistorikken er midlertidig utilgjengelig.",
    timelineDenied: "Du har ikke tilgang til revisjonshistorikken.",
    changedFields: "Endrede felt",
    result: "Resultat",
    reason: "Årsak",
    version: "Versjon",
    sourceLabel: "Kilde",
    correlation: "Korrelasjon",
    hashStatus: "Hash-status",
    actorKinds: {
      user: "Bruker",
      system: "System",
      job: "Jobb",
      webhook: "Webhook",
      unknown: "Ukjent aktør",
    },
    changedFieldsStatuses: {
      absent: "Ikke registrert",
      projected: "Felt registrert",
      rejected: "Avvist av personvernfilteret",
    },
    hashStatuses: {
      not_recorded: "Ikke registrert",
      recorded_unverified: "Registrert, ikke verifisert",
      invalid: "Ugyldig",
    },
    tamperStatuses: { not_assessable: "Kan ikke vurderes" },
    fallbackTitle: "Fungerende Admin V2 er fortsatt tilgjengelig",
    fallbackIntro:
      "Preview endrer ingen kundedata og utfører ingen utsendelser.",
    openDocuments: "Dokumenter",
    openWork: "Arbeidsplan",
    stages: {
      inquiry: "Forespørsel",
      evidence: "Dokumentasjon",
      commercial: "Kommersielt",
      agreement: "Avtale",
      work: "Arbeid",
      completion: "Sluttføring",
    },
    stageStates: {
      complete: "Fullført",
      current: "Nå",
      blocked: "Blokkert",
      upcoming: "Senere",
    },
    evidenceStates: {
      verified: "Bekreftet",
      review: "Må kontrolleres",
      missing: "Mangler",
    },
  },
  lt: {
    back: "Grįžti į „Šiandien“",
    case: "Byla",
    synthetic: "Sintetiniai Preview duomenys",
    canonical: "Canonical Preview duomenys",
    attention: "Reikia dėmesio",
    on_track: "Pagal planą",
    waiting: "Laukia",
    owner: "Atsakingas",
    sla: "SLA terminas",
    today: "Šiandien",
    overdue: "Vėluoja",
    minutes: "min.",
    due_soon: "Terminas netrukus",
    slaUnknown: "Terminas neužregistruotas",
    next: "Kitas būtinas veiksmas",
    currentFallback: "Atidaryti veikiančią bylą",
    interactionReasons: {
      capability_denied: "Veiksmas tik skaitomas, kol nepatvirtinta prieiga.",
      no_action: "Šiuo metu bylai veiksmo nereikia.",
      target_unavailable: "Tikslinė operatoriaus darbo vieta nepasiekiama.",
    },
    process: "Bylos eiga",
    processIntro: "Vienas bendras eigos ir blokavimų vaizdas.",
    contextNavigation: "Navigacija byloje",
    contextSummary: "Santrauka",
    contextEvidence: "Įrodymai",
    contextHistory: "Istorija",
    historyToggle: "Rodyti arba slėpti istoriją",
    historyStates: {
      ready: "Įvykiai pasiekiami",
      empty: "Įvykių nėra",
      unavailable: "Laikinai nepasiekiama",
      denied: "Prieiga nesuteikta",
    },
    showProgress: "Rodyti visą eigą",
    of: "iš",
    evidence: "Dokumentai ir įrodymai",
    evidenceIntro: "Viskas, ko reikia kitam sprendimui, vienoje vietoje.",
    openEvidence: "Atidaryti dabartinėje sistemoje",
    evidenceUnavailable: "Operatoriaus darbo vietos nėra",
    reviewMeasurement: "Peržiūrėti R4",
    documentPreflight: "Tikrinti paketą",
    timeline: "Įvykių seka",
    timelineIntro: "Naujausi įvykiai su šaltiniu ir laiku.",
    timelineEmpty: "Šiai bylai audito įvykių neužregistruota.",
    timelineUnavailable: "Audito istorija laikinai nepasiekiama.",
    timelineDenied: "Neturite teisės peržiūrėti audito istorijos.",
    changedFields: "Pakeisti laukai",
    result: "Rezultatas",
    reason: "Priežastis",
    version: "Versija",
    sourceLabel: "Šaltinis",
    correlation: "Koreliacija",
    hashStatus: "Hash būsena",
    actorKinds: {
      user: "Naudotojas",
      system: "Sistema",
      job: "Užduotis",
      webhook: "Webhook",
      unknown: "Nežinomas veikėjas",
    },
    changedFieldsStatuses: {
      absent: "Neužregistruota",
      projected: "Laukai pateikti",
      rejected: "Atmesta privatumo filtro",
    },
    hashStatuses: {
      not_recorded: "Neužregistruota",
      recorded_unverified: "Užregistruota, nepatikrinta",
      invalid: "Netinkama",
    },
    tamperStatuses: { not_assessable: "Neįmanoma įvertinti" },
    fallbackTitle: "Veikiantis Admin V2 lieka pasiekiamas",
    fallbackIntro:
      "Preview nekeičia klientų duomenų ir neatlieka jokių siuntimų.",
    openDocuments: "Dokumentai",
    openWork: "Darbų planas",
    stages: {
      inquiry: "Užklausa",
      evidence: "Įrodymai",
      commercial: "Komercija",
      agreement: "Susitarimas",
      work: "Darbai",
      completion: "Užbaigimas",
    },
    stageStates: {
      complete: "Baigta",
      current: "Dabar",
      blocked: "Blokuota",
      upcoming: "Vėliau",
    },
    evidenceStates: {
      verified: "Patvirtinta",
      review: "Reikia peržiūros",
      missing: "Trūksta",
    },
  },
  en: {
    back: "Back to Today",
    case: "Case",
    synthetic: "Synthetic Preview data",
    canonical: "Canonical Preview data",
    attention: "Needs attention",
    on_track: "On track",
    waiting: "Waiting",
    owner: "Owner",
    sla: "SLA deadline",
    today: "Today",
    overdue: "Overdue",
    minutes: "min",
    due_soon: "Due soon",
    slaUnknown: "No deadline recorded",
    next: "Next required action",
    currentFallback: "Open working case",
    interactionReasons: {
      capability_denied: "The action is read-only without confirmed access.",
      no_action: "The case requires no action now.",
      target_unavailable: "An exact operator target is unavailable.",
    },
    process: "Case progress",
    processIntro: "One shared view of progress and blockers.",
    contextNavigation: "Case navigation",
    contextSummary: "Summary",
    contextEvidence: "Evidence",
    contextHistory: "History",
    historyToggle: "Show or hide history",
    historyStates: {
      ready: "Events available",
      empty: "No events",
      unavailable: "Temporarily unavailable",
      denied: "Access denied",
    },
    showProgress: "Show full progress",
    of: "of",
    evidence: "Evidence and documents",
    evidenceIntro: "Everything needed for the next decision in one place.",
    openEvidence: "Open in current system",
    evidenceUnavailable: "No operator workspace",
    reviewMeasurement: "Review R4",
    documentPreflight: "Check package",
    timeline: "Timeline",
    timelineIntro: "Latest events with source and time.",
    timelineEmpty: "No audit events are recorded for this case.",
    timelineUnavailable: "Audit history is temporarily unavailable.",
    timelineDenied: "You do not have access to audit history.",
    changedFields: "Changed fields",
    result: "Result",
    reason: "Reason",
    version: "Version",
    sourceLabel: "Source",
    correlation: "Correlation",
    hashStatus: "Hash status",
    actorKinds: {
      user: "User",
      system: "System",
      job: "Job",
      webhook: "Webhook",
      unknown: "Unknown actor",
    },
    changedFieldsStatuses: {
      absent: "Not recorded",
      projected: "Fields recorded",
      rejected: "Rejected by privacy filter",
    },
    hashStatuses: {
      not_recorded: "Not recorded",
      recorded_unverified: "Recorded, unverified",
      invalid: "Invalid",
    },
    tamperStatuses: { not_assessable: "Cannot be assessed" },
    fallbackTitle: "Working Admin V2 remains available",
    fallbackIntro: "Preview does not change customer data or perform sends.",
    openDocuments: "Documents",
    openWork: "Work schedule",
    stages: {
      inquiry: "Inquiry",
      evidence: "Evidence",
      commercial: "Commercial",
      agreement: "Agreement",
      work: "Work",
      completion: "Completion",
    },
    stageStates: {
      complete: "Complete",
      current: "Now",
      blocked: "Blocked",
      upcoming: "Later",
    },
    evidenceStates: {
      verified: "Verified",
      review: "Needs review",
      missing: "Missing",
    },
  },
} as const;

const evidenceIcons: Record<AdminNextEvidenceKind, typeof Ruler> = {
  measurement: Ruler,
  photo: Camera,
  document: FileCheck2,
  communication: MessageSquareText,
};

const timelineIcons: Record<AdminNextTimelineKind, typeof Ruler> = {
  automation: Bot,
  measurement: Ruler,
  message: Mail,
  assignment: UserRound,
};

const evidenceStateStyles: Record<AdminNextEvidenceState, string> = {
  verified:
    "border-[color:rgba(103,217,170,.3)] bg-[var(--an-success-soft)] text-[var(--an-success)]",
  review:
    "border-[color:rgba(244,182,63,.35)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]",
  missing:
    "border-[color:rgba(255,113,113,.35)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]",
};

const stageStyles: Record<AdminNextCaseStageState, string> = {
  complete:
    "border-[color:rgba(103,217,170,.3)] bg-[var(--an-success-soft)] text-[var(--an-success)]",
  current:
    "border-[color:rgba(244,182,63,.45)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]",
  blocked:
    "border-[color:rgba(255,113,113,.35)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]",
  upcoming:
    "border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-muted)]",
};

function statusLabel(
  status: AdminNextCaseWorkspaceView["status"],
  t: (typeof copy)[PanelLocale],
) {
  return t[status];
}

function slaLabel(
  sla: AdminNextCaseWorkspaceView["sla"],
  t: (typeof copy)[PanelLocale],
) {
  if (sla.state === "overdue")
    return `${Math.abs(sla.remainingMinutes || 0)} ${t.minutes}`;
  if (sla.state === "due_soon") return t.due_soon;
  if (sla.state === "unknown") return t.slaUnknown;
  return t.on_track;
}

function auditTimestamp(locale: PanelLocale, value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    locale === "nb" ? "nb-NO" : locale === "lt" ? "lt-LT" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    },
  ).format(date);
}

function auditActor(
  audit: AdminNextAuditTimelineDetails,
  t: (typeof copy)[PanelLocale],
) {
  const kind = t.actorKinds[audit.actor.kind];
  return audit.actor.display ? `${kind} · ${audit.actor.display}` : kind;
}

export function AdminNextCaseWorkspace({
  locale,
  source = "fixture",
  value,
}: {
  locale: PanelLocale;
  source?: "canonical" | "fixture";
  value: AdminNextCaseWorkspaceView;
}) {
  const t = copy[locale];
  const currentStageIndex = value.stages.findIndex(
    ({ state }) => state === "current",
  );
  const activeStageIndex =
    currentStageIndex >= 0
      ? currentStageIndex
      : Math.max(
          0,
          value.stages.findIndex(({ state }) => state === "blocked"),
        );
  const activeStage = value.stages[activeStageIndex] ||
    value.stages[0] || { id: "inquiry" as const, state: "current" as const };
  const historyState =
    value.timelineState.status === "ready"
      ? value.timeline.length > 0
        ? "ready"
        : "empty"
      : value.timelineState.status;

  return (
    <div
      className="mx-auto max-w-[1500px] space-y-5"
      data-admin-next-section="cases"
    >
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[var(--an-muted)] hover:bg-[var(--an-soft)] hover:text-[var(--an-amber)]"
        href="/admin-next-preview/today"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t.back}
      </Link>

      <AdminNextCaseWorkspaceContextNav
        labels={{
          "case-summary": t.contextSummary,
          "case-evidence": t.contextEvidence,
          "case-history": t.contextHistory,
        }}
        navigationLabel={t.contextNavigation}
      />

      <header
        className="an-surface scroll-mt-28 overflow-hidden rounded-3xl border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--an-focus-ring)]"
        data-case-context-target
        id="case-summary"
        tabIndex={-1}
      >
        <div className="grid gap-5 p-5 sm:p-6 lg:p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                kind={
                  value.status === "attention"
                    ? "attention"
                    : value.status === "waiting"
                      ? "waiting"
                      : "resolved"
                }
                label={statusLabel(value.status, t)}
                locale={locale}
              />
              <span className="rounded-full border border-[color:rgba(244,182,63,.32)] bg-[var(--an-amber-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--an-amber)]">
                {source === "canonical" ? t.canonical : t.synthetic}
              </span>
            </div>
            <p className="mt-5 text-xs font-bold tracking-[.18em] text-[var(--an-amber)] uppercase">
              {t.case} {value.reference}
            </p>
            <h1 className="mt-2 truncate text-2xl font-bold tracking-[-.025em] text-[var(--an-text)] sm:text-3xl">
              {value.customer}
            </h1>
            <p className="mt-2 flex items-start gap-2 text-sm text-[var(--an-muted)]">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {value.address} · {value.service}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 lg:min-w-[350px]">
            <div className="an-elevated rounded-2xl border p-4">
              <dt className="flex items-center gap-2 text-xs font-bold text-[var(--an-muted)]">
                <UserRound aria-hidden="true" className="size-4" />
                {t.owner}
              </dt>
              <dd className="mt-2 text-sm font-bold text-[var(--an-text)]">
                {value.owner.name}
              </dd>
              <dd className="mt-1 text-xs text-[var(--an-subtle)]">
                {value.owner.team}
              </dd>
            </div>
            <div
              className={`rounded-2xl border p-4 ${value.sla.state === "overdue" ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)]" : value.sla.state === "due_soon" ? "border-[var(--an-info)] bg-[var(--an-info-soft)]" : "border-[var(--an-border)] bg-[var(--an-surface-soft)]"}`}
            >
              <dt className="text-xs font-bold text-[var(--an-text-muted)]">
                {t.sla}
              </dt>
              <dd className="mt-2 text-sm font-bold">
                {value.sla.state === "unknown"
                  ? t.slaUnknown
                  : `${t.today} ${value.sla.deadline}`}
              </dd>
              <dd className="mt-1">
                <DueIndicator
                  label={slaLabel(value.sla, t)}
                  locale={locale}
                  state={
                    value.sla.state === "unknown"
                      ? "on_track"
                      : value.sla.state
                  }
                />
              </dd>
            </div>
          </dl>
        </div>

        <section
          className="border-t border-[var(--an-border)] bg-[var(--an-elevated)] p-5 sm:p-6 lg:flex lg:items-center lg:justify-between lg:gap-6"
          aria-labelledby="case-next-action-title"
          data-case-action-mode={value.nextAction.interaction.mode}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[.16em] text-[var(--an-amber)] uppercase">
              {t.next}
            </p>
            <h2
              className="mt-2 text-xl font-bold text-[var(--an-text)]"
              id="case-next-action-title"
            >
              {value.nextAction.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--an-muted)]">
              {value.nextAction.reason}
            </p>
            {value.nextAction.interaction.mode === "read_only" &&
            value.nextAction.interaction.reason !== "diagnostic_blocker" ? (
              <p className="mt-2 max-w-3xl text-xs font-semibold text-[var(--an-text-subtle)]">
                {
                  t.interactionReasons[
                    value.nextAction.interaction.reason
                  ]
                }
              </p>
            ) : null}
            {value.nextAction.diagnosticBlocker ? (
              <div className="mt-3 max-w-3xl">
                <BlockerSummary
                  locale={locale}
                  recovery={value.nextAction.diagnosticBlocker.recovery}
                >
                  {value.nextAction.diagnosticBlocker.code}
                </BlockerSummary>
              </div>
            ) : null}
          </div>
          <Link
            className={`${value.nextAction.href && value.nextAction.label ? "an-cta" : "border border-[var(--an-border-strong)] bg-[var(--an-surface-base)] text-[var(--an-text-muted)]"} mt-4 inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold sm:w-auto lg:mt-0`}
            href={value.nextAction.href || value.fallback.caseHref}
          >
            {value.nextAction.label || t.currentFallback}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      </header>

      <section
        className="an-surface rounded-3xl border p-5 sm:p-6"
        aria-labelledby="case-progress-title"
      >
        <h2
          className="text-lg font-bold text-[var(--an-text)]"
          id="case-progress-title"
        >
          {t.process}
        </h2>
        <p className="mt-1 text-sm text-[var(--an-muted)]">{t.processIntro}</p>
        <details className="mt-5 sm:hidden">
          <summary
            aria-current={activeStage.state === "current" ? "step" : undefined}
            className={`min-h-12 cursor-pointer list-none rounded-2xl border p-3 ${stageStyles[activeStage.state]}`}
            data-case-stage-card
          >
            <span className="flex items-center justify-between gap-3">
              <strong>
                {activeStageIndex + 1} {t.of} {value.stages.length} ·{" "}
                {t.stages[activeStage.id]}
              </strong>
              <small className="font-bold tracking-wider uppercase">
                {t.stageStates[activeStage.state]}
              </small>
            </span>
            <span className="mt-1 block text-xs underline underline-offset-2">
              {t.showProgress}
            </span>
          </summary>
          <ol className="mt-2 grid gap-2">
            {value.stages.map((stage, index) => (
              <li
                className={`rounded-2xl border p-3 ${stageStyles[stage.state]}`}
                data-case-stage-card
                key={`mobile-${stage.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-[var(--an-surface)] text-xs font-black">
                    {stage.state === "complete" ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <small className="text-[10px] font-bold tracking-wider uppercase">
                    {t.stageStates[stage.state]}
                  </small>
                </div>
                <strong className="mt-3 block text-xs">
                  {t.stages[stage.id]}
                </strong>
              </li>
            ))}
          </ol>
        </details>
        <ol className="mt-5 hidden min-w-0 gap-2 sm:grid sm:grid-cols-3 xl:grid-cols-6">
          {value.stages.map((stage, index) => (
            <li
              aria-current={stage.state === "current" ? "step" : undefined}
              className={`min-w-0 rounded-2xl border p-3 ${stageStyles[stage.state]}`}
              data-case-stage-card
              key={stage.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-[var(--an-surface)] text-xs font-black">
                  {stage.state === "complete" ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <small className="text-[10px] font-bold tracking-wider uppercase">
                  {t.stageStates[stage.state]}
                </small>
              </div>
              <strong className="mt-3 block text-xs sm:text-sm">
                {t.stages[stage.id as AdminNextCaseStageId]}
              </strong>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <section
          className="an-surface min-w-0 rounded-3xl border p-5 sm:p-6"
          aria-labelledby="case-evidence-title"
          data-case-context-target
          id="case-evidence"
          tabIndex={-1}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-lg font-bold text-[var(--an-text)]"
                id="case-evidence-title"
              >
                {t.evidence}
              </h2>
              <p className="mt-1 text-sm text-[var(--an-muted)]">
                {t.evidenceIntro}
              </p>
            </div>
            <ShieldCheck
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--an-success)]"
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {value.evidence.map((item) => {
              const Icon = evidenceIcons[item.kind];
              const evidenceHref = item.previewHref || item.fallbackHref;
              const actionLabel =
                item.previewAction === "review_measurement"
                  ? t.reviewMeasurement
                  : item.previewAction === "document_preflight"
                    ? t.documentPreflight
                    : t.openEvidence;
              return (
                <article
                  className="an-elevated flex min-h-56 flex-col rounded-2xl border p-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-[var(--an-amber-soft)] text-[var(--an-amber)]">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-bold ${evidenceStateStyles[item.state]}`}
                    >
                      {t.evidenceStates[item.state]}
                    </span>
                  </div>
                  <h3 className="mt-4 font-bold text-[var(--an-text)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--an-muted)]">
                    {item.summary}
                  </p>
                  {item.metric ? (
                    <strong className="mt-3 block text-sm text-[var(--an-amber)]">
                      {item.metric}
                    </strong>
                  ) : null}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <small className="text-[var(--an-subtle)]">
                      {item.recordedAt}
                    </small>
                    {evidenceHref ? (
                      <Link
                        aria-label={`${actionLabel}: ${item.title}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[var(--an-amber)] hover:bg-[var(--an-amber-soft)]"
                        href={evidenceHref}
                      >
                        {actionLabel}
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    ) : (
                      <span className="text-right text-xs font-semibold text-[var(--an-text-subtle)]">
                        {t.evidenceUnavailable}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside
          className="an-surface min-w-0 scroll-mt-28 rounded-3xl border p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--an-focus-ring)] sm:p-6"
          aria-labelledby="case-timeline-title"
          data-case-context-target
          id="case-history"
          tabIndex={-1}
        >
          <AdminNextCaseWorkspaceHistoryRail
            controlsId="case-history-content"
            state={historyState}
            stateLabel={t.historyStates[historyState]}
            toggleLabel={t.historyToggle}
          >
            <h2
              className="text-lg font-bold text-[var(--an-text)]"
              id="case-timeline-title"
            >
              {t.timeline}
            </h2>
            <p className="mt-1 text-sm text-[var(--an-muted)]">
              {t.timelineIntro}
            </p>
            {value.timelineState.status === "ready" &&
            value.timeline.length > 0 ? (
              <ol className="mt-6 space-y-0" data-audit-history-state="ready">
                {value.timeline.map((item, index) => {
                  const Icon = timelineIcons[item.kind];
                  const audit = item.audit;
                  return (
                    <li
                      className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0"
                      key={item.id}
                    >
                      {index < value.timeline.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-10 bottom-0 left-5 w-px bg-[var(--an-border)]"
                        />
                      ) : null}
                      <span className="relative z-10 grid size-10 place-items-center rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-amber)]">
                        <Icon aria-hidden="true" className="size-[18px]" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <strong className="text-sm text-[var(--an-text)]">
                            {audit?.action || item.title}
                          </strong>
                          <small className="shrink-0 text-[var(--an-subtle)]">
                            {audit
                              ? auditTimestamp(locale, audit.atUtc)
                              : item.at}
                          </small>
                        </div>
                        {audit ? (
                          <div className="mt-2 space-y-2 text-xs leading-5 text-[var(--an-muted)]">
                            <p>
                              <strong className="text-[var(--an-text)]">
                                {t.changedFields}:
                              </strong>{" "}
                              {audit.changedFields.length
                                ? audit.changedFields.join(", ")
                                : t.changedFieldsStatuses[
                                    audit.changedFieldsStatus
                                  ]}
                            </p>
                            <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--an-subtle)]">
                              {audit.result ? (
                                <div>
                                  <dt className="inline font-bold">
                                    {t.result}:{" "}
                                  </dt>
                                  <dd className="inline">{audit.result}</dd>
                                </div>
                              ) : null}
                              {audit.reason ? (
                                <div>
                                  <dt className="inline font-bold">
                                    {t.reason}:{" "}
                                  </dt>
                                  <dd className="inline">{audit.reason}</dd>
                                </div>
                              ) : null}
                              {audit.version !== null ? (
                                <div>
                                  <dt className="inline font-bold">
                                    {t.version}:{" "}
                                  </dt>
                                  <dd className="inline">{audit.version}</dd>
                                </div>
                              ) : null}
                              {audit.source ? (
                                <div>
                                  <dt className="inline font-bold">
                                    {t.sourceLabel}:{" "}
                                  </dt>
                                  <dd className="inline">{audit.source}</dd>
                                </div>
                              ) : null}
                            </dl>
                            <p className="text-[10px] break-all text-[var(--an-subtle)]">
                              {t.correlation}: {audit.correlationId} ·{" "}
                              {t.hashStatus}:{" "}
                              {t.hashStatuses[audit.integrity.hashStatus]} ·{" "}
                              {t.tamperStatuses[audit.integrity.tamperStatus]}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs leading-5 text-[var(--an-muted)]">
                            {item.summary}
                          </p>
                        )}
                        <small className="mt-2 flex items-center gap-1.5 font-semibold text-[var(--an-subtle)]">
                          <CircleAlert aria-hidden="true" className="size-3" />
                          {audit ? auditActor(audit, t) : item.actor}
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : value.timelineState.status === "ready" ? (
              <p
                className="mt-5 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4 text-sm text-[var(--an-muted)]"
                data-audit-history-state="empty"
                role="status"
              >
                {t.timelineEmpty}
              </p>
            ) : (
              <p
                className="mt-5 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4 text-sm text-[var(--an-muted)]"
                data-audit-history-state={value.timelineState.status}
                role="status"
              >
                {value.timelineState.status === "denied"
                  ? t.timelineDenied
                  : t.timelineUnavailable}
              </p>
            )}
          </AdminNextCaseWorkspaceHistoryRail>
        </aside>
      </div>

      <section
        className="an-success flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-label={t.fallbackTitle}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-[var(--an-success)]"
          />
          <div>
            <h2 className="font-bold text-[var(--an-text)]">
              {t.fallbackTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--an-muted)]">
              {t.fallbackIntro}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface)] px-3 text-xs font-bold text-[var(--an-success)] hover:bg-[var(--an-soft)]"
            href={value.fallback.documentsHref}
          >
            <FolderOpen aria-hidden="true" className="size-4" />
            {t.openDocuments}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface)] px-3 text-xs font-bold text-[var(--an-success)] hover:bg-[var(--an-soft)]"
            href={value.fallback.workHref}
          >
            <ImageIcon aria-hidden="true" className="size-4" />
            {t.openWork}
          </Link>
        </div>
      </section>
    </div>
  );
}
