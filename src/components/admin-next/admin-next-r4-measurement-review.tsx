import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  Database,
  Fingerprint,
  Layers3,
  LockKeyhole,
  Ruler,
  ShieldAlert,
  Target,
  X,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type { AdminNextCaseWorkspaceView } from "@/lib/admin-next/case-workspace-contract";

type MeasurementReview = NonNullable<AdminNextCaseWorkspaceView["measurementReview"]>;
type Gate = MeasurementReview["verificationGates"][number];

const copy = {
  nb: {
    close: "Lukk målingskontroll", eyebrow: "R4 målingskontroll", synthetic: "Syntetiske Preview-data", status: "2 kanter må kontrolleres", title: "Takplan og verification gates", intro: "Kontroller exact R4-evidence i sakskontekst før Confirm.", area: "Takareal", confidence: "Confidence", planes: "Flater", edges: "Review", plan: "Takplan", planHelp: "Fire hovedflater. Markerte linjer viser E-04 og E-11.", pitch: "Helning", perimeter: "Omkrets", photos: "Bilder og kilder", delta: "Endret fra R3", deltaArea: "areal", deltaConfidence: "confidence", deltaPlanes: "flate", gates: "Verification gates", provenance: "Evidence provenance", next: "Neste handling", confirm: "Confirm R4", confirmDisabled: "Confirm er låst til E-04 og E-11 er kontrollert i canonical approval-flow.", fallback: "Åpne fungerende måleflyt", gateLabels: { source_identity: "Kildeidentitet", plane_sum: "Areal og flatesum", review_edges: "Markerte kanter", approval: "Approval gate" },
  },
  lt: {
    close: "Uždaryti matavimo peržiūrą", eyebrow: "R4 matavimo peržiūra", synthetic: "Sintetiniai Preview duomenys", status: "Reikia patikrinti 2 kraštus", title: "Stogo planas ir verification gates", intro: "Prieš Confirm patikrinkite exact R4 evidence bylos kontekste.", area: "Stogo plotas", confidence: "Patikimumas", planes: "Plokštumos", edges: "Peržiūrėti", plan: "Stogo planas", planHelp: "Keturi pagrindiniai šlaitai. Pažymėtos linijos rodo E-04 ir E-11.", pitch: "Nuolydis", perimeter: "Perimetras", photos: "Nuotraukos ir šaltiniai", delta: "Pasikeitė nuo R3", deltaArea: "plotas", deltaConfidence: "patikimumas", deltaPlanes: "plokštuma", gates: "Verification gates", provenance: "Evidence provenance", next: "Kitas veiksmas", confirm: "Confirm R4", confirmDisabled: "Confirm užrakintas, kol E-04 ir E-11 nepatikrinti canonical approval sraute.", fallback: "Atidaryti veikiantį matavimo srautą", gateLabels: { source_identity: "Šaltinio tapatybė", plane_sum: "Plotas ir šlaitų suma", review_edges: "Pažymėti kraštai", approval: "Approval gate" },
  },
  en: {
    close: "Close measurement review", eyebrow: "R4 measurement review", synthetic: "Synthetic Preview data", status: "2 edges require review", title: "Roof plan and verification gates", intro: "Review exact R4 evidence in case context before Confirm.", area: "Roof area", confidence: "Confidence", planes: "Planes", edges: "Review", plan: "Roof plan", planHelp: "Four primary slopes. Highlighted lines show E-04 and E-11.", pitch: "Pitch", perimeter: "Perimeter", photos: "Photos and sources", delta: "Changed from R3", deltaArea: "area", deltaConfidence: "confidence", deltaPlanes: "plane", gates: "Verification gates", provenance: "Evidence provenance", next: "Next action", confirm: "Confirm R4", confirmDisabled: "Confirm stays locked until E-04 and E-11 are reviewed in the canonical approval flow.", fallback: "Open working measurement flow", gateLabels: { source_identity: "Source identity", plane_sum: "Area and slope sum", review_edges: "Flagged edges", approval: "Approval gate" },
  },
} as const;

function localeTag(locale: PanelLocale) {
  return locale === "lt" ? "lt-LT" : locale === "nb" ? "nb-NO" : "en-GB";
}

function number(locale: PanelLocale, value: number) {
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 1 : 0 }).format(value);
}

const gateTone: Record<Gate["state"], string> = {
  verified: "an-success",
  review_required: "an-danger",
  locked: "an-disabled",
};

export function AdminNextR4MeasurementReview({ locale, caseReference, customer, measurement }: { locale: PanelLocale; caseReference: string; customer: string; measurement: MeasurementReview }) {
  const t = copy[locale];
  const caseHref = `/admin-next-preview/cases/${encodeURIComponent(caseReference)}`;
  const metrics = [[t.area, `${number(locale, measurement.areaSquareMeters)} m²`, Ruler], [t.confidence, `${measurement.confidencePercent} %`, Target], [t.planes, String(measurement.planeCount), Layers3], [t.edges, String(measurement.reviewEdges.length), ShieldAlert]] as const;

  return (
    <div className="relative min-h-[calc(100dvh-8rem)]" data-admin-next-section="cases">
      <div aria-hidden="true" className="an-surface min-h-[900px] rounded-3xl border p-6 opacity-55 lg:p-8">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--an-amber)]">{caseReference}</p><h2 className="mt-3 text-3xl font-bold text-[var(--an-text)]">{customer}</h2><p className="mt-2 text-[var(--an-muted)]">Testveien 12, Oslo · Takfornyelse</p></div>
        <div className="mt-8 grid max-w-3xl grid-cols-3 gap-3">{["R4 review", "Pasiūlymas blokuotas", "SLA vėluoja"].map((label) => <div className="an-elevated rounded-2xl border p-5 text-sm font-bold text-[var(--an-muted)]" key={label}>{label}</div>)}</div>
      </div>

      <div aria-hidden="true" className="fixed inset-x-0 bottom-[4.5rem] top-16 z-40 bg-black/55 backdrop-blur-[2px] lg:bottom-0 lg:left-64" />
      <aside aria-labelledby="r4-drawer-title" aria-modal="true" className="fixed bottom-[4.5rem] right-0 top-16 z-50 flex w-full flex-col overflow-hidden border-l border-[var(--an-border-strong)] bg-[var(--an-surface)] shadow-[-24px_0_70px_rgba(0,0,0,.48)] lg:bottom-0 lg:w-[760px] xl:w-[820px]" role="dialog">
        <header className="shrink-0 border-b border-[var(--an-border)] bg-[var(--an-sidebar)] px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <Link aria-label={t.close} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-muted)] hover:text-[var(--an-amber)]" href={caseHref}><X aria-hidden="true" className="size-5" /></Link>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--an-amber)]">{t.eyebrow}</p><span className="rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-2 py-1 text-[10px] font-bold text-[var(--an-amber)]">{t.synthetic}</span></div><h1 className="mt-2 text-xl font-bold text-[var(--an-text)] sm:text-2xl" id="r4-drawer-title">{t.title}</h1><p className="mt-1 text-sm text-[var(--an-muted)]">{caseReference} · {measurement.reference} · {t.intro}</p></div>
            <span className="an-danger hidden rounded-full border px-2.5 py-1 text-[10px] font-bold sm:inline-flex">{t.status}</span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-6 sm:p-6">
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t.eyebrow}>
            {metrics.map(([label, value, Icon], index) => <article className={`an-elevated rounded-2xl border p-3 ${index === 3 ? "!border-[color:rgba(255,113,113,.38)]" : ""}`} key={label}><div className="flex items-start justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--an-muted)]">{label}</p><Icon aria-hidden="true" className={`size-4 ${index === 3 ? "text-[var(--an-danger)]" : "text-[var(--an-amber)]"}`} /></div><strong className={`mt-2 block text-xl ${index === 3 ? "text-[var(--an-danger)]" : "text-[var(--an-text)]"}`}>{value}</strong></article>)}
          </section>

          <section className="an-elevated mt-4 rounded-2xl border p-4 sm:p-5" aria-labelledby="roof-plan-title">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-[var(--an-text)]" id="roof-plan-title">{t.plan}</h2><p className="mt-1 text-xs text-[var(--an-muted)]">{t.planHelp}</p></div><Layers3 aria-hidden="true" className="size-5 text-[var(--an-amber)]" /></div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="overflow-hidden rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
                <svg aria-label={t.plan} className="h-auto w-full" role="img" viewBox="0 0 620 330">
                  <polygon fill="#1b2935" points="55,165 310,30 310,165" stroke="#6f8497" strokeWidth="3"/><polygon fill="#202f3b" points="310,30 565,165 310,165" stroke="#6f8497" strokeWidth="3"/><polygon fill="#17242f" points="55,165 310,165 245,305 35,305" stroke="#6f8497" strokeWidth="3"/><polygon fill="#1d2b37" points="310,165 565,165 585,305 375,305" stroke="#6f8497" strokeWidth="3"/>
                  <line stroke="var(--an-amber)" strokeDasharray="10 7" strokeWidth="6" x1="310" x2="245" y1="165" y2="305"/><line stroke="var(--an-danger)" strokeDasharray="10 7" strokeWidth="6" x1="310" x2="375" y1="165" y2="305"/>
                  {[["S1",195,120],["S2",425,120],["S3",150,245],["S4",470,245]].map(([id,x,y]) => <text fill="#f5f7fa" fontSize="20" fontWeight="800" key={String(id)} textAnchor="middle" x={Number(x)} y={Number(y)}>{id}</text>)}
                  <text fill="var(--an-amber)" fontSize="13" fontWeight="800" x="220" y="290">E-04</text><text fill="var(--an-danger)" fontSize="13" fontWeight="800" x="382" y="290">E-11</text>
                </svg>
              </div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">{measurement.primarySlopes.map((slope) => <article className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3" key={slope.id}><div className="flex items-center justify-between"><strong className="text-sm text-[var(--an-amber)]">{slope.id}</strong><span className="text-xs font-bold text-[var(--an-text)]">{number(locale, slope.areaSquareMeters)} m²</span></div><p className="mt-2 text-[10px] text-[var(--an-muted)]">{t.pitch} {slope.pitchDegrees}° · {t.perimeter} {number(locale, slope.perimeterMeters)} m</p></article>)}</div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="an-elevated rounded-2xl border p-4" aria-labelledby="r4-photos-title"><div className="flex items-center gap-2"><Camera aria-hidden="true" className="size-5 text-[var(--an-amber)]"/><h2 className="font-bold" id="r4-photos-title">{t.photos}</h2></div><div className="mt-4 grid grid-cols-3 gap-2">{measurement.photos.map((photo,index) => <article className="overflow-hidden rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)]" key={photo.id}><div className={`grid aspect-[4/3] place-items-center ${index === 2 ? "bg-[linear-gradient(145deg,#3b3022,#111820)]" : "bg-[linear-gradient(145deg,#233546,#101821)]"}`}><Camera aria-hidden="true" className="size-7 text-[var(--an-muted)]"/></div><div className="p-2"><strong className="block truncate text-[10px]">{photo.label}</strong><span className="mt-1 block truncate text-[9px] text-[var(--an-subtle)]">{photo.source} · {photo.capturedAt.slice(11)}</span></div></article>)}</div></div>
            <div className="an-elevated rounded-2xl border p-4" aria-labelledby="r4-delta-title"><div className="flex items-center gap-2"><ArrowRightLeft aria-hidden="true" className="size-5 text-[var(--an-amber)]"/><h2 className="font-bold" id="r4-delta-title">{t.delta}</h2></div><dl className="mt-4 grid gap-2 text-xs"><div className="flex justify-between rounded-lg bg-[var(--an-soft)] p-2"><dt>{t.deltaArea}</dt><dd className="font-bold text-[var(--an-amber)]">+{number(locale,measurement.deltaFromR3.areaSquareMeters)} m²</dd></div><div className="flex justify-between rounded-lg bg-[var(--an-soft)] p-2"><dt>{t.deltaConfidence}</dt><dd className="font-bold text-[var(--an-success)]">+{measurement.deltaFromR3.confidencePoints} pp</dd></div><div className="flex justify-between rounded-lg bg-[var(--an-soft)] p-2"><dt>{t.deltaPlanes}</dt><dd className="font-bold text-[var(--an-amber)]">+{measurement.deltaFromR3.planeCount}</dd></div></dl></div>
          </section>

          <section className="an-elevated mt-4 rounded-2xl border p-4" aria-labelledby="r4-gates-title"><div className="flex items-center justify-between"><h2 className="font-bold" id="r4-gates-title">{t.gates}</h2><Fingerprint aria-hidden="true" className="size-5 text-[var(--an-amber)]"/></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{measurement.verificationGates.map((gate) => <article className={`${gateTone[gate.state]} rounded-xl border p-3`} key={gate.id}><div className="flex items-center justify-between gap-2"><strong className="text-xs">{t.gateLabels[gate.id]}</strong>{gate.state === "verified" ? <CheckCircle2 aria-hidden="true" className="size-4"/> : gate.state === "locked" ? <LockKeyhole aria-hidden="true" className="size-4"/> : <ShieldAlert aria-hidden="true" className="size-4"/>}</div><p className="mt-2 text-[10px] opacity-80">{gate.detail}</p></article>)}</div><div className="mt-4 flex items-start gap-2 border-t border-[var(--an-border)] pt-4 text-[10px] text-[var(--an-muted)]"><Database aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--an-amber)]"/><p><strong className="text-[var(--an-text)]">{t.provenance}:</strong> {measurement.provenance.evidenceId} · {measurement.provenance.source} · {measurement.provenance.modelVersion} · {measurement.provenance.checksum}</p></div></section>
        </div>

        <footer className="shrink-0 border-t border-[var(--an-border)] bg-[var(--an-sidebar)] p-3 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--an-amber)]">{t.next}</p><p className="mt-1 truncate text-xs text-[var(--an-muted)]">{measurement.nextAction}</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-elevated)] px-3 text-xs font-bold text-[var(--an-text)] hover:border-[var(--an-amber)]" href={measurement.fallbackHref}>{t.fallback}<ArrowRight aria-hidden="true" className="size-4"/></Link><button aria-describedby="r4-confirm-disabled" className="an-cta inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl px-4 text-xs font-black opacity-55" disabled type="button"><LockKeyhole aria-hidden="true" className="size-4"/>{t.confirm}</button></div></div><p className="mt-2 text-right text-[9px] text-[var(--an-subtle)]" id="r4-confirm-disabled">{t.confirmDisabled}</p></footer>
      </aside>
    </div>
  );
}
