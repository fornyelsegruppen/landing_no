"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";

/** Coordinates are normalized to the image surface (0..1). */
export type RoofFusionPoint = Readonly<{ x: number; y: number }>;

export type RoofFusionStage = "outline" | "skeleton" | "slopes" | "review";
export type RoofFusionLineKind = "ridge" | "valley";
export type RoofFusionConfidence = "high" | "medium" | "low";
export type RoofFusionLayer =
  "sourceOutline" | "approvedOutline" | "hoydedata" | "roofPlanes" | "skeleton";

export type RoofFusionLine = Readonly<{
  id: string;
  kind: RoofFusionLineKind;
  start: RoofFusionPoint;
  end: RoofFusionPoint;
}>;

export type RoofFusionRoofPlane = Readonly<{
  id: string;
  label?: string;
  points: readonly RoofFusionPoint[];
  areaSquareMeters?: number;
  slopeDegrees?: number;
  confidence?: RoofFusionConfidence;
}>;

export type RoofFusionHeightPoint = Readonly<{
  point: RoofFusionPoint;
  elevationMeters?: number;
}>;

export type RoofFusionObstacle = Readonly<{
  id: string;
  point: RoofFusionPoint;
  label?: string;
}>;

export type RoofFusionUnifiedWorkbenchProps = Readonly<{
  /** A licensed/approved orthophoto or image supplied by the caller. */
  orthoImageSrc: string;
  orthoImageAlt?: string;
  orthoImageWidth?: number;
  orthoImageHeight?: number;
  orthoAttribution?: string;
  sourceOutline: readonly RoofFusionPoint[];
  approvedOutline?: readonly RoofFusionPoint[];
  roofPlanes?: readonly RoofFusionRoofPlane[];
  lines?: readonly RoofFusionLine[];
  heightPoints?: readonly RoofFusionHeightPoint[];
  obstacles?: readonly RoofFusionObstacle[];
  totalSurfaceAreaSquareMeters?: number;
  horizontalAreaSquareMeters?: number;
  averageSlopeDegrees?: number;
  footprintPerimeterMeters?: number;
  confidence?: RoofFusionConfidence;
  confidenceReason?: string;
  blockers?: readonly string[];
  stageBlockers?: Partial<Record<RoofFusionStage, readonly string[]>>;
  guardNotice?: string;
  initialStage?: RoofFusionStage;
  initialLayers?: Partial<Record<RoofFusionLayer, boolean>>;
  onStageChange?: (stage: RoofFusionStage) => void;
  onPrimaryAction?: (stage: RoofFusionStage) => void;
  onOutlineChange?: (points: readonly RoofFusionPoint[]) => void;
  onLineCapture?: (line: RoofFusionLine) => void;
  onLayerVisibilityChange?: (layer: RoofFusionLayer, visible: boolean) => void;
  persistencePanel?: ReactNode;
}>;

export const ROOF_FUSION_STAGES: readonly RoofFusionStage[] = [
  "outline",
  "skeleton",
  "slopes",
  "review",
];

export const DEFAULT_ROOF_FUSION_LAYERS: Readonly<
  Record<RoofFusionLayer, boolean>
> = {
  sourceOutline: true,
  approvedOutline: true,
  hoydedata: false,
  roofPlanes: false,
  skeleton: false,
};

export function clampRoofFusionPoint(point: RoofFusionPoint): RoofFusionPoint {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

function formatNumber(value: number | undefined, suffix = "") {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

const stageLabels: Record<RoofFusionStage, string> = {
  outline: "Kontūras",
  skeleton: "Kraigai ir slėniai",
  slopes: "Nuolydžiai",
  review: "Patikra",
};

const layerLabels: Record<RoofFusionLayer, string> = {
  sourceOutline: "Šaltinio kontūras",
  approvedOutline: "Patvirtintas kontūras",
  hoydedata: "Høydedata",
  roofPlanes: "Stogo plokštumos",
  skeleton: "Kraigai / slėniai / kliūtys",
};

const confidenceLabels: Record<RoofFusionConfidence, string> = {
  high: "Aukštas",
  medium: "Vidutinis",
  low: "Žemas",
};

function pointsAttribute(points: readonly RoofFusionPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function pointFromPointer(
  event: { clientX: number; clientY: number },
  element: SVGSVGElement,
): RoofFusionPoint {
  const bounds = element.getBoundingClientRect();
  const width = bounds.width || element.clientWidth || 1;
  const height = bounds.height || element.clientHeight || 1;
  return clampRoofFusionPoint({
    x: (event.clientX - bounds.left) / width,
    y: (event.clientY - bounds.top) / height,
  });
}

export function AdminNextRoofFusionUnifiedWorkbench({
  orthoImageSrc,
  orthoImageAlt = "Namo ortofoto",
  orthoImageWidth,
  orthoImageHeight,
  orthoAttribution = "©norgeibilder.no",
  sourceOutline,
  approvedOutline,
  roofPlanes = [],
  lines = [],
  heightPoints = [],
  obstacles = [],
  totalSurfaceAreaSquareMeters,
  horizontalAreaSquareMeters,
  averageSlopeDegrees,
  footprintPerimeterMeters,
  confidence = "medium",
  confidenceReason,
  blockers = [],
  stageBlockers,
  guardNotice = "Nieko neišsaugo, kol nepatvirtinta",
  initialStage = "outline",
  initialLayers,
  onStageChange,
  onPrimaryAction,
  onOutlineChange,
  onLineCapture,
  onLayerVisibilityChange,
  persistencePanel,
}: RoofFusionUnifiedWorkbenchProps) {
  const [stage, setStage] = useState<RoofFusionStage>(initialStage);
  const [layerVisibility, setLayerVisibility] = useState(() => ({
    ...DEFAULT_ROOF_FUSION_LAYERS,
    ...initialLayers,
  }));
  const [draftOutline, setDraftOutline] = useState<readonly RoofFusionPoint[]>(
    () => (approvedOutline?.length ? approvedOutline : sourceOutline),
  );
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<number | null>(null);
  const [addingVertex, setAddingVertex] = useState(false);
  const [lineMode, setLineMode] = useState<RoofFusionLineKind | null>(null);
  const [pendingLinePoint, setPendingLinePoint] =
    useState<RoofFusionPoint | null>(null);
  const [lineSequence, setLineSequence] = useState(1);
  const [draftLines, setDraftLines] = useState<readonly RoofFusionLine[]>(
    () => lines,
  );

  const updateOutline = useCallback(
    (next: readonly RoofFusionPoint[]) => {
      const normalized = next.map(clampRoofFusionPoint);
      setDraftOutline(normalized);
      onOutlineChange?.(normalized);
    },
    [onOutlineChange],
  );

  const moveVertex = useCallback(
    (index: number, point: RoofFusionPoint) => {
      if (index < 0 || index >= draftOutline.length) return;
      updateOutline(
        draftOutline.map((current, currentIndex) =>
          currentIndex === index ? clampRoofFusionPoint(point) : current,
        ),
      );
    },
    [draftOutline, updateOutline],
  );

  const removeVertex = useCallback(
    (index: number) => {
      if (draftOutline.length <= 3 || index < 0 || index >= draftOutline.length)
        return;
      updateOutline(
        draftOutline.filter((_, currentIndex) => currentIndex !== index),
      );
      setSelectedVertex(null);
    },
    [draftOutline, updateOutline],
  );

  const handleCanvasClick = useCallback(
    (event: MouseEvent<SVGSVGElement>) => {
      const point = pointFromPointer(event, event.currentTarget);
      if (stage === "outline" && addingVertex) {
        const next = [...draftOutline];
        const nearestIndex = next.reduce(
          (nearest, current, index) =>
            Math.hypot(current.x - point.x, current.y - point.y) <
            Math.hypot(next[nearest].x - point.x, next[nearest].y - point.y)
              ? index
              : nearest,
          0,
        );
        next.splice(nearestIndex + 1, 0, point);
        updateOutline(next);
        setAddingVertex(false);
        return;
      }
      if (stage !== "skeleton" || !lineMode) return;
      if (!pendingLinePoint) {
        setPendingLinePoint(point);
        return;
      }
      const capturedLine: RoofFusionLine = {
        id: `manual-line-${lineSequence}`,
        kind: lineMode,
        start: pendingLinePoint,
        end: point,
      };
      setDraftLines((current) => [...current, capturedLine]);
      setLineSequence((current) => current + 1);
      setPendingLinePoint(null);
      onLineCapture?.(capturedLine);
    },
    [
      addingVertex,
      draftOutline,
      lineMode,
      lineSequence,
      onLineCapture,
      pendingLinePoint,
      stage,
      updateOutline,
    ],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (draggingVertex === null || stage !== "outline") return;
      moveVertex(draggingVertex, pointFromPointer(event, event.currentTarget));
    },
    [draggingVertex, moveVertex, stage],
  );

  const handleVertexKeyDown = useCallback(
    (event: KeyboardEvent<SVGCircleElement>, index: number) => {
      const current = draftOutline[index];
      if (!current) return;
      const step = event.shiftKey ? 0.05 : 0.01;
      const deltas: Record<string, RoofFusionPoint> = {
        ArrowLeft: { x: current.x - step, y: current.y },
        ArrowRight: { x: current.x + step, y: current.y },
        ArrowUp: { x: current.x, y: current.y - step },
        ArrowDown: { x: current.x, y: current.y + step },
      };
      const next = deltas[event.key];
      if (next) {
        event.preventDefault();
        setSelectedVertex(index);
        moveVertex(index, next);
      }
    },
    [draftOutline, moveVertex],
  );

  const setLayer = useCallback(
    (layer: RoofFusionLayer) => {
      setLayerVisibility((current) => {
        const visible = !current[layer];
        onLayerVisibilityChange?.(layer, visible);
        return { ...current, [layer]: visible };
      });
    },
    [onLayerVisibilityChange],
  );

  const goToStage = useCallback(
    (nextStage: RoofFusionStage) => {
      setStage(nextStage);
      if (nextStage === "skeleton") {
        setLayerVisibility((current) => ({ ...current, skeleton: true }));
      }
      setLineMode(null);
      setPendingLinePoint(null);
      setAddingVertex(false);
      onStageChange?.(nextStage);
    },
    [onStageChange],
  );

  const primaryActionLabel = useMemo(() => {
    if (stage === "outline") return "Patvirtinti kontūrą";
    if (stage === "skeleton") return "Patvirtinti kraigus ir slėnius";
    if (stage === "slopes") return "Apskaičiuoti nuolydžius";
    return "Patvirtinti R4 matavimą";
  }, [stage]);

  const activeBlockers = useMemo(
    () => [...blockers, ...(stageBlockers?.[stage] ?? [])],
    [blockers, stage, stageBlockers],
  );

  const handlePrimaryAction = useCallback(() => {
    if (activeBlockers.length) return;
    onPrimaryAction?.(stage);
    const currentIndex = ROOF_FUSION_STAGES.indexOf(stage);
    const nextStage = ROOF_FUSION_STAGES[currentIndex + 1];
    if (nextStage) goToStage(nextStage);
  }, [activeBlockers.length, goToStage, onPrimaryAction, stage]);

  const displayLines = [
    ...draftLines,
    ...(pendingLinePoint && lineMode
      ? [
          {
            id: "pending-line",
            kind: lineMode,
            start: pendingLinePoint,
            end: pendingLinePoint,
          },
        ]
      : []),
  ];

  return (
    <section
      aria-label="Roof Fusion vieno lango matavimo darbo vieta"
      className="overflow-hidden rounded-3xl border border-white/10 bg-[#111722] text-[#f4f1ea] shadow-2xl shadow-black/30"
      data-roof-fusion-workbench="unified"
      data-roof-fusion-stage={stage}
    >
      <div className="flex flex-col gap-0 xl:flex-row">
        <div className="min-w-0 flex-1 bg-[#0c111a] p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e8a317] uppercase">
                Roof Fusion · Preview
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                Sudėtingo stogo matavimas
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[#c4c0b8]">
                Viename ortofoto lange pažymėkite tik tai, ko sistema negali
                patikimai nustatyti pati.
              </p>
            </div>
            <span className="rounded-full border border-[#e8a317]/30 bg-[#e8a317]/10 px-3 py-1.5 text-xs font-medium text-[#f3c66b]">
              {guardNotice}
            </span>
          </div>

          <nav
            aria-label="Matavimo etapai"
            className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-[#171e2a] p-1"
          >
            {ROOF_FUSION_STAGES.map((item, index) => (
              <button
                aria-current={item === stage ? "step" : undefined}
                className={`min-h-11 rounded-xl px-2 py-2 text-left text-xs transition sm:px-3 ${item === stage ? "bg-[#e8a317] font-semibold text-[#101318]" : "text-[#bdb9b0] hover:bg-white/5"}`}
                data-roof-fusion-stage-tab={item}
                key={item}
                onClick={() => goToStage(item)}
                type="button"
              >
                <span className="mr-1.5 opacity-60">0{index + 1}</span>
                {stageLabels[item]}
              </button>
            ))}
          </nav>

          <div
            className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#202938]"
            data-roof-fusion-canvas-shell
            style={{
              aspectRatio:
                orthoImageWidth && orthoImageHeight
                  ? `${orthoImageWidth} / ${orthoImageHeight}`
                  : "4 / 3",
            }}
          >
            {/* Dynamic authenticated/data URLs cannot use the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={orthoImageAlt}
              className="absolute inset-0 h-full w-full object-contain"
              src={orthoImageSrc}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08101a]/55 via-transparent to-[#08101a]/10" />
            <svg
              aria-label="Stogo žymėjimo sluoksniai"
              className="absolute inset-0 h-full w-full touch-none"
              data-roof-fusion-canvas
              onClick={handleCanvasClick}
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDraggingVertex(null)}
              onPointerLeave={() => setDraggingVertex(null)}
              role="img"
              preserveAspectRatio="none"
              viewBox="0 0 1 1"
              xmlns="http://www.w3.org/2000/svg"
            >
              {layerVisibility.hoydedata && (
                <g data-roof-fusion-layer="hoydedata">
                  {heightPoints.map((item, index) => (
                    <circle
                      cx={item.point.x}
                      cy={item.point.y}
                      fill="#55b7dc"
                      key={index}
                      opacity=".72"
                      r=".012"
                    />
                  ))}
                </g>
              )}
              {layerVisibility.roofPlanes && (
                <g data-roof-fusion-layer="roofPlanes">
                  {roofPlanes.map((plane, index) => (
                    <polygon
                      fill={index % 2 ? "#ef9b4f" : "#55c7a3"}
                      fillOpacity=".22"
                      key={plane.id}
                      points={pointsAttribute(plane.points)}
                      stroke={index % 2 ? "#ef9b4f" : "#55c7a3"}
                      strokeWidth=".004"
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>
                        {plane.label ?? `Stogo plokštuma ${index + 1}`}
                      </title>
                    </polygon>
                  ))}
                </g>
              )}
              {layerVisibility.sourceOutline && sourceOutline.length >= 3 && (
                <polygon
                  data-roof-fusion-layer="sourceOutline"
                  fill="none"
                  points={pointsAttribute(sourceOutline)}
                  stroke="#f3c66b"
                  strokeDasharray=".012 .009"
                  strokeWidth=".006"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {layerVisibility.approvedOutline && draftOutline.length >= 3 && (
                <polygon
                  data-roof-fusion-layer="approvedOutline"
                  fill="#46d69a"
                  fillOpacity=".08"
                  points={pointsAttribute(draftOutline)}
                  stroke="#46d69a"
                  strokeWidth=".007"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {layerVisibility.skeleton && (
                <g data-roof-fusion-layer="skeleton">
                  {displayLines.map((line) => (
                    <line
                      data-roof-fusion-line-kind={line.kind}
                      key={line.id}
                      stroke={line.kind === "ridge" ? "#f8d164" : "#8cb8ff"}
                      strokeDasharray={
                        line.id === "pending-line" ? ".012 .009" : undefined
                      }
                      strokeWidth=".008"
                      vectorEffect="non-scaling-stroke"
                      x1={line.start.x}
                      x2={line.end.x}
                      y1={line.start.y}
                      y2={line.end.y}
                    />
                  ))}
                  {obstacles.map((obstacle) => (
                    <circle
                      cx={obstacle.point.x}
                      cy={obstacle.point.y}
                      data-roof-fusion-obstacle={obstacle.id}
                      fill="#ef7676"
                      key={obstacle.id}
                      r=".015"
                      stroke="#fff"
                      strokeWidth=".003"
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{obstacle.label ?? "Kliūtis"}</title>
                    </circle>
                  ))}
                </g>
              )}
              {stage === "outline" &&
                draftOutline.map((point, index) => (
                  <circle
                    aria-label={`Kontūro taškas ${index + 1}. Rodyklėmis perkelti.`}
                    className="cursor-move outline-none"
                    cx={point.x}
                    cy={point.y}
                    data-roof-fusion-vertex={index}
                    fill={selectedVertex === index ? "#fff" : "#46d69a"}
                    key={`vertex-${index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedVertex(index);
                    }}
                    onKeyDown={(event) => handleVertexKeyDown(event, index)}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelectedVertex(index);
                      setDraggingVertex(index);
                    }}
                    r={selectedVertex === index ? ".025" : ".018"}
                    role="button"
                    tabIndex={0}
                    stroke="#0b111a"
                    strokeWidth=".006"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              {pendingLinePoint && (
                <circle
                  cx={pendingLinePoint.x}
                  cy={pendingLinePoint.y}
                  fill="#fff"
                  r=".014"
                  stroke="#e8a317"
                  strokeWidth=".006"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px] font-medium">
              <span className="rounded-full border border-[#f3c66b]/50 bg-[#111722]/85 px-2.5 py-1 text-[#f3c66b]">
                — Šaltinis (nekintamas)
              </span>
              <span className="rounded-full border border-[#46d69a]/50 bg-[#111722]/85 px-2.5 py-1 text-[#71e6b4]">
                — Patvirtinta
              </span>
            </div>
            <span className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-black/75 px-2 py-1 text-[10px] font-semibold text-white">
              {orthoAttribution}
            </span>
            {addingVertex && (
              <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-[#e8a317] px-3 py-1.5 text-xs font-semibold text-[#101318]">
                Spustelėkite vietą naujam taškui
              </div>
            )}
          </div>

          {stage === "outline" && (
            <div
              className="mt-3 flex flex-wrap items-center gap-2"
              data-roof-fusion-outline-tools
            >
              <button
                aria-pressed={addingVertex}
                className={`min-h-10 rounded-xl border px-3 text-sm font-medium ${addingVertex ? "border-[#e8a317] bg-[#e8a317]/15 text-[#f3c66b]" : "border-white/15 bg-white/5 text-[#ddd8cd] hover:bg-white/10"}`}
                onClick={() => setAddingVertex((current) => !current)}
                type="button"
              >
                + Pridėti kontūro tašką
              </button>
              <button
                className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={selectedVertex === null || draftOutline.length <= 3}
                onClick={() =>
                  selectedVertex !== null && removeVertex(selectedVertex)
                }
                type="button"
              >
                − Pašalinti pasirinktą
              </button>
              <span className="text-xs text-[#aaa69d]">
                Tašką galima tempti pele, paliesti arba perkelti rodyklėmis.
              </span>
            </div>
          )}

          {stage === "skeleton" && (
            <div
              className="mt-3 flex flex-wrap items-center gap-2"
              data-roof-fusion-skeleton-tools
            >
              <span className="mr-1 text-xs text-[#aaa69d]">
                Nubrėžti dviem paspaudimais:
              </span>
              {(["ridge", "valley"] as const).map((kind) => (
                <button
                  aria-pressed={lineMode === kind}
                  className={`min-h-10 rounded-xl border px-3 text-sm font-medium ${lineMode === kind ? "border-[#e8a317] bg-[#e8a317]/15 text-[#f3c66b]" : "border-white/15 bg-white/5 text-[#ddd8cd] hover:bg-white/10"}`}
                  data-roof-fusion-line-mode={kind}
                  key={kind}
                  onClick={() => {
                    setLineMode((current) => (current === kind ? null : kind));
                    setPendingLinePoint(null);
                  }}
                  type="button"
                >
                  {kind === "ridge" ? "＋ Kraigas" : "⌄ Slėnis"}
                </button>
              ))}
              <span className="text-xs text-[#aaa69d]">
                {lineMode
                  ? pendingLinePoint
                    ? "Pasirinkite antrą tašką"
                    : "Pasirinkite pirmą tašką"
                  : ""}
              </span>
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 border-t border-white/10 bg-[#151c28] p-4 sm:p-5 xl:w-[360px] xl:border-t-0 xl:border-l">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#f5f0e8]">
                Sluoksniai
              </h3>
              <p className="mt-1 text-xs text-[#aaa69d]">
                Techniniai sluoksniai įjungti tik tada, kai jų reikia.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {(Object.keys(layerLabels) as RoofFusionLayer[]).map(
                  (layer) => (
                    <button
                      aria-pressed={layerVisibility[layer]}
                      className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-[#0f151f] px-3 text-left text-sm hover:border-white/20"
                      data-roof-fusion-layer-toggle={layer}
                      key={layer}
                      onClick={() => setLayer(layer)}
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`h-2.5 w-2.5 rounded-full ${layerVisibility[layer] ? "bg-[#46d69a]" : "bg-[#626b79]"}`}
                        />
                        {layerLabels[layer]}
                      </span>
                      <span className="text-xs text-[#aaa69d]">
                        {layerVisibility[layer] ? "Rodyti" : "Paslėpta"}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>

            <div
              aria-live="polite"
              className="rounded-2xl border border-white/10 bg-[#0f151f] p-3"
              data-roof-fusion-status
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-[0.12em] text-[#aaa69d] uppercase">
                  Patikimumas
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${confidence === "high" ? "bg-[#46d69a]/15 text-[#71e6b4]" : confidence === "medium" ? "bg-[#e8a317]/15 text-[#f3c66b]" : "bg-[#ef7676]/15 text-[#ff9d9d]"}`}
                >
                  {confidenceLabels[confidence]}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#ddd8cd]">
                {confidenceReason ??
                  "Patikimumas bus patikslintas po nuolydžio skaičiavimo."}
              </p>
              <div className="mt-3 border-t border-white/10 pt-3">
                <span className="text-xs font-semibold tracking-[0.12em] text-[#aaa69d] uppercase">
                  Blokatoriai
                </span>
                {activeBlockers.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#ffadad]">
                    {activeBlockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-[#71e6b4]">
                    Nėra — galima tęsti.
                  </p>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2" data-roof-fusion-metrics>
              <div className="rounded-xl border border-white/10 bg-[#0f151f] p-3">
                <dt className="text-[11px] text-[#aaa69d]">Horizontalus</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatNumber(horizontalAreaSquareMeters, " m²")}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f151f] p-3">
                <dt className="text-[11px] text-[#aaa69d]">Tikras paviršius</dt>
                <dd className="mt-1 text-lg font-semibold text-[#f3c66b]">
                  {formatNumber(totalSurfaceAreaSquareMeters, " m²")}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f151f] p-3">
                <dt className="text-[11px] text-[#aaa69d]">
                  Vidutinis nuolydis
                </dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatNumber(averageSlopeDegrees, "°")}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f151f] p-3">
                <dt className="text-[11px] text-[#aaa69d]">Perimetras</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatNumber(footprintPerimeterMeters, " m")}
                </dd>
              </div>
            </dl>

            <div className="rounded-2xl border border-[#e8a317]/25 bg-[#e8a317]/10 p-3 text-xs leading-relaxed text-[#ddd8cd]">
              <strong className="text-[#f3c66b]">
                Šaltinio kontūras nekintamas.
              </strong>{" "}
              Jis lieka matomas brūkšniuota linija, o pataisymai kuriami kaip
              atskiras patvirtintas kontūras.
            </div>

            {persistencePanel}

            <button
              className="min-h-12 w-full rounded-xl bg-[#e8a317] px-4 py-3 text-sm font-bold text-[#101318] shadow-lg shadow-[#e8a317]/10 transition hover:bg-[#f0b12e] disabled:cursor-not-allowed disabled:opacity-45"
              data-roof-fusion-primary-action={stage}
              disabled={activeBlockers.length > 0}
              onClick={handlePrimaryAction}
              type="button"
            >
              {primaryActionLabel}
            </button>
            {activeBlockers.length > 0 && (
              <p className="text-center text-xs text-[#ffadad]">
                Pirmiausia išspręskite blokatorius.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
