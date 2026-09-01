import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  HardHat,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Route,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  adminNextFieldVisitStates,
  type AdminNextFieldVisitView,
} from "@/lib/admin-next/field-visit-contract";
import { adminNextDarkThemeCss } from "@/lib/admin-next/design-tokens";

const copy = {
  lt: {
    product: "Takfornyelse · Darbuotojui",
    preview: "Saugi Preview · būsena nekeičiama",
    states: { assigned: "Priskirta", on_way: "Vykstu", onsite: "Objekte", in_progress: "Darbas vyksta" },
    stateHelp: {
      assigned: "Patikrinkite užduotį ir pasiruošimą prieš išvykdami.",
      on_way: "Maršrutas aktyvus. Atvykimą patvirtinkite tik objekte.",
      onsite: "Atvykimas užfiksuotas. Užbaikite patikrą prieš pradėdami.",
      in_progress: "Darbas pradėtas. Rinkite privalomus įrodymus realiu laiku.",
    },
    job: "Šiandienos vizitas",
    synthetic: "Sintetiniai duomenys",
    planned: "Planuota",
    window: "Atvykimo langas",
    distance: "Atstumas",
    stateSince: "Būsena nuo",
    navigate: "Maršrutas",
    call: "Skambinti",
    message: "Žinutė",
    previewAction: "Preview veiksmas išjungtas",
    readiness: "Pasiruošimas",
    readinessHelp: "Visi punktai tikrinami prieš leidžiant pradėti darbą.",
    checklist: { address: "Adresas ir kontaktas", scope: "Darbų apimtis", safety: "Sauga ir prieiga", equipment: "Įranga bei medžiagos" },
    evidence: "Privalomi įrodymai",
    evidenceHelp: "Nuotraukos susiejamos su vizitu, etapu ir laiku.",
    evidenceItems: { before: "Prieš darbus", during: "Darbo metu", after: "Po darbų" },
    eta: "Numatomas atvykimas",
    minutes: "min.",
    arrivedAt: "Atvykimas užfiksuotas 08:24",
    onsiteGate: "Iki darbo pradžios trūksta saugos patikros ir 2 nuotraukų.",
    workTimer: "Darbo trukmė",
    elapsed: "00:46",
    completion: "Baigimo vartai",
    gates: { photos: "Visos privalomos nuotraukos", checklist: "Patikros sąrašas", notes: "Baigiamoji pastaba", customer_handover: "Perdavimas klientui" },
    gateStates: { verified: "Patvirtinta", required: "Reikia atlikti", locked: "Užrakinta" },
    next: "Kitas saugus veiksmas",
    primary: { assigned: "Pradėti kelionę", on_way: "Patvirtinti atvykimą", onsite: "Pradėti darbą", in_progress: "Baigti darbą" },
    locked: "Preview nekeičia canonical būsenos. Veiksmą atlikite veikiančiame darbuotojo portale.",
    fallback: "Atidaryti veikiantį portalą",
  },
  nb: {
    product: "Takfornyelse · Ansatt",
    preview: "Sikker Preview · status endres ikke",
    states: { assigned: "Tildelt", on_way: "På vei", onsite: "På stedet", in_progress: "Arbeid pågår" },
    stateHelp: { assigned: "Kontroller oppdraget før avreise.", on_way: "Ruten er aktiv. Bekreft ankomst på stedet.", onsite: "Ankomst er registrert. Fullfør kontrollen før start.", in_progress: "Arbeidet er startet. Samle obligatorisk dokumentasjon." },
    job: "Dagens besøk", synthetic: "Syntetiske data", planned: "Planlagt", window: "Ankomstvindu", distance: "Avstand", stateSince: "Status siden", navigate: "Rute", call: "Ring", message: "Melding", previewAction: "Preview-handling er deaktivert", readiness: "Forberedelse", readinessHelp: "Alle punkter kontrolleres før arbeidet kan starte.",
    checklist: { address: "Adresse og kontakt", scope: "Arbeidsomfang", safety: "Sikkerhet og adkomst", equipment: "Utstyr og materialer" }, evidence: "Obligatorisk dokumentasjon", evidenceHelp: "Bilder knyttes til besøk, fase og tidspunkt.", evidenceItems: { before: "Før arbeid", during: "Under arbeid", after: "Etter arbeid" }, eta: "Forventet ankomst", minutes: "min", arrivedAt: "Ankomst registrert 08:24", onsiteGate: "Sikkerhetskontroll og 2 bilder mangler før start.", workTimer: "Arbeidstid", elapsed: "00:46", completion: "Ferdigstillingsporter", gates: { photos: "Alle obligatoriske bilder", checklist: "Kontrolliste", notes: "Sluttnotat", customer_handover: "Overlevering til kunde" }, gateStates: { verified: "Bekreftet", required: "Må utføres", locked: "Låst" }, next: "Neste sikre handling", primary: { assigned: "Start reisen", on_way: "Bekreft ankomst", onsite: "Start arbeidet", in_progress: "Fullfør arbeidet" }, locked: "Preview endrer ikke canonical status. Utfør handlingen i den aktive ansattportalen.", fallback: "Åpne aktiv portal",
  },
  en: {
    product: "Takfornyelse · Worker", preview: "Safe Preview · state is not changed", states: { assigned: "Assigned", on_way: "On my way", onsite: "On site", in_progress: "Work in progress" }, stateHelp: { assigned: "Review the assignment before departure.", on_way: "Route active. Confirm arrival only on site.", onsite: "Arrival recorded. Complete checks before starting.", in_progress: "Work started. Collect mandatory evidence as you go." }, job: "Today’s visit", synthetic: "Synthetic data", planned: "Planned", window: "Arrival window", distance: "Distance", stateSince: "State since", navigate: "Route", call: "Call", message: "Message", previewAction: "Preview action disabled", readiness: "Readiness", readinessHelp: "Every item is checked before work can start.", checklist: { address: "Address and contact", scope: "Scope of work", safety: "Safety and access", equipment: "Equipment and materials" }, evidence: "Required evidence", evidenceHelp: "Photos are tied to the visit, phase and time.", evidenceItems: { before: "Before work", during: "During work", after: "After work" }, eta: "Estimated arrival", minutes: "min", arrivedAt: "Arrival recorded 08:24", onsiteGate: "Safety check and 2 photos remain before start.", workTimer: "Work duration", elapsed: "00:46", completion: "Completion gates", gates: { photos: "All required photos", checklist: "Checklist", notes: "Completion note", customer_handover: "Customer handover" }, gateStates: { verified: "Verified", required: "Required", locked: "Locked" }, next: "Next safe action", primary: { assigned: "Start journey", on_way: "Confirm arrival", onsite: "Start work", in_progress: "Finish work" }, locked: "Preview does not change canonical state. Perform this action in the active worker portal.", fallback: "Open active portal",
  },
} as const;

const stateIcons = {
  assigned: BriefcaseBusiness,
  on_way: Navigation,
  onsite: MapPin,
  in_progress: HardHat,
} as const;

const gateStyle = {
  verified: "border-[color:rgba(103,217,170,.3)] bg-[var(--an-success-soft)] text-[var(--an-success)]",
  required: "border-[color:rgba(244,182,63,.35)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]",
  locked: "border-[var(--an-border)] bg-[var(--an-soft)] text-[var(--an-subtle)]",
} as const;

export function AdminNextFieldVisit({
  locale,
  visit,
  stateHrefBase,
}: {
  locale: PanelLocale;
  visit: AdminNextFieldVisitView;
  stateHrefBase: string;
}) {
  const t = copy[locale];
  const activeIndex = adminNextFieldVisitStates.indexOf(visit.state);
  const evidenceCompleted = visit.evidence.reduce((sum, item) => sum + item.completed, 0);
  const evidenceRequired = visit.evidence.reduce((sum, item) => sum + item.required, 0);
  const StateIcon = stateIcons[visit.state];

  return (
    <div className="admin-next-theme min-h-dvh bg-[var(--an-canvas)] pb-28 text-[var(--an-text)] lg:pb-8">
      <style>{adminNextDarkThemeCss}</style>
      <header className="sticky top-0 z-40 border-b border-[var(--an-border)] bg-[color:rgba(11,17,24,.96)] backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1180px] items-center gap-3 px-4 lg:px-6">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--an-amber)] text-xs font-black text-[var(--an-amber-ink)]">TF</span>
          <div className="min-w-0">
            <strong className="block truncate text-sm">{t.product}</strong>
            <small className="block truncate text-[11px] text-[var(--an-muted)]">{visit.worker.name}</small>
          </div>
          <span className="ml-auto hidden rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-3 py-1.5 text-xs font-bold text-[var(--an-amber)] sm:inline-flex">{t.preview}</span>
          <span className="grid size-9 place-items-center rounded-full bg-[var(--an-soft)] text-xs font-black text-[var(--an-amber)]">{visit.worker.initials}</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-5 px-4 py-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6 lg:py-7">
        <aside className="an-surface hidden h-fit rounded-3xl border p-4 lg:block">
          <p className="px-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--an-amber)]">{t.job}</p>
          <nav aria-label={t.job} className="mt-4 grid gap-1">
            {adminNextFieldVisitStates.map((state, index) => {
              const Icon = stateIcons[state];
              const active = state === visit.state;
              const complete = index < activeIndex;
              return (
                <Link aria-current={active ? "step" : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 text-sm font-bold ${active ? "border-[color:rgba(244,182,63,.4)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]" : "border-transparent text-[var(--an-muted)] hover:bg-[var(--an-soft)]"}`} href={`${stateHrefBase}?state=${state}`} key={state}>
                  <span className={`grid size-8 place-items-center rounded-lg ${complete ? "bg-[var(--an-success-soft)] text-[var(--an-success)]" : "bg-[var(--an-soft)]"}`}><Icon aria-hidden="true" className="size-4" /></span>
                  {t.states[state]}
                  {complete ? <Check aria-hidden="true" className="ml-auto size-4 text-[var(--an-success)]" /> : null}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4">
            <p className="text-xs text-[var(--an-muted)]">{t.evidence}</p>
            <strong className="mt-1 block text-2xl">{evidenceCompleted}/{evidenceRequired}</strong>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--an-soft)]"><span className="block h-full rounded-full bg-[var(--an-amber)]" style={{ width: `${Math.round((evidenceCompleted / evidenceRequired) * 100)}%` }} /></div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <nav aria-label={t.job} className="grid grid-cols-4 gap-1 lg:hidden">
            {adminNextFieldVisitStates.map((state, index) => {
              const Icon = stateIcons[state];
              const active = state === visit.state;
              return (
                <Link aria-current={active ? "step" : undefined} aria-label={t.states[state]} className={`grid min-h-16 content-center place-items-center gap-1 rounded-xl border px-1 text-[10px] font-bold ${active ? "border-[color:rgba(244,182,63,.45)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]" : index < activeIndex ? "border-[color:rgba(103,217,170,.25)] bg-[var(--an-success-soft)] text-[var(--an-success)]" : "border-[var(--an-border)] bg-[var(--an-surface)] text-[var(--an-subtle)]"}`} href={`${stateHrefBase}?state=${state}`} key={state}>
                  <Icon aria-hidden="true" className="size-4" />
                  <span className="max-w-full truncate text-[9px] leading-none">{t.states[state]}</span>
                </Link>
              );
            })}
          </nav>

          <section className="an-surface overflow-hidden rounded-3xl border" aria-labelledby="field-visit-title">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(244,182,63,.35)] bg-[var(--an-amber-soft)] px-3 py-1.5 text-xs font-bold text-[var(--an-amber)]"><StateIcon aria-hidden="true" className="size-4" />{t.states[visit.state]}</span>
                <span className="rounded-full border border-[var(--an-border)] bg-[var(--an-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--an-muted)]">{t.synthetic}</span>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[var(--an-amber)]">{visit.reference} · {visit.caseReference}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-.025em] sm:text-3xl" id="field-visit-title">{visit.customer}</h1>
              <p className="mt-2 flex gap-2 text-sm text-[var(--an-muted)]"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{visit.address}</p>
              <p className="mt-3 text-sm font-semibold text-[var(--an-text)]">{visit.service}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--an-muted)]">{t.stateHelp[visit.state]}</p>
            </div>
            <dl className="grid grid-cols-2 border-t border-[var(--an-border)] bg-[var(--an-elevated)] sm:grid-cols-4">
              {[[t.planned, visit.scheduledAt], [t.window, visit.arrivalWindow], [t.distance, `${visit.distanceKilometers.toLocaleString(locale)} km`], [t.stateSince, visit.stateChangedAt]].map(([label, value]) => (
                <div className="border-b border-r border-[var(--an-border)] p-3.5 last:border-r-0 sm:border-b-0" key={label}><dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--an-subtle)]">{label}</dt><dd className="mt-1.5 text-xs font-bold sm:text-sm">{value}</dd></div>
              ))}
            </dl>
          </section>

          <section className="grid grid-cols-3 gap-2" aria-label={t.previewAction}>
            {[[Navigation, t.navigate], [Phone, t.call], [MessageCircle, t.message]].map(([Icon, label]) => {
              const ActionIcon = Icon as typeof Navigation;
              return <button className="an-disabled grid min-h-16 cursor-not-allowed place-items-center rounded-2xl border px-2 text-xs font-bold" disabled key={label as string} title={t.previewAction} type="button"><ActionIcon aria-hidden="true" className="size-5" /><span>{label as string}</span></button>;
            })}
          </section>

          {visit.state === "on_way" ? (
            <section className="rounded-3xl border border-[color:rgba(111,181,232,.32)] bg-[color:rgba(111,181,232,.09)] p-5" aria-labelledby="visit-eta-title">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[color:rgba(111,181,232,.13)] text-[var(--an-info)]"><Route aria-hidden="true" className="size-5" /></span><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--an-info)]" id="visit-eta-title">{t.eta}</p><strong className="mt-1 block text-2xl">{visit.etaMinutes} {t.minutes}</strong></div></div>
            </section>
          ) : null}

          {visit.state === "onsite" ? <div className="an-success flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold"><CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />{t.arrivedAt}</div> : null}

          {visit.state === "in_progress" ? (
            <section className="an-surface flex items-center justify-between rounded-3xl border p-5" aria-label={t.workTimer}>
              <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--an-muted)]">{t.workTimer}</p><strong className="mt-1 block text-3xl tracking-tight">{t.elapsed}</strong></div><span className="grid size-14 place-items-center rounded-2xl bg-[var(--an-amber-soft)] text-[var(--an-amber)]"><Timer aria-hidden="true" className="size-7" /></span>
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="an-surface rounded-3xl border p-5" aria-labelledby="visit-readiness-title">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold" id="visit-readiness-title">{t.readiness}</h2><p className="mt-1 text-xs leading-5 text-[var(--an-muted)]">{t.readinessHelp}</p></div><ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-[var(--an-amber)]" /></div>
              <ol className="mt-4 grid gap-2">
                {visit.checklist.map((item) => (
                  <li className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] px-3" key={item.id}>
                    <span className={`grid size-6 place-items-center rounded-full ${item.state === "complete" ? "bg-[var(--an-success-soft)] text-[var(--an-success)]" : item.state === "current" ? "bg-[var(--an-amber-soft)] text-[var(--an-amber)]" : "bg-[var(--an-soft)] text-[var(--an-subtle)]"}`}>{item.state === "complete" ? <Check aria-hidden="true" className="size-3.5" /> : item.state === "locked" ? <LockKeyhole aria-hidden="true" className="size-3" /> : <Circle aria-hidden="true" className="size-3" />}</span>
                    <span className="text-xs font-semibold">{t.checklist[item.id]}</span>
                  </li>
                ))}
              </ol>
              {visit.state === "onsite" ? <p className="mt-3 flex gap-2 rounded-xl bg-[var(--an-amber-soft)] p-3 text-xs leading-5 text-[var(--an-amber)]"><TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{t.onsiteGate}</p> : null}
            </section>

            <section className="an-surface rounded-3xl border p-5" aria-labelledby="visit-evidence-title">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold" id="visit-evidence-title">{t.evidence}</h2><p className="mt-1 text-xs leading-5 text-[var(--an-muted)]">{t.evidenceHelp}</p></div><Camera aria-hidden="true" className="size-5 shrink-0 text-[var(--an-amber)]" /></div>
              <div className="mt-4 grid gap-3">
                {visit.evidence.map((item) => {
                  const percent = Math.round((item.completed / item.required) * 100);
                  return <article className="rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-3" key={item.id}><div className="flex items-center justify-between gap-3 text-xs"><strong>{t.evidenceItems[item.id]}</strong><span className={item.completed === item.required ? "text-[var(--an-success)]" : "text-[var(--an-amber)]"}>{item.completed}/{item.required}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--an-soft)]"><span className={`block h-full rounded-full ${item.completed === item.required ? "bg-[var(--an-success)]" : "bg-[var(--an-amber)]"}`} style={{ width: `${percent}%` }} /></div></article>;
                })}
              </div>
            </section>
          </div>

          {visit.state === "in_progress" ? (
            <section className="an-surface rounded-3xl border p-5" aria-labelledby="visit-gates-title">
              <h2 className="font-bold" id="visit-gates-title">{t.completion}</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {visit.completionGates.map((gate) => <article className={`flex items-center gap-3 rounded-xl border p-3 ${gateStyle[gate.state]}`} key={gate.id}>{gate.state === "verified" ? <CheckCircle2 aria-hidden="true" className="size-4" /> : gate.state === "locked" ? <LockKeyhole aria-hidden="true" className="size-4" /> : <TriangleAlert aria-hidden="true" className="size-4" />}<div><strong className="block text-xs">{t.gates[gate.id]}</strong><small className="mt-0.5 block opacity-80">{t.gateStates[gate.state]}</small></div></article>)}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--an-border)] bg-[color:rgba(11,17,24,.97)] px-3 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:sticky lg:px-6">
        <div className="mx-auto flex max-w-[1180px] items-center gap-2 lg:justify-end">
          <div className="mr-auto hidden min-w-0 lg:block"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--an-amber)]">{t.next}</p><p className="mt-1 truncate text-xs text-[var(--an-muted)]">{t.locked}</p></div>
          <Link className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface)] px-3 text-xs font-bold text-[var(--an-text)] lg:flex-none" href={visit.fallbackHref}>{t.fallback}<ArrowRight aria-hidden="true" className="size-4" /></Link>
          <button className="an-cta inline-flex min-h-12 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl px-3 text-xs font-black opacity-70 lg:flex-none" disabled title={t.locked} type="button"><LockKeyhole aria-hidden="true" className="size-4" />{t.primary[visit.state]}<ChevronRight aria-hidden="true" className="size-4" /></button>
        </div>
      </footer>
    </div>
  );
}
