import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
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
  AdminNextCaseWorkspaceView,
  AdminNextEvidenceKind,
  AdminNextEvidenceState,
  AdminNextTimelineKind,
} from "@/lib/admin-next/case-workspace-contract";

const copy = {
  nb: {
    back: "Tilbake til I dag",
    case: "Sak",
    synthetic: "Syntetiske Preview-data",
    attention: "Krever oppmerksomhet",
    on_track: "På plan",
    waiting: "Venter",
    owner: "Ansvarlig",
    sla: "SLA-frist",
    today: "I dag",
    overdue: "Forsinket",
    minutes: "min",
    due_soon: "Forfaller snart",
    next: "Neste nødvendige handling",
    currentFallback: "Åpne fungerende sak",
    process: "Saksforløp",
    processIntro: "Ett felles bilde av fremdrift og blokkeringer.",
    evidence: "Dokumentasjon og bevis",
    evidenceIntro: "Alt som støtter neste beslutning, samlet på ett sted.",
    openEvidence: "Åpne i dagens løsning",
    timeline: "Tidslinje",
    timelineIntro: "Siste hendelser med kilde og tidspunkt.",
    fallbackTitle: "Fungerende Admin V2 er fortsatt tilgjengelig",
    fallbackIntro: "Preview endrer ingen kundedata og utfører ingen utsendelser.",
    openDocuments: "Dokumenter",
    openWork: "Arbeidsplan",
    stages: { inquiry: "Forespørsel", measurement: "Måling", offer: "Tilbud", contract: "Kontrakt", work: "Arbeid" },
    stageStates: { complete: "Fullført", current: "Nå", blocked: "Blokkert", upcoming: "Senere" },
    evidenceStates: { verified: "Bekreftet", review: "Må kontrolleres", missing: "Mangler" },
  },
  lt: {
    back: "Grįžti į „Šiandien“",
    case: "Byla",
    synthetic: "Sintetiniai Preview duomenys",
    attention: "Reikia dėmesio",
    on_track: "Pagal planą",
    waiting: "Laukia",
    owner: "Atsakingas",
    sla: "SLA terminas",
    today: "Šiandien",
    overdue: "Vėluoja",
    minutes: "min.",
    due_soon: "Terminas netrukus",
    next: "Kitas būtinas veiksmas",
    currentFallback: "Atidaryti veikiančią bylą",
    process: "Bylos eiga",
    processIntro: "Vienas bendras eigos ir blokavimų vaizdas.",
    evidence: "Dokumentai ir įrodymai",
    evidenceIntro: "Viskas, ko reikia kitam sprendimui, vienoje vietoje.",
    openEvidence: "Atidaryti dabartinėje sistemoje",
    timeline: "Įvykių seka",
    timelineIntro: "Naujausi įvykiai su šaltiniu ir laiku.",
    fallbackTitle: "Veikiantis Admin V2 lieka pasiekiamas",
    fallbackIntro: "Preview nekeičia klientų duomenų ir neatlieka jokių siuntimų.",
    openDocuments: "Dokumentai",
    openWork: "Darbų planas",
    stages: { inquiry: "Užklausa", measurement: "Matavimas", offer: "Pasiūlymas", contract: "Sutartis", work: "Darbai" },
    stageStates: { complete: "Baigta", current: "Dabar", blocked: "Blokuota", upcoming: "Vėliau" },
    evidenceStates: { verified: "Patvirtinta", review: "Reikia peržiūros", missing: "Trūksta" },
  },
  en: {
    back: "Back to Today",
    case: "Case",
    synthetic: "Synthetic Preview data",
    attention: "Needs attention",
    on_track: "On track",
    waiting: "Waiting",
    owner: "Owner",
    sla: "SLA deadline",
    today: "Today",
    overdue: "Overdue",
    minutes: "min",
    due_soon: "Due soon",
    next: "Next required action",
    currentFallback: "Open working case",
    process: "Case progress",
    processIntro: "One shared view of progress and blockers.",
    evidence: "Evidence and documents",
    evidenceIntro: "Everything needed for the next decision in one place.",
    openEvidence: "Open in current system",
    timeline: "Timeline",
    timelineIntro: "Latest events with source and time.",
    fallbackTitle: "Working Admin V2 remains available",
    fallbackIntro: "Preview does not change customer data or perform sends.",
    openDocuments: "Documents",
    openWork: "Work schedule",
    stages: { inquiry: "Inquiry", measurement: "Measurement", offer: "Offer", contract: "Contract", work: "Work" },
    stageStates: { complete: "Complete", current: "Now", blocked: "Blocked", upcoming: "Later" },
    evidenceStates: { verified: "Verified", review: "Needs review", missing: "Missing" },
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
  verified: "border-[#cfe4da] bg-[#f5fbf8] text-[#2f785d]",
  review: "border-[#f0ddbc] bg-[#fffbf3] text-[#805d1b]",
  missing: "border-[#edcaca] bg-[#fff7f7] text-[#a53f3f]",
};

const stageStyles: Record<AdminNextCaseStageState, string> = {
  complete: "border-[#cfe4da] bg-[#f5fbf8] text-[#2f785d]",
  current: "border-[#b8cfdf] bg-[#eaf2f8] text-[#173b58]",
  blocked: "border-[#edcaca] bg-[#fff7f7] text-[#a53f3f]",
  upcoming: "border-[#dfe4e8] bg-white text-[#778391]",
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
    return `${t.overdue} ${Math.abs(sla.remainingMinutes)} ${t.minutes}`;
  if (sla.state === "due_soon") return t.due_soon;
  return t.on_track;
}

export function AdminNextCaseWorkspace({
  locale,
  value,
}: {
  locale: PanelLocale;
  value: AdminNextCaseWorkspaceView;
}) {
  const t = copy[locale];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5" data-admin-next-section="cases">
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#4f6071] hover:bg-white hover:text-[#183b58]" href="/admin-next-preview/today">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t.back}
      </Link>

      <header className="overflow-hidden rounded-3xl border border-[#dfe4e8] bg-white shadow-[0_8px_28px_rgba(18,38,57,.05)]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#edcaca] bg-[#fff7f7] px-2.5 py-1 text-[11px] font-bold text-[#a53f3f]">
                {statusLabel(value.status, t)}
              </span>
              <span className="rounded-full border border-[#ead9ae] bg-[#fff8e7] px-2.5 py-1 text-[11px] font-bold text-[#6c5219]">
                {t.synthetic}
              </span>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#607286]">{t.case} {value.reference}</p>
            <h1 className="mt-2 truncate text-2xl font-bold tracking-[-.025em] text-[#152333] sm:text-3xl">{value.customer}</h1>
            <p className="mt-2 flex items-start gap-2 text-sm text-[#687585]">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {value.address} · {value.service}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 lg:min-w-[350px]">
            <div className="rounded-2xl border border-[#dfe4e8] bg-[#f7f8f9] p-4">
              <dt className="flex items-center gap-2 text-xs font-bold text-[#6a7785]"><UserRound aria-hidden="true" className="size-4" />{t.owner}</dt>
              <dd className="mt-2 text-sm font-bold text-[#1d2d3d]">{value.owner.name}</dd>
              <dd className="mt-1 text-xs text-[#768290]">{value.owner.team}</dd>
            </div>
            <div className="rounded-2xl border border-[#edcaca] bg-[#fff7f7] p-4">
              <dt className="flex items-center gap-2 text-xs font-bold text-[#8c5555]"><Clock3 aria-hidden="true" className="size-4" />{t.sla}</dt>
              <dd className="mt-2 text-sm font-bold text-[#9b3737]">{t.today} {value.sla.deadline}</dd>
              <dd className="mt-1 text-xs font-semibold text-[#a95252]">{slaLabel(value.sla, t)}</dd>
            </div>
          </dl>
        </div>

        <section className="border-t border-[#e5e9ed] bg-[#f8fafb] p-5 sm:p-6 lg:flex lg:items-center lg:justify-between lg:gap-6" aria-labelledby="case-next-action-title">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9b3e3e]">{t.next}</p>
            <h2 className="mt-2 text-xl font-bold text-[#182939]" id="case-next-action-title">{value.nextAction.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-[#657281]">{value.nextAction.reason}</p>
          </div>
          <Link className="mt-4 inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#183b58] px-5 text-sm font-bold text-white hover:bg-[#244e6e] sm:w-auto lg:mt-0" href={value.fallback.caseHref}>
            {t.currentFallback}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      </header>

      <section className="rounded-3xl border border-[#dfe4e8] bg-white p-5 shadow-[0_8px_28px_rgba(18,38,57,.04)] sm:p-6" aria-labelledby="case-progress-title">
        <h2 className="text-lg font-bold text-[#172637]" id="case-progress-title">{t.process}</h2>
        <p className="mt-1 text-sm text-[#6a7684]">{t.processIntro}</p>
        <ol className="mt-5 grid min-w-0 grid-cols-5 gap-2 overflow-x-auto pb-1">
          {value.stages.map((stage, index) => (
            <li className={`min-w-[8rem] rounded-2xl border p-3 ${stageStyles[stage.state]}`} key={stage.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-white/80 text-xs font-black">{stage.state === "complete" ? <Check aria-hidden="true" className="size-4" /> : index + 1}</span>
                <small className="text-[10px] font-bold uppercase tracking-wider">{t.stageStates[stage.state]}</small>
              </div>
              <strong className="mt-3 block text-xs sm:text-sm">{t.stages[stage.id as AdminNextCaseStageId]}</strong>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <section className="min-w-0 rounded-3xl border border-[#dfe4e8] bg-white p-5 shadow-[0_8px_28px_rgba(18,38,57,.05)] sm:p-6" aria-labelledby="case-evidence-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#172637]" id="case-evidence-title">{t.evidence}</h2>
              <p className="mt-1 text-sm text-[#6a7684]">{t.evidenceIntro}</p>
            </div>
            <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-[#3e8a6c]" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {value.evidence.map((item) => {
              const Icon = evidenceIcons[item.kind];
              return (
                <article className="flex min-h-56 flex-col rounded-2xl border border-[#dfe4e8] bg-[#fbfcfc] p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#eaf2f8] text-[#315675]"><Icon aria-hidden="true" className="size-5" /></span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${evidenceStateStyles[item.state]}`}>{t.evidenceStates[item.state]}</span>
                  </div>
                  <h3 className="mt-4 font-bold text-[#1d2d3d]">{item.title}</h3>
                  <p className="mt-2 text-sm text-[#687585]">{item.summary}</p>
                  {item.metric ? <strong className="mt-3 block text-sm text-[#315675]">{item.metric}</strong> : null}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <small className="text-[#85909b]">{item.recordedAt}</small>
                    <Link aria-label={`${t.openEvidence}: ${item.title}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[#315675] hover:bg-[#eaf2f8]" href={item.fallbackHref}>
                      {t.openEvidence}<ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="min-w-0 rounded-3xl border border-[#dfe4e8] bg-white p-5 shadow-[0_8px_28px_rgba(18,38,57,.05)] sm:p-6" aria-labelledby="case-timeline-title">
          <h2 className="text-lg font-bold text-[#172637]" id="case-timeline-title">{t.timeline}</h2>
          <p className="mt-1 text-sm text-[#6a7684]">{t.timelineIntro}</p>
          <ol className="mt-6 space-y-0">
            {value.timeline.map((item, index) => {
              const Icon = timelineIcons[item.kind];
              return (
                <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0" key={item.id}>
                  {index < value.timeline.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-5 top-10 w-px bg-[#dfe4e8]" /> : null}
                  <span className="relative z-10 grid size-10 place-items-center rounded-xl border border-[#d8e2e9] bg-[#f4f8fa] text-[#315675]"><Icon aria-hidden="true" className="size-[18px]" /></span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-sm text-[#243546]">{item.title}</strong>
                      <small className="shrink-0 text-[#84909c]">{item.at}</small>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#6b7886]">{item.summary}</p>
                    <small className="mt-2 flex items-center gap-1.5 font-semibold text-[#536779]"><CircleAlert aria-hidden="true" className="size-3" />{item.actor}</small>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <section className="flex flex-col gap-4 rounded-3xl border border-[#cfe4da] bg-[#f5fbf8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-label={t.fallbackTitle}>
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#3e8a6c]" />
          <div>
            <h2 className="font-bold text-[#2e6f58]">{t.fallbackTitle}</h2>
            <p className="mt-1 text-sm text-[#587367]">{t.fallbackIntro}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#bdd8cc] bg-white px-3 text-xs font-bold text-[#315f50] hover:bg-[#edf7f2]" href={value.fallback.documentsHref}><FolderOpen aria-hidden="true" className="size-4" />{t.openDocuments}</Link>
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#bdd8cc] bg-white px-3 text-xs font-bold text-[#315f50] hover:bg-[#edf7f2]" href={value.fallback.workHref}><ImageIcon aria-hidden="true" className="size-4" />{t.openWork}</Link>
        </div>
      </section>
    </div>
  );
}
