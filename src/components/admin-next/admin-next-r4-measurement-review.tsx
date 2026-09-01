import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Fingerprint,
  Layers3,
  LockKeyhole,
  Ruler,
  ShieldAlert,
  Target,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type { AdminNextCaseWorkspaceView } from "@/lib/admin-next/case-workspace-contract";

type MeasurementReview = NonNullable<
  AdminNextCaseWorkspaceView["measurementReview"]
>;

const copy = {
  nb: {
    back: "Tilbake til saken",
    eyebrow: "R4 målingskontroll",
    synthetic: "Syntetiske Preview-data",
    status: "2 kanter må kontrolleres",
    title: "Kontroller takgeometrien før tilbud",
    intro: "Sammenlign markerte kanter med kildebildene. Preview utfører ingen godkjenning eller datamutasjon.",
    area: "Takareal",
    confidence: "Confidence",
    planes: "Takflater",
    edges: "Til kontroll",
    schematic: "Skjematisk flatekart",
    schematicHelp: "Gule flater inneholder en kant som må kontrolleres.",
    schematicPreview: "Preview-skjema · canonical geometri kobles inn senere",
    reviewEdges: "Markerte kanter",
    variance: "Avvik",
    planeTable: "Flatedetaljer",
    plane: "Flate",
    pitch: "Helning",
    state: "Status",
    verified: "Bekreftet",
    review: "Kontroller",
    provenance: "Kilde og proveniens",
    evidenceId: "Evidence-ID",
    source: "Kilde",
    captured: "Registrert",
    model: "Modell/schema",
    checksum: "Kontrollsum",
    next: "Neste nødvendige handling",
    fallback: "Åpne fungerende måleflyt",
    approve: "Godkjenn måling",
    approvalDisabled: "Godkjenning aktiveres først når canonical evidence- og approval-kontraktene er koblet og godkjent.",
  },
  lt: {
    back: "Grįžti į bylą",
    eyebrow: "R4 matavimo peržiūra",
    synthetic: "Sintetiniai Preview duomenys",
    status: "Reikia patikrinti 2 kraštus",
    title: "Patikrinkite stogo geometriją prieš pasiūlymą",
    intro: "Palyginkite pažymėtus kraštus su šaltinio nuotraukomis. Preview neatlieka patvirtinimo ir nekeičia duomenų.",
    area: "Stogo plotas",
    confidence: "Patikimumas",
    planes: "Plokštumos",
    edges: "Peržiūrėti",
    schematic: "Scheminis plokštumų žemėlapis",
    schematicHelp: "Geltonos plokštumos turi kraštą, kurį reikia patikrinti.",
    schematicPreview: "Preview schema · canonical geometrija bus prijungta vėliau",
    reviewEdges: "Pažymėti kraštai",
    variance: "Nuokrypis",
    planeTable: "Plokštumų detalės",
    plane: "Plokštuma",
    pitch: "Nuolydis",
    state: "Būsena",
    verified: "Patvirtinta",
    review: "Peržiūrėti",
    provenance: "Šaltinis ir provenance",
    evidenceId: "Evidence ID",
    source: "Šaltinis",
    captured: "Užfiksuota",
    model: "Modelis / schema",
    checksum: "Kontrolinė suma",
    next: "Kitas būtinas veiksmas",
    fallback: "Atidaryti veikiantį matavimo srautą",
    approve: "Patvirtinti matavimą",
    approvalDisabled: "Patvirtinimas bus įjungtas tik prijungus ir patvirtinus canonical evidence bei approval kontraktus.",
  },
  en: {
    back: "Back to case",
    eyebrow: "R4 measurement review",
    synthetic: "Synthetic Preview data",
    status: "2 edges require review",
    title: "Review roof geometry before the offer",
    intro: "Compare flagged edges with source photos. Preview performs no approval or data mutation.",
    area: "Roof area",
    confidence: "Confidence",
    planes: "Planes",
    edges: "Review",
    schematic: "Schematic plane map",
    schematicHelp: "Amber planes contain an edge that requires review.",
    schematicPreview: "Preview schematic · canonical geometry connects later",
    reviewEdges: "Flagged edges",
    variance: "Variance",
    planeTable: "Plane details",
    plane: "Plane",
    pitch: "Pitch",
    state: "State",
    verified: "Verified",
    review: "Review",
    provenance: "Source and provenance",
    evidenceId: "Evidence ID",
    source: "Source",
    captured: "Captured",
    model: "Model / schema",
    checksum: "Checksum",
    next: "Next required action",
    fallback: "Open working measurement flow",
    approve: "Approve measurement",
    approvalDisabled: "Approval is enabled only after canonical evidence and approval contracts are connected and accepted.",
  },
} as const;

function localeTag(locale: PanelLocale) {
  if (locale === "lt") return "lt-LT";
  if (locale === "nb") return "nb-NO";
  return "en-GB";
}

function formatDecimal(locale: PanelLocale, value: number) {
  return new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 ? 1 : 0,
  }).format(value);
}

const schematicPlanes = [
  { id: "P1", points: "55,190 190,65 310,190", labelX: 180, labelY: 150 },
  { id: "P2", points: "55,190 310,190 245,310 35,310", labelX: 150, labelY: 250 },
  { id: "P3", points: "190,65 335,25 310,190", labelX: 265, labelY: 95 },
  { id: "P4", points: "335,25 470,65 310,190", labelX: 380, labelY: 95 },
  { id: "P5", points: "310,190 565,190 585,310 375,310", labelX: 475, labelY: 250 },
  { id: "P6", points: "245,310 310,190 375,310", labelX: 310, labelY: 275 },
  { id: "P7", points: "470,65 565,190 310,190", labelX: 465, labelY: 150 },
] as const;

export function AdminNextR4MeasurementReview({
  locale,
  caseReference,
  customer,
  measurement,
}: {
  locale: PanelLocale;
  caseReference: string;
  customer: string;
  measurement: MeasurementReview;
}) {
  const t = copy[locale];
  const caseHref = `/admin-next-preview/cases/${encodeURIComponent(caseReference)}`;
  const metrics = [
    [t.area, `${formatDecimal(locale, measurement.areaSquareMeters)} m²`, Ruler],
    [t.confidence, `${measurement.confidencePercent} %`, Target],
    [t.planes, String(measurement.planeCount), Layers3],
    [t.edges, String(measurement.reviewEdges.length), ShieldAlert],
  ] as const;

  return (
    <div className="mx-auto max-w-[1500px]" data-admin-next-section="cases">
      <div className="grid min-h-[calc(100dvh-8rem)] overflow-hidden rounded-3xl border border-[#dfe4e8] bg-white shadow-[0_18px_55px_rgba(18,38,57,.12)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#dfe4e8] bg-[#f6f8f9] p-6 lg:flex lg:flex-col">
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#506171] hover:bg-white hover:text-[#183b58]" href={caseHref}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t.back}
          </Link>
          <div className="mt-10">
            <span className="rounded-full border border-[#edcaca] bg-[#fff7f7] px-2.5 py-1 text-[11px] font-bold text-[#a53f3f]">{t.status}</span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#607286]">{caseReference}</p>
            <h2 className="mt-2 text-xl font-bold text-[#172637]">{customer}</h2>
            <p className="mt-2 text-sm text-[#6c7886]">{measurement.reference}</p>
          </div>
          <section className="mt-8 rounded-2xl border border-[#ead9ae] bg-[#fff8e7] p-4" aria-labelledby="r4-next-action-side">
            <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#805d1b]">{t.next}</p>
            <h3 className="mt-2 text-sm font-bold text-[#5e481b]" id="r4-next-action-side">{measurement.nextAction}</h3>
          </section>
          <div className="mt-6 rounded-2xl border border-[#dce3e8] bg-white p-4 text-xs text-[#667483]">
            <Fingerprint aria-hidden="true" className="mb-2 size-5 text-[#527896]" />
            <strong className="block text-[#2a3b4c]">{measurement.provenance.evidenceId}</strong>
            <span className="mt-2 block">{measurement.provenance.source}</span>
            <span className="mt-1 block">{measurement.provenance.capturedAt}</span>
            <span className="mt-1 block break-all">{measurement.provenance.checksum}</span>
          </div>
        </aside>

        <section className="min-w-0 bg-[#f3f5f7]" aria-labelledby="r4-review-title">
          <header className="sticky top-0 z-20 border-b border-[#dfe4e8] bg-white/96 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-start gap-3">
              <Link aria-label={t.back} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#dfe4e8] text-[#506171] hover:bg-[#f3f5f7] lg:hidden" href={caseHref}>
                <ArrowLeft aria-hidden="true" className="size-5" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-[#607286]">{t.eyebrow}</p>
                  <span className="rounded-full border border-[#ead9ae] bg-[#fff8e7] px-2 py-1 text-[10px] font-bold text-[#6c5219]">{t.synthetic}</span>
                </div>
                <h1 className="mt-2 text-xl font-bold tracking-[-.02em] text-[#152333] sm:text-2xl" id="r4-review-title">{t.title}</h1>
                <p className="mt-1 max-w-3xl text-sm text-[#687585]">{t.intro}</p>
              </div>
            </div>
          </header>

          <div className="space-y-5 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-32">
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t.eyebrow}>
              {metrics.map(([label, value, Icon], index) => (
                <article className={`rounded-2xl border bg-white p-4 ${index === 3 ? "border-[#edcaca]" : "border-[#dfe4e8]"}`} key={label}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#6b7886]">{label}</p>
                      <strong className={`mt-2 block text-2xl tracking-tight ${index === 3 ? "text-[#a53f3f]" : "text-[#172637]"}`}>{value}</strong>
                    </div>
                    <Icon aria-hidden="true" className={`size-5 ${index === 3 ? "text-[#c84f4f]" : "text-[#527896]"}`} />
                  </div>
                </article>
              ))}
            </section>

            <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
              <div className="min-w-0 space-y-5">
                <section className="rounded-3xl border border-[#dfe4e8] bg-white p-5 sm:p-6" aria-labelledby="r4-schematic-title">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-[#172637]" id="r4-schematic-title">{t.schematic}</h2>
                      <p className="mt-1 text-sm text-[#6a7684]">{t.schematicHelp}</p>
                    </div>
                    <Layers3 aria-hidden="true" className="size-5 shrink-0 text-[#527896]" />
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#dfe4e8] bg-[#eef3f6] p-3 sm:p-5">
                    <svg aria-label={t.schematic} className="h-auto w-full" role="img" viewBox="0 0 620 340">
                      {schematicPlanes.map((plane) => {
                        const review = plane.id === "P3" || plane.id === "P6";
                        return (
                          <g key={plane.id}>
                            <polygon fill={review ? "#f7dfaa" : "#dce9f0"} points={plane.points} stroke={review ? "#c98a20" : "#7795aa"} strokeWidth={review ? 5 : 3} />
                            <text fill={review ? "#805d1b" : "#315675"} fontSize="18" fontWeight="800" textAnchor="middle" x={plane.labelX} y={plane.labelY}>{plane.id}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <p className="mt-3 text-center text-xs text-[#7c8793]">{t.schematicPreview}</p>
                </section>

                <section className="rounded-3xl border border-[#edcaca] bg-[#fffafa] p-5 sm:p-6" aria-labelledby="r4-review-edges-title">
                  <div className="flex items-center gap-3">
                    <AlertTriangle aria-hidden="true" className="size-5 text-[#c84f4f]" />
                    <h2 className="font-bold text-[#7d3333]" id="r4-review-edges-title">{t.reviewEdges}</h2>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {measurement.reviewEdges.map((edge) => (
                      <article className="rounded-2xl border border-[#edcaca] bg-white p-4" key={edge.id}>
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm text-[#9b3737]">{edge.id} · {edge.between}</strong>
                          <span className="rounded-full bg-[#fff0f0] px-2 py-1 text-[10px] font-bold text-[#a53f3f]">{t.variance} {formatDecimal(locale, edge.varianceMeters)} m</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#6d5555]">{edge.reason}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <div className="min-w-0 space-y-5">
                <section className="rounded-3xl border border-[#dfe4e8] bg-white p-5 sm:p-6" aria-labelledby="r4-plane-table-title">
                  <h2 className="font-bold text-[#172637]" id="r4-plane-table-title">{t.planeTable}</h2>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[#dfe4e8]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f3f5f7] text-[#667483]">
                        <tr><th className="px-3 py-3">{t.plane}</th><th className="px-3 py-3">m²</th><th className="px-3 py-3">{t.pitch}</th><th className="px-3 py-3">{t.state}</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e9ed]">
                        {measurement.planes.map((plane) => (
                          <tr className={plane.state === "review" ? "bg-[#fffbf3]" : "bg-white"} key={plane.id}>
                            <th className="px-3 py-3 font-bold text-[#243546]">{plane.id}</th>
                            <td className="px-3 py-3 text-[#5f6e7d]">{formatDecimal(locale, plane.areaSquareMeters)}</td>
                            <td className="px-3 py-3 text-[#5f6e7d]">{plane.pitchDegrees}°</td>
                            <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold ${plane.state === "review" ? "bg-[#fff2d8] text-[#805d1b]" : "bg-[#edf8f3] text-[#2f785d]"}`}>{plane.state === "review" ? <AlertTriangle aria-hidden="true" className="size-3" /> : <CheckCircle2 aria-hidden="true" className="size-3" />}{plane.state === "review" ? t.review : t.verified}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-3xl border border-[#dfe4e8] bg-white p-5 sm:p-6" aria-labelledby="r4-provenance-title">
                  <div className="flex items-center gap-3">
                    <Database aria-hidden="true" className="size-5 text-[#527896]" />
                    <h2 className="font-bold text-[#172637]" id="r4-provenance-title">{t.provenance}</h2>
                  </div>
                  <dl className="mt-4 grid gap-3 text-xs">
                    {[
                      [t.evidenceId, measurement.provenance.evidenceId],
                      [t.source, measurement.provenance.source],
                      [t.captured, measurement.provenance.capturedAt],
                      [t.model, measurement.provenance.modelVersion],
                      [t.checksum, measurement.provenance.checksum],
                    ].map(([label, value]) => (
                      <div className="grid gap-1 rounded-xl bg-[#f6f8f9] p-3" key={label}>
                        <dt className="font-bold text-[#73808d]">{label}</dt>
                        <dd className="break-all font-semibold text-[#2d3e4f]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </div>
          </div>

          <footer className="fixed inset-x-0 bottom-[4.5rem] z-30 border-t border-[#dfe4e8] bg-white/96 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64 lg:px-8">
            <div className="mx-auto flex max-w-[1180px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="hidden min-w-0 xl:block">
                <p className="text-xs font-bold text-[#7a4e15]">{t.next}</p>
                <p className="mt-1 truncate text-xs text-[#6d7884]">{measurement.nextAction}</p>
              </div>
              <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <button aria-describedby="r4-approval-disabled" className="inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#d9dee3] bg-[#f3f5f7] px-4 text-xs font-bold text-[#89939d]" disabled type="button">
                  <LockKeyhole aria-hidden="true" className="size-4" />{t.approve}
                </button>
                <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#183b58] px-4 text-xs font-bold text-white hover:bg-[#244e6e]" href={measurement.fallbackHref}>
                  {t.fallback}<ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </div>
            <p className="mx-auto mt-2 max-w-[1180px] text-right text-[10px] text-[#7d8791]" id="r4-approval-disabled"><Clock3 aria-hidden="true" className="mr-1 inline size-3" />{t.approvalDisabled}</p>
          </footer>
        </section>
      </div>
    </div>
  );
}
