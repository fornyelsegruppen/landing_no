import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Camera,
  Clock3,
  CheckCircle2,
  Database,
  FileCheck2,
  Fingerprint,
  Gauge,
  Layers3,
  LockKeyhole,
  Ruler,
  ShieldAlert,
  Target,
  UserRound,
  X,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type { AdminNextR4MeasurementView } from "@/lib/admin-next/r4-read-adapter";
import type { HeightSurfaceVisualizationV1 } from "@/lib/roof-fusion/hoydedata-surface-visualization-v1";

type MeasurementReview = AdminNextR4MeasurementView;
type Gate = MeasurementReview["verificationGates"][number];
type MeasurementSource = "fixture" | "canonical";

const copy = {
  nb: {
    close: "Lukk målingskontroll", eyebrow: "R4 målingskontroll", synthetic: "Syntetiske Preview-data", title: "Måling R4", area: "Takareal", confidence: "Confidence", planes: "Flater", edges: "Review", plan: "Takplan", planHelp: "Fire hovedflater. Markerte linjer viser E-04 og E-11.", pitch: "Helning", perimeter: "Omkrets", photos: "Kilder og evidence", delta: "Endret fra", deltaArea: "areal", deltaConfidence: "confidence", deltaPlanes: "flate", unchanged: "Geometrien er uendret", gates: "Verification gates", provenance: "Evidence provenance", next: "Neste handling", confirm: "Confirm R4", fallback: "Åpne fungerende måleflyt", generated: "Generert", sourceVersion: "Kildeversjon", owner: "Ansvarlig", ready: "Klar til godkjenning", sufficient: "Datagrunnlaget er tilstrekkelig", authorized: "Autorisert", usable: "Kontrollert", gateLabels: { source_identity: "Kildeidentitet", plane_sum: "Areal og flatesum", review_edges: "Markerte kanter", approval: "Approval gate" },
  },
  lt: {
    close: "Uždaryti matavimo peržiūrą", eyebrow: "R4 matavimo peržiūra", synthetic: "Sintetiniai Preview duomenys", title: "Matavimas R4", area: "Bendras plotas", confidence: "Patikimumas", planes: "Plokštumos", edges: "Peržiūrėti", plan: "Stogo planas", planHelp: "Keturi pagrindiniai šlaitai. Pažymėtos linijos rodo E-04 ir E-11.", pitch: "Nuolydis", perimeter: "Perimetras", photos: "Šaltiniai ir įrodymai", delta: "Pasikeitė nuo", deltaArea: "plotas", deltaConfidence: "patikimumas", deltaPlanes: "plokštuma", unchanged: "Geometrija nepasikeitė", gates: "Patikros vartai", provenance: "Įrodymų kilmė", next: "Kitas veiksmas", confirm: "Patvirtinti R4", fallback: "Atidaryti visus šaltinius", generated: "Sugeneruota", sourceVersion: "Šaltinio versija", owner: "Atsakingas", ready: "Paruošta tvirtinti", sufficient: "Duomenų pakanka", authorized: "Leista naudoti", usable: "Patikrinta", gateLabels: { source_identity: "Šaltinio tapatybė", plane_sum: "Plotas ir šlaitų suma", review_edges: "Pažymėti kraštai", approval: "Patvirtinimo vartas" },
  },
  en: {
    close: "Close measurement review", eyebrow: "R4 measurement review", synthetic: "Synthetic Preview data", title: "Measurement R4", area: "Total area", confidence: "Confidence", planes: "Planes", edges: "Review", plan: "Roof plan", planHelp: "Four primary slopes. Highlighted lines show E-04 and E-11.", pitch: "Pitch", perimeter: "Perimeter", photos: "Sources and evidence", delta: "Changed from", deltaArea: "area", deltaConfidence: "confidence", deltaPlanes: "plane", unchanged: "Geometry is unchanged", gates: "Verification gates", provenance: "Evidence provenance", next: "Next action", confirm: "Confirm R4", fallback: "Open all sources", generated: "Generated", sourceVersion: "Source version", owner: "Owner", ready: "Ready to approve", sufficient: "Data is sufficient", authorized: "Authorized", usable: "Verified", gateLabels: { source_identity: "Source identity", plane_sum: "Area and slope sum", review_edges: "Flagged edges", approval: "Approval gate" },
  },
} as const;

const stateCopy = {
  nb: {
    canonical: "Canonical Roof Fusion",
    verified: "Godkjent",
    review: (count: number) => `${count} kant${count === 1 ? "" : "er"} må kontrolleres`,
    planVerified: "Canonical Roof Fusion-geometri. Ingen konfliktkanter.",
    planReview: (ids: string) => `Canonical Roof Fusion-geometri. Kontroller ${ids}.`,
    planGateReview: "Canonical Roof Fusion-geometri. Kontroller verification gates.",
    confirmVerified: "Preview er skrivebeskyttet. Snapshotet er godkjent; ingen ny godkjenningsmutasjon kjøres.",
    confirmReview: (ids: string) => `Confirm er låst til ${ids} er kontrollert i canonical approval-flow.`,
    confirmGateReview: "Confirm er låst til alle canonical verification gates er godkjent.",
  },
  lt: {
    canonical: "Canonical Roof Fusion",
    verified: "Patvirtinta",
    review: (count: number) => `Reikia patikrinti ${count} krašt${count === 1 ? "ą" : "us"}`,
    planVerified: "Canonical Roof Fusion geometrija. Konfliktinių kraštų nėra.",
    planReview: (ids: string) => `Canonical Roof Fusion geometrija. Patikrinkite ${ids}.`,
    planGateReview: "Canonical Roof Fusion geometrija. Patikrinkite verification gates.",
    confirmVerified: "Preview yra tik skaitymui. Snapshot patvirtintas; pakartotinė patvirtinimo mutacija nevykdoma.",
    confirmReview: (ids: string) => `Confirm užrakintas, kol ${ids} nepatikrinti canonical approval sraute.`,
    confirmGateReview: "Confirm užrakintas, kol nepatvirtinti visi canonical verification gates.",
  },
  en: {
    canonical: "Canonical Roof Fusion",
    verified: "Approved",
    review: (count: number) => `${count} edge${count === 1 ? "" : "s"} require review`,
    planVerified: "Canonical Roof Fusion geometry. No conflicted edges.",
    planReview: (ids: string) => `Canonical Roof Fusion geometry. Review ${ids}.`,
    planGateReview: "Canonical Roof Fusion geometry. Review the verification gates.",
    confirmVerified: "Preview is read-only. The snapshot is approved; no repeated approval mutation is run.",
    confirmReview: (ids: string) => `Confirm stays locked until ${ids} are reviewed in the canonical approval flow.`,
    confirmGateReview: "Confirm stays locked until all canonical verification gates are approved.",
  },
} as const;

function localeTag(locale: PanelLocale) {
  return locale === "lt" ? "lt-LT" : locale === "nb" ? "nb-NO" : "en-GB";
}

function metricLabel(locale: PanelLocale, kind: "horizontal" | "surface" | "net") {
  if (locale === "lt") {
    return kind === "horizontal" ? "Horizontalus bruto plotas" : kind === "surface" ? "Bruto paviršiaus plotas" : "Grynasis stogo plotas";
  }
  if (locale === "nb") {
    return kind === "horizontal" ? "Horisontalt bruttoareal" : kind === "surface" ? "Brutto overflateareal" : "Netto takareal";
  }
  return kind === "horizontal" ? "Gross horizontal area" : kind === "surface" ? "Gross surface area" : "Net roof area";
}

function unknownLabel(locale: PanelLocale) {
  return locale === "lt" ? "Nežinoma" : locale === "nb" ? "Ukjent" : "Unknown";
}

function transientCopy(locale: PanelLocale) {
  if (locale === "lt") {
    return {
      title: "Matavimas R4",
      locked: "Patvirtinimas užrakintas",
      horizontal: "Horizontalus plotas",
      surface: "Paviršiaus plotas",
      pitch: "Nuolydis",
      status: "Statusas",
      confirm: "🔒 Patvirtinti R4 negalima",
    };
  }
  if (locale === "nb") {
    return {
      title: "Måling R4",
      locked: "Godkjenning er låst",
      horizontal: "Horisontalt areal",
      surface: "Overflateareal",
      pitch: "Takvinkel",
      status: "Status",
      confirm: "🔒 R4 kan ikke godkjennes",
    };
  }
  return {
    title: "Measurement R4",
    locked: "Approval locked",
    horizontal: "Horizontal area",
    surface: "Surface area",
    pitch: "Pitch",
    status: "Status",
    confirm: "🔒 R4 confirmation locked",
  };
}

export function RoofFusionTransientR4Drawer({
  locale,
  visualization,
  horizontalAreaSquareMeters,
  surfaceAreaSquareMeters,
  pitchDegrees,
  snapshotHash,
}: {
  locale: PanelLocale;
  visualization: HeightSurfaceVisualizationV1;
  horizontalAreaSquareMeters: number;
  surfaceAreaSquareMeters?: number;
  pitchDegrees?: number;
  snapshotHash: string;
}) {
  const t = transientCopy(locale);
  const pitch = pitchDegrees === undefined ? unknownLabel(locale) : `${number(locale, pitchDegrees)}°`;
  return (
    <aside aria-label="Matavimas R4 · Høydedata Preview" className="rounded-2xl border border-[var(--an-border-strong)] bg-[var(--an-surface)] p-4 shadow-2xl" data-r4-transient-drawer="hoydedata_preview">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[var(--an-amber)]">{t.title}</p><h2 className="mt-1 text-lg font-black">Høydedata Preview</h2><p className="mt-1 text-xs text-[var(--an-muted)]">DOM/DTM · PREVIEW · review_required</p></div>
        <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-1 text-[9px] font-black text-red-200">{t.locked}</span>
      </div>
      <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--an-border)] bg-[#080d12]" style={{ aspectRatio: `${visualization.width} / ${visualization.height}` }}>
        <img alt="Kartverket DOM minus DTM height surface" className="absolute inset-0 size-full object-cover" src={visualization.dataUrl} />
        <svg aria-label="Co-registered roof plane overlay" className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox={`0 0 ${visualization.width} ${visualization.height}`}>
          <polygon fill="transparent" points={visualization.overlayPoints} stroke="#f4b63f" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          {visualization.planes?.map((plane, index) => <polygon fill={["rgba(34,197,94,.34)", "rgba(56,189,248,.34)", "rgba(249,115,22,.34)", "rgba(217,70,239,.34)"][index % 4]} key={plane.planeId} points={plane.overlayPoints} stroke={["#4ade80", "#7dd3fc", "#fb923c", "#e879f9"][index % 4]} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          {visualization.ridge ? <polyline fill="none" points={visualization.ridge.overlayPoints} stroke="#fff" strokeWidth="3" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[9px] font-black text-white">N ↑</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-soft)] p-2"><dt className="text-[var(--an-subtle)]">{t.horizontal}</dt><dd className="mt-1 font-black">{number(locale, horizontalAreaSquareMeters)} m²</dd></div><div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-soft)] p-2"><dt className="text-[var(--an-subtle)]">{t.surface}</dt><dd className="mt-1 font-black">{surfaceAreaSquareMeters === undefined ? unknownLabel(locale) : `${number(locale, surfaceAreaSquareMeters)} m²`}</dd></div><div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-soft)] p-2"><dt className="text-[var(--an-subtle)]">{t.pitch}</dt><dd className="mt-1 font-black">{pitch}</dd></div><div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-soft)] p-2"><dt className="text-[var(--an-subtle)]">{t.status}</dt><dd className="mt-1 font-black text-[var(--an-amber)]">PREVIEW</dd></div></dl>
      <p className="mt-3 text-[10px] text-[var(--an-subtle)]">{visualization.attribution} · snapshot {snapshotHash.slice(0, 16)}…</p>
      <button aria-disabled="true" className="mt-4 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-[var(--an-amber)] px-4 text-xs font-black text-[var(--an-amber-ink)] opacity-55" disabled type="button">{t.confirm}</button>
    </aside>
  );
}

function number(locale: PanelLocale, value: number) {
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 1 : 0 }).format(value);
}

function dateTime(locale: PanelLocale, value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(localeTag(locale), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Oslo",
      }).format(parsed);
}

function signed(locale: PanelLocale, value: number, suffix = "") {
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${number(locale, Math.abs(value))}${suffix}`;
}

function revisionLabel(reference?: string) {
  if (!reference) return "R3";
  const match = /(?:^|-)r(\d+)(?:-|$)/iu.exec(reference);
  return match ? `R${match[1]}` : reference;
}

const gateTone: Record<Gate["state"], string> = {
  verified: "an-success",
  review_required: "an-danger",
  locked: "an-disabled",
};

type ProjectedPoint = { x: number; y: number };

function projectDiagram(measurement: MeasurementReview) {
  const diagram = measurement.diagram;
  if (!diagram || diagram.vertices.length < 3) return null;

  const xs = diagram.vertices.map((vertex) => vertex.xMeters);
  const ys = diagram.vertices.map((vertex) => vertex.yMeters);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const padding = 34;
  const scale = Math.min((620 - padding * 2) / width, (330 - padding * 2) / height);
  const offsetX = (620 - width * scale) / 2;
  const offsetY = (330 - height * scale) / 2;
  const points = new Map<string, ProjectedPoint>(
    diagram.vertices.map((vertex) => [
      vertex.id,
      {
        x: offsetX + (vertex.xMeters - minX) * scale,
        y: 330 - offsetY - (vertex.yMeters - minY) * scale,
      },
    ]),
  );
  const surfaces = diagram.surfaces
    .map((surface) => ({
      id: surface.id,
      points: surface.vertexIds
        .map((vertexId) => points.get(vertexId))
        .filter((point): point is ProjectedPoint => Boolean(point)),
    }))
    .filter((surface) => surface.points.length >= 3);
  const edges = diagram.edges
    .map((edge) => ({
      ...edge,
      from: points.get(edge.fromVertexId),
      to: points.get(edge.toVertexId),
    }))
    .filter(
      (edge): edge is typeof edge & { from: ProjectedPoint; to: ProjectedPoint } =>
        Boolean(edge.from && edge.to),
    );
  return { edges, surfaces };
}

export function AdminNextR4MeasurementReview({ address, locale, caseReference, customer, measurement, owner, source = "fixture" }: { address: string; locale: PanelLocale; caseReference: string; customer: string; measurement: MeasurementReview; owner: string; source?: MeasurementSource }) {
  const t = copy[locale];
  const stateText = stateCopy[locale];
  const caseHref = `/admin-next-preview/cases/${encodeURIComponent(caseReference)}`;
  const reviewEdgeIds = measurement.reviewEdges.map((edge) => edge.id);
  const reviewEdgeLabel = reviewEdgeIds.join(", ");
  const isVerified = measurement.state === "verified" && measurement.verificationGates.every((gate) => gate.state === "verified");
  const status = isVerified ? stateText.verified : stateText.review(measurement.reviewEdges.length);
  const planHelp = source === "fixture"
    ? t.planHelp
    : isVerified
      ? stateText.planVerified
      : reviewEdgeLabel
        ? stateText.planReview(reviewEdgeLabel)
        : stateText.planGateReview;
  const confirmDisabled = isVerified
    ? stateText.confirmVerified
    : reviewEdgeLabel
      ? stateText.confirmReview(reviewEdgeLabel)
      : stateText.confirmGateReview;
  const projectedDiagram = projectDiagram(measurement);
  const comparison = revisionLabel(measurement.comparedToReference);
  const geometryUnchanged =
    measurement.deltaFromR3.areaSquareMeters === 0 &&
    measurement.deltaFromR3.confidencePoints === 0 &&
    measurement.deltaFromR3.planeCount === 0;
  const photoCards = measurement.photos.map((photo) => ({
        id: photo.id,
        kind: "photo",
        label: photo.label,
        attribution: photo.source,
        capturedAt: photo.capturedAt,
        previewHref: photo.previewHref,
        licenseState: "unknown" as const,
        qualityState: "unknown" as const,
      }));
  const photoIds = new Set(photoCards.map((photo) => photo.id));
  const sourceCards = [
    ...photoCards,
    ...(measurement.sources || [])
      .filter((sourceItem) => !photoIds.has(sourceItem.id))
      .map((sourceItem) => ({ ...sourceItem, previewHref: undefined })),
  ];

  return (
    <div className="relative min-h-[calc(100dvh-8rem)]" data-admin-next-section="cases">
      <div aria-hidden="true" className="an-surface min-h-[900px] rounded-3xl border p-6 opacity-55 lg:p-8">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--an-amber)]">{caseReference}</p><h2 className="mt-3 text-3xl font-bold text-[var(--an-text)]">{customer}</h2><p className="mt-2 text-[var(--an-muted)]">{address} · Takfornyelse</p></div>
        <div className="mt-8 grid max-w-3xl grid-cols-3 gap-3">{["R4 review", "Pasiūlymas blokuotas", "SLA vėluoja"].map((label) => <div className="an-elevated rounded-2xl border p-5 text-sm font-bold text-[var(--an-muted)]" key={label}>{label}</div>)}</div>
      </div>

      <div aria-hidden="true" className="fixed inset-x-0 bottom-[4.5rem] top-16 z-40 bg-black/55 backdrop-blur-[2px] lg:bottom-0 lg:left-64" />
      <aside aria-labelledby="r4-drawer-title" aria-modal="true" className="fixed bottom-[4.5rem] right-0 top-16 z-50 flex w-full flex-col overflow-hidden border-l border-[var(--an-border-strong)] bg-[var(--an-surface)] shadow-[-24px_0_70px_rgba(0,0,0,.48)] lg:bottom-0 lg:w-[760px] xl:w-[820px]" role="dialog">
        <header className="shrink-0 border-b border-[var(--an-border)] bg-[var(--an-sidebar)] px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--an-amber)]">{t.eyebrow}</p>
              <h1 className="mt-1 text-xl font-bold text-[var(--an-text)] sm:text-2xl" id="r4-drawer-title">{t.title}</h1>
              <p className="mt-1 truncate text-xs text-[var(--an-muted)]">{caseReference} · {measurement.reference}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-2 py-1 text-[10px] font-bold text-[var(--an-amber)]">{source === "canonical" ? stateText.canonical : t.synthetic}</span>
                <span className={`${isVerified ? "an-success" : "an-danger"} rounded-full border px-2.5 py-1 text-[10px] font-bold`}>{isVerified ? t.ready : status}</span>
                {isVerified ? <span className="an-success rounded-full border px-2.5 py-1 text-[10px] font-bold">{t.sufficient}</span> : null}
              </div>
            </div>
            <Link aria-label={t.close} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-muted)] hover:text-[var(--an-amber)]" href={caseHref}><X aria-hidden="true" className="size-5" /></Link>
          </div>
          <div className="mt-4 grid gap-2 border-t border-[var(--an-border)] pt-3 text-[10px] text-[var(--an-muted)] sm:grid-cols-3">
            <span className="inline-flex min-w-0 items-center gap-2"><Clock3 aria-hidden="true" className="size-4 shrink-0"/><span className="truncate"><strong className="text-[var(--an-text)]">{t.generated}:</strong> {dateTime(locale, measurement.provenance.capturedAt)}</span></span>
            <span className="inline-flex min-w-0 items-center gap-2"><FileCheck2 aria-hidden="true" className="size-4 shrink-0"/><span className="truncate"><strong className="text-[var(--an-text)]">{t.sourceVersion}:</strong> {measurement.provenance.modelVersion}</span></span>
            <span className="inline-flex min-w-0 items-center gap-2"><UserRound aria-hidden="true" className="size-4 shrink-0"/><span className="truncate"><strong className="text-[var(--an-text)]">{t.owner}:</strong> {owner}</span></span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-6 sm:p-6">
          <section className="an-elevated rounded-2xl border p-4 sm:p-5" aria-labelledby="roof-plan-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold text-[var(--an-text)]" id="roof-plan-title">{t.plan}</h2><p className="mt-1 text-xs text-[var(--an-muted)]">{planHelp}</p></div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[var(--an-muted)]"><span>{measurement.confidencePercent} %</span><span>·</span><span>{measurement.planeCount} {t.planes.toLowerCase()}</span><span>·</span><span className={measurement.reviewEdges.length ? "text-[var(--an-danger)]" : "text-[var(--an-success)]"}>{measurement.reviewEdges.length} {t.edges.toLowerCase()}</span><Layers3 aria-hidden="true" className="size-5 text-[var(--an-amber)]" /></div>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_160px_200px]">
              <div className="overflow-hidden rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
                <svg aria-label={t.plan} className="h-auto w-full" role="img" viewBox="0 0 620 330">
                  {projectedDiagram ? (
                    <>
                      {projectedDiagram.surfaces.map((surface, index) => {
                        const pointList = surface.points.map((point) => `${point.x},${point.y}`).join(" ");
                        const center = surface.points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
                        const centerX = center.x / surface.points.length;
                        const centerY = center.y / surface.points.length;
                        return <g key={surface.id}><polygon fill={["#1b2935", "#202f3b", "#17242f", "#1d2b37"][index % 4]} points={pointList} stroke="#6f8497" strokeWidth="3"/><text fill="#f5f7fa" fontSize="18" fontWeight="800" textAnchor="middle" x={centerX} y={centerY}>{surface.id}</text></g>;
                      })}
                      {projectedDiagram.edges.map((edge) => {
                        const needsReview = edge.state === "review";
                        const centerX = (edge.from.x + edge.to.x) / 2;
                        const centerY = (edge.from.y + edge.to.y) / 2;
                        return <g key={edge.id}><line stroke={needsReview ? "var(--an-danger)" : "#6f8497"} strokeDasharray={needsReview ? "10 7" : undefined} strokeWidth={needsReview ? 6 : 2} x1={edge.from.x} x2={edge.to.x} y1={edge.from.y} y2={edge.to.y}/>{needsReview ? <text fill="var(--an-danger)" fontSize="13" fontWeight="800" textAnchor="middle" x={centerX} y={centerY - 8}>{edge.id}</text> : null}</g>;
                      })}
                    </>
                  ) : (
                    <>
                      <polygon fill="#1b2935" points="55,165 310,30 310,165" stroke="#6f8497" strokeWidth="3"/><polygon fill="#202f3b" points="310,30 565,165 310,165" stroke="#6f8497" strokeWidth="3"/><polygon fill="#17242f" points="55,165 310,165 245,305 35,305" stroke="#6f8497" strokeWidth="3"/><polygon fill="#1d2b37" points="310,165 565,165 585,305 375,305" stroke="#6f8497" strokeWidth="3"/>
                      <line stroke="var(--an-amber)" strokeDasharray="10 7" strokeWidth="6" x1="310" x2="245" y1="165" y2="305"/><line stroke="var(--an-danger)" strokeDasharray="10 7" strokeWidth="6" x1="310" x2="375" y1="165" y2="305"/>
                      {[["S1",195,120],["S2",425,120],["S3",150,245],["S4",470,245]].map(([id,x,y]) => <text fill="#f5f7fa" fontSize="20" fontWeight="800" key={String(id)} textAnchor="middle" x={Number(x)} y={Number(y)}>{id}</text>)}
                      <text fill="var(--an-amber)" fontSize="13" fontWeight="800" x="220" y="290">E-04</text><text fill="var(--an-danger)" fontSize="13" fontWeight="800" x="382" y="290">E-11</text>
                    </>
                  )}
                </svg>
              </div>
              <dl className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                {measurement.horizontalAreaSquareMeters !== undefined ? <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3"><dt className="flex items-center gap-2 text-[10px] text-[var(--an-muted)]"><Ruler aria-hidden="true" className="size-4"/>{metricLabel(locale, "horizontal")}</dt><dd className="mt-2 text-lg font-bold">{number(locale, measurement.horizontalAreaSquareMeters)} m²</dd></div> : null}
                {measurement.surfaceAreaSquareMeters !== undefined ? <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3"><dt className="flex items-center gap-2 text-[10px] text-[var(--an-muted)]"><Ruler aria-hidden="true" className="size-4"/>{metricLabel(locale, "surface")}</dt><dd className="mt-2 text-lg font-bold">{number(locale, measurement.surfaceAreaSquareMeters)} m²</dd></div> : null}
                <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3"><dt className="flex items-center gap-2 text-[10px] text-[var(--an-muted)]"><Ruler aria-hidden="true" className="size-4"/>{metricLabel(locale, "net")}</dt><dd className="mt-2 text-lg font-bold">{number(locale, measurement.areaSquareMeters)} m²</dd></div>
                <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3"><dt className="flex items-center gap-2 text-[10px] text-[var(--an-muted)]"><Gauge aria-hidden="true" className="size-4"/>{t.pitch}</dt><dd className="mt-2 text-lg font-bold">{measurement.overallPitchDegrees === undefined ? unknownLabel(locale) : `${number(locale, measurement.overallPitchDegrees)}°`}</dd></div>
                <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3"><dt className="flex items-center gap-2 text-[10px] text-[var(--an-muted)]"><Target aria-hidden="true" className="size-4"/>{t.perimeter}</dt><dd className="mt-2 text-lg font-bold">{number(locale, measurement.perimeterMeters ?? 0)} m</dd></div>
              </dl>
              <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3" aria-labelledby="r4-delta-title">
                <div className="flex items-center gap-2"><ArrowRightLeft aria-hidden="true" className="size-4 text-[var(--an-amber)]"/><h3 className="text-xs font-bold" id="r4-delta-title">{t.delta} {comparison}</h3></div>
                {geometryUnchanged ? <p className="an-success mt-3 rounded-lg border p-2 text-[10px] font-bold"><CheckCircle2 aria-hidden="true" className="mr-1 inline size-4"/>{t.unchanged}</p> : null}
                <dl className="mt-3 grid gap-2 text-[10px]"><div className="flex justify-between"><dt>{t.deltaArea}</dt><dd className="font-bold text-[var(--an-amber)]">{signed(locale, measurement.deltaFromR3.areaSquareMeters, " m²")}</dd></div><div className="flex justify-between"><dt>{t.deltaConfidence}</dt><dd className="font-bold text-[var(--an-success)]">{signed(locale, measurement.deltaFromR3.confidencePoints, " pp")}</dd></div><div className="flex justify-between"><dt>{t.deltaPlanes}</dt><dd className="font-bold text-[var(--an-amber)]">{signed(locale, measurement.deltaFromR3.planeCount)}</dd></div></dl>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{measurement.primarySlopes.map((slope) => <article className="rounded-xl border border-[var(--an-border)] bg-[var(--an-soft)] p-3" key={slope.id}><div className="flex items-center justify-between"><strong className="text-sm text-[var(--an-amber)]">{slope.id}</strong><span className="text-xs font-bold text-[var(--an-text)]">{number(locale, slope.areaSquareMeters)} m²</span></div><p className="mt-2 text-[10px] text-[var(--an-muted)]">{t.pitch} {slope.pitchDegrees === undefined ? unknownLabel(locale) : `${number(locale, slope.pitchDegrees)}°`} · {t.perimeter} {number(locale, slope.perimeterMeters)} m</p></article>)}</div>
          </section>

          <section className="an-elevated mt-4 rounded-2xl border p-4" aria-labelledby="r4-photos-title"><div className="flex items-center gap-2"><Camera aria-hidden="true" className="size-5 text-[var(--an-amber)]"/><h2 className="font-bold" id="r4-photos-title">{t.photos}</h2></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{sourceCards.map((item,index) => <article className="overflow-hidden rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)]" key={item.id}><div className={`relative grid aspect-[16/9] place-items-center overflow-hidden ${index % 3 === 2 ? "bg-[linear-gradient(145deg,#3b3022,#111820)]" : "bg-[linear-gradient(145deg,#233546,#101821)]"}`}>{item.previewHref ? <Image alt={item.label} className="object-cover" fill sizes="(min-width: 640px) 180px, 50vw" src={item.previewHref} unoptimized/> : <Database aria-hidden="true" className="size-7 text-[var(--an-muted)]"/>}</div><div className="p-2"><div className="flex items-start justify-between gap-2"><strong className="block min-w-0 truncate text-[10px]">{item.label}</strong><CheckCircle2 aria-hidden="true" className={`size-3 shrink-0 ${item.qualityState === "usable" ? "text-[var(--an-success)]" : "text-[var(--an-amber)]"}`}/></div><span className="mt-1 block truncate text-[9px] text-[var(--an-subtle)]">{item.kind.replaceAll("_", " ")} · {dateTime(locale, item.capturedAt)}</span><span className={`mt-2 inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${item.licenseState === "authorized" && item.qualityState === "usable" ? "an-success" : "border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]"}`}>{item.licenseState === "authorized" ? t.authorized : item.licenseState} · {item.qualityState === "usable" ? t.usable : item.qualityState}</span></div></article>)}</div></section>

          <section className="an-elevated mt-4 rounded-2xl border p-4" aria-labelledby="r4-gates-title"><div className="flex items-center justify-between"><h2 className="font-bold" id="r4-gates-title">{t.gates}</h2><Fingerprint aria-hidden="true" className="size-5 text-[var(--an-amber)]"/></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{measurement.verificationGates.map((gate) => <article className={`${gateTone[gate.state]} rounded-xl border p-3`} key={gate.id}><div className="flex items-center justify-between gap-2"><strong className="text-xs">{t.gateLabels[gate.id]}</strong>{gate.state === "verified" ? <CheckCircle2 aria-hidden="true" className="size-4"/> : gate.state === "locked" ? <LockKeyhole aria-hidden="true" className="size-4"/> : <ShieldAlert aria-hidden="true" className="size-4"/>}</div><p className="mt-2 text-[10px] opacity-80">{gate.detail}</p></article>)}</div><div className="mt-4 flex items-start gap-2 border-t border-[var(--an-border)] pt-4 text-[10px] text-[var(--an-muted)]"><Database aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--an-amber)]"/><p><strong className="text-[var(--an-text)]">{t.provenance}:</strong> {measurement.provenance.evidenceId} · {measurement.provenance.source} · {measurement.provenance.modelVersion} · {measurement.provenance.checksum}</p></div></section>
        </div>

        <footer className="shrink-0 border-t border-[var(--an-border)] bg-[var(--an-sidebar)] p-3 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--an-amber)]">{t.next}</p><p className="mt-1 truncate text-xs text-[var(--an-muted)]">{measurement.nextAction}</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-elevated)] px-3 text-xs font-bold text-[var(--an-text)] hover:border-[var(--an-amber)]" href={measurement.fallbackHref}>{t.fallback}<ArrowRight aria-hidden="true" className="size-4"/></Link><button aria-describedby="r4-confirm-disabled" className="an-cta inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl px-4 text-xs font-black opacity-55" disabled type="button"><LockKeyhole aria-hidden="true" className="size-4"/>{t.confirm}</button></div></div><p className="mt-2 text-right text-[9px] text-[var(--an-subtle)]" id="r4-confirm-disabled">{confirmDisabled}</p></footer>
      </aside>
    </div>
  );
}
