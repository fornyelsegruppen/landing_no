import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  adminNextTodayTasks,
  filterAdminNextTodayTasks,
  type AdminNextTaskPriority,
  type AdminNextTodayView,
} from "@/lib/admin-next/today-fixture";

const copy = {
  nb: {
    eyebrow: "Mandag 1. september",
    title: "God dag. Her er det som trenger oppmerksomhet.",
    intro: "Prioritert etter frist, risiko og neste nødvendige handling.",
    synthetic: "Design Preview — bare syntetiske data",
    filters: "Filtrer arbeidskø",
    views: { all: "Alle", overdue: "Forsinket", mine: "Mine", waiting: "Venter" },
    metrics: [
      ["12", "Handlinger i dag"],
      ["3", "Forsinket"],
      ["5", "Besøk neste 72 t"],
      ["2", "Venter på kunde"],
    ],
    queue: "Min arbeidskø",
    queueIntro: "Én tydelig neste handling per sak.",
    open: "Åpne sak",
    owner: "Ansvarlig",
    due: "Frist",
    empty: "Ingen saker i denne visningen.",
    upcoming: "Neste 72 timer",
    automation: "Automatisering",
    paused: "Eksterne utsendelser er satt på pause",
    fallback: "Dagens Admin V2 er tilgjengelig som fallback",
    allWork: "Åpne arbeidsplan",
    stages: { measurement: "Måling", offer: "Tilbud", documents: "Dokumenter", visit: "Besøk" },
    actions: { reviewMeasurement: "Kontroller R4-målingen", approveOffer: "Godkjenn prisendringen", sendDocuments: "Fullfør dokumentpakken", confirmVisit: "Bekreft morgendagens besøk" },
    reasons: { lowConfidence: "Målingens confidence er 82 %", priceChanged: "Prisen er endret med 6,4 %", missingSignature: "Kundens signatur mangler", visitTomorrow: "Kunden venter på tidsbekreftelse" },
  },
  lt: {
    eyebrow: "Pirmadienis, rugsėjo 1 d.",
    title: "Laba diena. Štai kam šiandien reikia dėmesio.",
    intro: "Surikiuota pagal terminą, riziką ir kitą būtiną veiksmą.",
    synthetic: "Dizaino Preview — tik sintetiniai duomenys",
    filters: "Filtruoti darbo eilę",
    views: { all: "Visi", overdue: "Vėluoja", mine: "Mano", waiting: "Laukia" },
    metrics: [
      ["12", "Veiksmų šiandien"],
      ["3", "Vėluoja"],
      ["5", "Vizitai per 72 val."],
      ["2", "Laukia kliento"],
    ],
    queue: "Mano darbo eilė",
    queueIntro: "Vienas aiškus kitas veiksmas kiekvienai bylai.",
    open: "Atidaryti bylą",
    owner: "Atsakingas",
    due: "Terminas",
    empty: "Šiame vaizde bylų nėra.",
    upcoming: "Kitos 72 valandos",
    automation: "Automatizacija",
    paused: "Išoriniai automatiniai siuntimai pristabdyti",
    fallback: "Dabartinis Admin V2 veikia kaip atsarginis kelias",
    allWork: "Atidaryti darbų planą",
    stages: { measurement: "Matavimas", offer: "Pasiūlymas", documents: "Dokumentai", visit: "Vizitas" },
    actions: { reviewMeasurement: "Patikrinti R4 matavimą", approveOffer: "Patvirtinti kainos pakeitimą", sendDocuments: "Užbaigti dokumentų paketą", confirmVisit: "Patvirtinti rytojaus vizitą" },
    reasons: { lowConfidence: "Matavimo confidence yra 82 %", priceChanged: "Kaina pasikeitė 6,4 %", missingSignature: "Trūksta kliento parašo", visitTomorrow: "Klientas laukia laiko patvirtinimo" },
  },
  en: {
    eyebrow: "Monday, September 1",
    title: "Good day. Here is what needs attention.",
    intro: "Prioritized by deadline, risk and the next required action.",
    synthetic: "Design Preview — synthetic data only",
    filters: "Filter work queue",
    views: { all: "All", overdue: "Overdue", mine: "Mine", waiting: "Waiting" },
    metrics: [["12", "Actions today"], ["3", "Overdue"], ["5", "Visits in 72h"], ["2", "Waiting for customer"]],
    queue: "My work queue",
    queueIntro: "One clear next action for every case.",
    open: "Open case",
    owner: "Owner",
    due: "Due",
    empty: "No cases in this view.",
    upcoming: "Next 72 hours",
    automation: "Automation",
    paused: "External automated sends are paused",
    fallback: "Current Admin V2 remains available as fallback",
    allWork: "Open work schedule",
    stages: { measurement: "Measurement", offer: "Offer", documents: "Documents", visit: "Visit" },
    actions: { reviewMeasurement: "Review the R4 measurement", approveOffer: "Approve the price change", sendDocuments: "Complete the document package", confirmVisit: "Confirm tomorrow's visit" },
    reasons: { lowConfidence: "Measurement confidence is 82%", priceChanged: "Price changed by 6.4%", missingSignature: "Customer signature is missing", visitTomorrow: "Customer is waiting for time confirmation" },
  },
} as const;

const priorityStyle: Record<AdminNextTaskPriority, { dot: string; label: string }> = {
  critical: { dot: "bg-[#c84f4f]", label: "border-[#edcaca] bg-[#fff7f7]" },
  today: { dot: "bg-[#db8d18]", label: "border-[#f0ddbc] bg-[#fffbf3]" },
  waiting: { dot: "bg-[#6a70b8]", label: "border-[#d9daf0] bg-[#f8f8fd]" },
  scheduled: { dot: "bg-[#3e8a6c]", label: "border-[#cfe4da] bg-[#f5fbf8]" },
};

export function AdminNextToday({ locale, view }: { locale: PanelLocale; view: AdminNextTodayView }) {
  const t = copy[locale];
  const tasks = filterAdminNextTodayTasks(adminNextTodayTasks, view);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#607286]">{t.eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-.025em] text-[#152333] sm:text-3xl lg:text-[2rem]">{t.title}</h1>
          <p className="mt-2 text-sm text-[#657181] sm:text-base">{t.intro}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ead9ae] bg-[#fff8e7] px-3 py-2 text-xs font-bold text-[#6c5219]">
          <Sparkles aria-hidden="true" className="size-4" />
          {t.synthetic}
        </span>
      </section>

      <section aria-label={t.queue} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {t.metrics.map(([value, label], index) => (
          <article className="rounded-2xl border border-[#dfe4e8] bg-white p-4 shadow-[0_1px_2px_rgba(18,38,57,.04)] sm:p-5" key={label}>
            <div className="flex items-start justify-between gap-3">
              <strong className="text-2xl font-bold tracking-tight text-[#152333] sm:text-3xl">{value}</strong>
              {index === 1 ? <AlertCircle aria-hidden="true" className="size-5 text-[#c84f4f]" /> : index === 2 ? <CalendarClock aria-hidden="true" className="size-5 text-[#4e7390]" /> : <CheckCircle2 aria-hidden="true" className="size-5 text-[#3e8a6c]" />}
            </div>
            <p className="mt-2 text-xs font-semibold text-[#687585] sm:text-sm">{label}</p>
          </article>
        ))}
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 rounded-3xl border border-[#dfe4e8] bg-white shadow-[0_8px_28px_rgba(18,38,57,.05)]" aria-labelledby="today-queue-title">
          <header className="border-b border-[#e5e9ed] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#152333] sm:text-xl" id="today-queue-title">{t.queue}</h2>
                <p className="mt-1 text-sm text-[#6a7684]">{t.queueIntro}</p>
              </div>
              <nav aria-label={t.filters} className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#f1f4f6] p-1">
                {(Object.keys(t.views) as AdminNextTodayView[]).map((key) => (
                  <Link aria-current={view === key ? "page" : undefined} className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${view === key ? "bg-white text-[#173b58] shadow-sm" : "text-[#667483] hover:text-[#17202b]"}`} href={`/admin-next-preview/today?view=${key}`} key={key}>
                    {t.views[key]}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          {tasks.length ? (
            <div className="divide-y divide-[#e8ecef]">
              {tasks.map((task) => (
                <article className="group relative p-4 transition hover:bg-[#fafbfc] sm:p-5" key={task.id}>
                  <span className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${priorityStyle[task.priority].dot}`} />
                  <div className="grid min-w-0 gap-4 pl-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${priorityStyle[task.priority].label}`}>
                          <span className={`size-1.5 rounded-full ${priorityStyle[task.priority].dot}`} />
                          {t.stages[task.stage]}
                        </span>
                        <span className="text-xs font-bold text-[#788493]">{task.id}</span>
                      </div>
                      <h3 className="mt-3 truncate text-base font-bold text-[#172637] sm:text-lg">{t.actions[task.action]}</h3>
                      <p className="mt-1 truncate text-sm font-semibold text-[#526172]">{task.customer}</p>
                      <p className="mt-1 truncate text-xs text-[#798593]">{task.address}</p>
                      <p className="mt-3 flex items-start gap-2 text-sm text-[#76571b]">
                        <CircleDot aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        {t.reasons[task.reason]}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <div className="mr-auto flex gap-4 text-xs text-[#6c7886] lg:mr-3 lg:block lg:min-w-24 lg:text-right">
                        <span className="flex items-center gap-1.5 lg:justify-end"><Clock3 aria-hidden="true" className="size-3.5" />{t.due} {task.due}</span>
                        <span className="mt-0 lg:mt-1.5 flex items-center gap-1.5 lg:justify-end"><UserRound aria-hidden="true" className="size-3.5" />{task.owner}</span>
                      </div>
                      <Link className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#183b58] px-4 text-sm font-bold text-white transition hover:bg-[#244e6e] sm:flex-none" href={task.href}>
                        {t.open}
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-[#6b7886]">{t.empty}</p>
          )}
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-3xl border border-[#dfe4e8] bg-white p-5 shadow-[0_8px_28px_rgba(18,38,57,.05)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-[#172637]">{t.upcoming}</h2>
              <CalendarClock aria-hidden="true" className="size-5 text-[#527896]" />
            </div>
            <ol className="mt-4 space-y-4">
              {[["08:00", "Demo · Takvask", "Oslo"], ["11:30", "Demo · Befaring", "Bærum"], ["14:00", "Demo · Sluttkontroll", "Asker"]].map(([time, title, place]) => (
                <li className="grid grid-cols-[3rem_1fr] gap-3" key={`${time}-${title}`}>
                  <strong className="text-xs text-[#315675]">{time}</strong>
                  <span className="border-l border-[#dce3e8] pl-3">
                    <strong className="block text-sm text-[#263647]">{title}</strong>
                    <small className="mt-0.5 block text-[#758190]">{place}</small>
                  </span>
                </li>
              ))}
            </ol>
            <Link className="mt-5 flex min-h-11 items-center justify-between rounded-xl border border-[#dce2e7] px-3 text-sm font-bold text-[#264c69] hover:bg-[#f5f8fa]" href="/admin-v2/work">
              {t.allWork}<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </section>

          <section className="rounded-3xl border border-[#d9e5dd] bg-[#f7fbf8] p-5">
            <div className="flex items-center gap-2 text-[#2f7458]">
              <CheckCircle2 aria-hidden="true" className="size-5" />
              <h2 className="font-bold">{t.automation}</h2>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#355746]">{t.paused}</p>
            <p className="mt-2 text-xs leading-5 text-[#607369]">{t.fallback}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
