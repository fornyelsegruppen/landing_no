"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  assertWorkbenchSkeletonLineLengthV1,
  constrainWorkbenchPointToOutlineV1,
  type WorkbenchEndpointConstraintMetricV1,
  WORKBENCH_ENDPOINT_SNAP_TOLERANCE_PX,
  WorkbenchSkeletonEndpointErrorV1,
  WorkbenchSkeletonZeroLengthErrorV1,
} from "@/lib/roof-fusion/workbench-ui-client-v1";

/** Coordinates are normalized to the image surface (0..1). */
export type RoofFusionPoint = Readonly<{ x: number; y: number }>;

export type RoofFusionViewport = Readonly<{
  scale: number;
  /** Translation in visible-canvas fractions after scaling. */
  offsetX: number;
  offsetY: number;
}>;

export const MIN_ROOF_FUSION_ZOOM = 1;
export const MAX_ROOF_FUSION_ZOOM = 4;
export const ROOF_FUSION_PAN_THRESHOLD_PX = 5;
export const ROOF_FUSION_SKELETON_LINE_STROKE = "1px";
export const ROOF_FUSION_PENDING_LINE_STROKE = "1px";
export const ROOF_FUSION_SKELETON_ENDPOINT_RADIUS = 0.003;
export const ROOF_FUSION_SKELETON_ENDPOINT_CENTER_RADIUS = 0.0015;
export const ROOF_FUSION_SKELETON_HIT_RADIUS = 0.022;
export const ROOF_FUSION_SKELETON_HIT_STROKE = "22px";
export const DEFAULT_ROOF_FUSION_VIEWPORT: RoofFusionViewport = {
  scale: MIN_ROOF_FUSION_ZOOM,
  offsetX: 0,
  offsetY: 0,
};

export type RoofFusionStage = "outline" | "skeleton" | "slopes" | "review";
export type RoofFusionOneCardStep = "object" | "refine" | "result";
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
  horizontalAreaSquareMeters?: number;
  areaSquareMeters?: number;
  netAreaSquareMeters?: number;
  slopeDegrees?: number;
  azimuthDegrees?: number;
  confidence?: RoofFusionConfidence;
  confidenceReason?: string;
}>;

export type RoofFusionResultIdentity = Readonly<{
  snapshotId: string;
  revision: number;
  snapshotHash: string;
  measurementMethod: string;
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

type RoofFusionPanGesture = Readonly<{
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewport: RoofFusionViewport;
  moved: boolean;
}>;

type RoofFusionLineEndpointDrag = Readonly<{
  lineId: string;
  endpoint: "start" | "end";
  pointerId: number;
  moved: boolean;
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
  resultIdentity?: RoofFusionResultIdentity;
  blockers?: readonly string[];
  stageBlockers?: Partial<Record<RoofFusionStage, readonly string[]>>;
  guardNotice?: string;
  /** Changes only when the parent explicitly rehydrates persisted geometry. */
  geometryHydrationSignal?: string | number;
  initialStage?: RoofFusionStage;
  initialLayers?: Partial<Record<RoofFusionLayer, boolean>>;
  onStageChange?: (stage: RoofFusionStage) => void;
  /** Return false (or resolve false) to keep the current stage. */
  onPrimaryAction?: (
    stage: RoofFusionStage,
  ) => void | boolean | Promise<void | boolean>;
  onOutlineChange?: (points: readonly RoofFusionPoint[]) => void;
  onLineCapture?: (line: RoofFusionLine) => void;
  onLineChange?: (line: RoofFusionLine) => void;
  onLastLineUndo?: (line: RoofFusionLine) => void;
  onLinesClear?: (lines: readonly RoofFusionLine[]) => void;
  onLayerVisibilityChange?: (layer: RoofFusionLayer, visible: boolean) => void;
  persistencePanel?: ReactNode;
  /** Primary-flow source loading/success/retry status. */
  sourceStatusPanel?: ReactNode;
  /** Secondary source actions supplied by the Preview UAT wrapper. */
  advancedPanel?: ReactNode;
  /** Reserved integration point for the legacy manual calculation fallback. */
  legacyFallbackPanel?: ReactNode;
  onChangeBuilding?: () => void;
  onEditResult?: () => void;
}>;

export const ROOF_FUSION_STAGES: readonly RoofFusionStage[] = [
  "outline",
  "skeleton",
  "slopes",
  "review",
];

export const ROOF_FUSION_ONE_CARD_STEPS: readonly RoofFusionOneCardStep[] = [
  "object",
  "refine",
  "result",
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

export function clampRoofFusionViewport(
  viewport: RoofFusionViewport,
): RoofFusionViewport {
  const requestedScale = Number.isFinite(viewport.scale)
    ? viewport.scale
    : MIN_ROOF_FUSION_ZOOM;
  const scale = Math.min(
    MAX_ROOF_FUSION_ZOOM,
    Math.max(MIN_ROOF_FUSION_ZOOM, requestedScale),
  );
  if (scale === MIN_ROOF_FUSION_ZOOM) {
    return DEFAULT_ROOF_FUSION_VIEWPORT;
  }
  const minimumOffset = 1 - scale;
  const clampOffset = (value: number) =>
    Math.min(0, Math.max(minimumOffset, Number.isFinite(value) ? value : 0));
  return {
    scale,
    offsetX: clampOffset(viewport.offsetX),
    offsetY: clampOffset(viewport.offsetY),
  };
}

export function zoomRoofFusionViewportAt(
  viewport: RoofFusionViewport,
  requestedScale: number,
  anchor: RoofFusionPoint = { x: 0.5, y: 0.5 },
): RoofFusionViewport {
  const current = clampRoofFusionViewport(viewport);
  const nextScale = Math.min(
    MAX_ROOF_FUSION_ZOOM,
    Math.max(MIN_ROOF_FUSION_ZOOM, requestedScale),
  );
  if (nextScale === MIN_ROOF_FUSION_ZOOM) {
    return DEFAULT_ROOF_FUSION_VIEWPORT;
  }
  const safeAnchor = clampRoofFusionPoint(anchor);
  const imageX = (safeAnchor.x - current.offsetX) / current.scale;
  const imageY = (safeAnchor.y - current.offsetY) / current.scale;
  return clampRoofFusionViewport({
    scale: nextScale,
    offsetX: safeAnchor.x - imageX * nextScale,
    offsetY: safeAnchor.y - imageY * nextScale,
  });
}

export function panRoofFusionViewport(
  viewport: RoofFusionViewport,
  delta: RoofFusionPoint,
): RoofFusionViewport {
  const current = clampRoofFusionViewport(viewport);
  if (current.scale === MIN_ROOF_FUSION_ZOOM) {
    return DEFAULT_ROOF_FUSION_VIEWPORT;
  }
  return clampRoofFusionViewport({
    ...current,
    offsetX: current.offsetX + delta.x,
    offsetY: current.offsetY + delta.y,
  });
}

/** Maps a point on the visible canvas back to the original image coordinate. */
export function roofFusionImagePointFromViewportPoint(
  point: RoofFusionPoint,
  viewport: RoofFusionViewport,
): RoofFusionPoint {
  const current = clampRoofFusionViewport(viewport);
  return clampRoofFusionPoint({
    x: (point.x - current.offsetX) / current.scale,
    y: (point.y - current.offsetY) / current.scale,
  });
}

export function shouldHandleRoofFusionZoomWheel(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}) {
  return event.ctrlKey || event.metaKey;
}

export function hasRoofFusionPanGestureMoved(
  start: Readonly<{ clientX: number; clientY: number }>,
  current: Readonly<{ clientX: number; clientY: number }>,
  threshold = ROOF_FUSION_PAN_THRESHOLD_PX,
) {
  return (
    Math.hypot(
      current.clientX - start.clientX,
      current.clientY - start.clientY,
    ) >= threshold
  );
}

export function shouldSuppressRoofFusionCanvasClick(
  gesture: Readonly<{ moved: boolean }> | null,
) {
  return gesture?.moved === true;
}

export function roofFusionScreenStableMarkerRadii(
  baseRadius: number,
  canvasAspectRatio: number,
  scale: number,
) {
  const safeScale = Math.min(
    MAX_ROOF_FUSION_ZOOM,
    Math.max(MIN_ROOF_FUSION_ZOOM, scale),
  );
  const safeAspectRatio =
    Number.isFinite(canvasAspectRatio) && canvasAspectRatio > 0
      ? canvasAspectRatio
      : 1;
  return {
    rx: baseRadius / safeScale,
    ry: (baseRadius * safeAspectRatio) / safeScale,
  };
}

export function roofFusionEndpointConstraintMetric(
  bounds: Pick<DOMRect, "width" | "height">,
  viewport: RoofFusionViewport,
): WorkbenchEndpointConstraintMetricV1 {
  const current = clampRoofFusionViewport(viewport);
  return {
    xPixelsPerImageUnit: Math.max(1, bounds.width) * current.scale,
    yPixelsPerImageUnit: Math.max(1, bounds.height) * current.scale,
    maxDistancePixels: WORKBENCH_ENDPOINT_SNAP_TOLERANCE_PX,
  };
}

function distanceInConstraintPixels(
  first: RoofFusionPoint,
  second: RoofFusionPoint,
  metric: WorkbenchEndpointConstraintMetricV1,
) {
  return Math.hypot(
    (first.x - second.x) * metric.xPixelsPerImageUnit,
    (first.y - second.y) * metric.yPixelsPerImageUnit,
  );
}

function closestPointOnSegment(
  point: RoofFusionPoint,
  start: RoofFusionPoint,
  end: RoofFusionPoint,
) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) return start;
  const position = Math.min(
    1,
    Math.max(
      0,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
    ),
  );
  return {
    x: start.x + position * deltaX,
    y: start.y + position * deltaY,
  };
}

function closestPointOnOutline(
  point: RoofFusionPoint,
  outline: readonly RoofFusionPoint[],
) {
  let closest = outline[0] ?? point;
  let closestDistance = Number.POSITIVE_INFINITY;
  outline.forEach((start, index) => {
    const end = outline[(index + 1) % outline.length];
    if (!end) return;
    const candidate = closestPointOnSegment(point, start, end);
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  });
  return closest;
}

function pointIsInsideOutline(
  point: RoofFusionPoint,
  outline: readonly RoofFusionPoint[],
) {
  if (outline.length < 3) return false;
  if (
    Math.hypot(
      closestPointOnOutline(point, outline).x - point.x,
      closestPointOnOutline(point, outline).y - point.y,
    ) <= 1e-9
  ) {
    return true;
  }
  let inside = false;
  for (
    let index = 0, previous = outline.length - 1;
    index < outline.length;
    previous = index++
  ) {
    const currentPoint = outline[index];
    const previousPoint = outline[previous];
    if (!currentPoint || !previousPoint) continue;
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function lineIntersection(
  first: RoofFusionLine,
  second: RoofFusionLine,
): RoofFusionPoint | null {
  const firstDelta = {
    x: first.end.x - first.start.x,
    y: first.end.y - first.start.y,
  };
  const secondDelta = {
    x: second.end.x - second.start.x,
    y: second.end.y - second.start.y,
  };
  const denominator =
    firstDelta.x * secondDelta.y - firstDelta.y * secondDelta.x;
  if (Math.abs(denominator) <= 1e-12) return null;
  const offset = {
    x: second.start.x - first.start.x,
    y: second.start.y - first.start.y,
  };
  const firstPosition =
    (offset.x * secondDelta.y - offset.y * secondDelta.x) / denominator;
  const secondPosition =
    (offset.x * firstDelta.y - offset.y * firstDelta.x) / denominator;
  if (
    firstPosition < 0 ||
    firstPosition > 1 ||
    secondPosition < 0 ||
    secondPosition > 1
  ) {
    return null;
  }
  return {
    x: first.start.x + firstPosition * firstDelta.x,
    y: first.start.y + firstPosition * firstDelta.y,
  };
}

export function roofFusionLineJunctionTargets(
  lines: readonly RoofFusionLine[],
  excludedLineId?: string,
  nearPoint?: RoofFusionPoint,
) {
  const candidates = lines.filter((line) => line.id !== excludedLineId);
  const targets = candidates.flatMap((line) => [line.start, line.end]);
  if (nearPoint) {
    candidates.forEach((line) => {
      targets.push(closestPointOnSegment(nearPoint, line.start, line.end));
    });
  }
  candidates.forEach((line, index) => {
    candidates.slice(index + 1).forEach((other) => {
      const intersection = lineIntersection(line, other);
      if (intersection) targets.push(intersection);
    });
  });
  return targets;
}

export function constrainRoofFusionDraggedEndpoint(
  point: RoofFusionPoint,
  outline: readonly RoofFusionPoint[],
  snapTargets: readonly RoofFusionPoint[],
  metric: WorkbenchEndpointConstraintMetricV1,
) {
  const safePoint = clampRoofFusionPoint(point);
  if (outline.length < 3) return safePoint;
  const boundaryPoint = closestPointOnOutline(safePoint, outline);
  const inside = pointIsInsideOutline(safePoint, outline);
  let constrained = inside ? safePoint : boundaryPoint;
  let closestSnapDistance = inside
    ? distanceInConstraintPixels(safePoint, boundaryPoint, metric)
    : Number.POSITIVE_INFINITY;
  if (inside && closestSnapDistance > metric.maxDistancePixels) {
    closestSnapDistance = Number.POSITIVE_INFINITY;
  } else if (inside) {
    constrained = boundaryPoint;
  }
  snapTargets.forEach((target) => {
    if (!pointIsInsideOutline(target, outline)) return;
    const distance = distanceInConstraintPixels(safePoint, target, metric);
    if (
      distance <= metric.maxDistancePixels &&
      distance < closestSnapDistance
    ) {
      constrained = target;
      closestSnapDistance = distance;
    }
  });
  return constrained;
}

function formatNumber(value: number | undefined, suffix = "") {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

const oneCardStepLabels: Record<RoofFusionOneCardStep, string> = {
  object: "Objektas",
  refine: "Patikslinimas",
  result: "Rezultatas",
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

function restoredMarkingSummary(lines: readonly RoofFusionLine[]) {
  if (lines.length === 0) return null;
  const ridgeCount = lines.filter((line) => line.kind === "ridge").length;
  const valleyCount = lines.length - ridgeCount;
  return `Atkurtas ankstesnis žymėjimas · kraigai: ${ridgeCount} · slėniai: ${valleyCount}`;
}

function drawnLineSummary(kind: RoofFusionLineKind, count: number) {
  const singular = kind === "ridge" ? "kraigas" : "slėnis";
  const plural = kind === "ridge" ? "kraigai" : "slėniai";
  const genitive = kind === "ridge" ? "kraigų" : "slėnių";
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  const noun =
    count === 1
      ? singular
      : lastTwoDigits >= 10 && lastTwoDigits <= 20
        ? genitive
        : lastDigit >= 2 && lastDigit <= 9
          ? plural
          : genitive;
  return `Nubrėžta: ${count} ${noun}`;
}

function pointsAttribute(points: readonly RoofFusionPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function pointFromPointer(
  event: { clientX: number; clientY: number },
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
  viewport: RoofFusionViewport,
): RoofFusionPoint {
  const width = bounds.width || 1;
  const height = bounds.height || 1;
  return roofFusionImagePointFromViewportPoint(
    {
      x: (event.clientX - bounds.left) / width,
      y: (event.clientY - bounds.top) / height,
    },
    viewport,
  );
}

export function AdminNextRoofFusionUnifiedWorkbench({
  advancedPanel,
  sourceStatusPanel,
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
  resultIdentity,
  blockers = [],
  stageBlockers,
  guardNotice = "Nieko neišsaugo, kol nepatvirtinta",
  geometryHydrationSignal,
  initialStage = "outline",
  initialLayers,
  onStageChange,
  onPrimaryAction,
  onOutlineChange,
  onLineCapture,
  onLineChange,
  onLastLineUndo,
  onLinesClear,
  onLayerVisibilityChange,
  persistencePanel,
  legacyFallbackPanel,
  onChangeBuilding,
  onEditResult,
}: RoofFusionUnifiedWorkbenchProps) {
  const canvasShellRef = useRef<HTMLDivElement>(null);
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
  const [primaryActionPending, setPrimaryActionPending] = useState(false);
  const [lineCaptureProblem, setLineCaptureProblem] = useState<string | null>(
    null,
  );
  const [lineCaptureNotice, setLineCaptureNotice] = useState<string | null>(
    null,
  );
  const [lineSequence, setLineSequence] = useState(1);
  const [draftLines, setDraftLines] = useState<readonly RoofFusionLine[]>(
    () => lines,
  );
  const [restoredMarkingNotice, setRestoredMarkingNotice] = useState(() =>
    restoredMarkingSummary(lines),
  );
  const [clearLinesArmed, setClearLinesArmed] = useState(false);
  const [draggingLineEndpoint, setDraggingLineEndpoint] =
    useState<RoofFusionLineEndpointDrag | null>(null);
  const draggingLineEndpointRef = useRef<RoofFusionLineEndpointDrag | null>(
    null,
  );
  const draftLinesRef = useRef(draftLines);
  const lastGeometryHydrationSignalRef = useRef(geometryHydrationSignal);
  const [viewport, setViewport] = useState<RoofFusionViewport>(
    DEFAULT_ROOF_FUSION_VIEWPORT,
  );
  const [panGesture, setPanGesture] = useState<RoofFusionPanGesture | null>(
    null,
  );
  const panGestureMovedRef = useRef(false);
  const suppressCanvasClickRef = useRef(false);
  const [approvedOutlineFillOpacity, setApprovedOutlineFillOpacity] =
    useState(8);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedDialogRef = useRef<HTMLElement>(null);
  const advancedTriggerRef = useRef<HTMLButtonElement>(null);
  const [selectedRoofPlaneId, setSelectedRoofPlaneId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!advancedOpen) return;
    const previouslyFocused = document.activeElement;
    const restoreTarget = advancedTriggerRef.current;
    const dialog = advancedDialogRef.current;
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => !element.hasAttribute("aria-hidden"));
    focusable()[0]?.focus();

    const handleDialogKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAdvancedOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused !== document.body
      ) {
        previouslyFocused.focus();
      } else {
        restoreTarget?.focus();
      }
    };
  }, [advancedOpen]);

  useEffect(() => {
    if (
      Object.is(lastGeometryHydrationSignalRef.current, geometryHydrationSignal)
    )
      return;
    lastGeometryHydrationSignalRef.current = geometryHydrationSignal;
    setDraftOutline(
      (approvedOutline?.length ? approvedOutline : sourceOutline).map(
        clampRoofFusionPoint,
      ),
    );
    setDraftLines(lines);
    setRestoredMarkingNotice(restoredMarkingSummary(lines));
    setClearLinesArmed(false);
  }, [approvedOutline, geometryHydrationSignal, lines, sourceOutline]);

  useEffect(() => {
    draftLinesRef.current = draftLines;
  }, [draftLines]);

  const getCanvasBounds = useCallback(
    () => canvasShellRef.current?.getBoundingClientRect() ?? null,
    [],
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

  const activateCanvasPoint = useCallback(
    (
      point: RoofFusionPoint,
      endpointMetric?: WorkbenchEndpointConstraintMetricV1,
    ) => {
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
      let constrainedPoint: RoofFusionPoint;
      try {
        constrainedPoint = constrainWorkbenchPointToOutlineV1(
          point,
          draftOutline,
          endpointMetric,
        );
      } catch (error) {
        setLineCaptureNotice(null);
        setLineCaptureProblem(
          error instanceof WorkbenchSkeletonEndpointErrorV1
            ? error.message
            : "SKELETON_ENDPOINT_OUTSIDE_MASS: Pasirinkite tašką patvirtinto kontūro viduje.",
        );
        return;
      }
      const snapped =
        constrainedPoint.x !== point.x || constrainedPoint.y !== point.y;
      setLineCaptureNotice(
        snapped
          ? `Taškas magnetiškai pritrauktas prie patvirtinto kontūro (${WORKBENCH_ENDPOINT_SNAP_TOLERANCE_PX} px).`
          : null,
      );
      setLineCaptureProblem(null);
      if (!pendingLinePoint) {
        setPendingLinePoint(constrainedPoint);
        return;
      }
      try {
        assertWorkbenchSkeletonLineLengthV1(pendingLinePoint, constrainedPoint);
      } catch (error) {
        setLineCaptureNotice(null);
        setLineCaptureProblem(
          error instanceof WorkbenchSkeletonZeroLengthErrorV1
            ? error.message
            : "SKELETON_ZERO_LENGTH: Pasirinkite kitą antrą tašką.",
        );
        return;
      }
      const capturedLine: RoofFusionLine = {
        id: `manual-line-${lineSequence}`,
        kind: lineMode,
        start: pendingLinePoint,
        end: constrainedPoint,
      };
      setDraftLines((current) => [...current, capturedLine]);
      const completedKindCount =
        draftLines.filter((line) => line.kind === lineMode).length + 1;
      setLineSequence((current) => current + 1);
      setPendingLinePoint(null);
      setLineMode(null);
      setLineCaptureNotice(drawnLineSummary(lineMode, completedKindCount));
      onLineCapture?.(capturedLine);
    },
    [
      addingVertex,
      draftOutline,
      draftLines,
      lineMode,
      lineSequence,
      onLineCapture,
      pendingLinePoint,
      stage,
      updateOutline,
    ],
  );

  const handleCanvasClick = useCallback(
    (event: MouseEvent<SVGSVGElement>) => {
      if (suppressCanvasClickRef.current) {
        suppressCanvasClickRef.current = false;
        event.preventDefault();
        return;
      }
      const bounds = getCanvasBounds();
      if (!bounds) return;
      activateCanvasPoint(
        pointFromPointer(event, bounds, viewport),
        roofFusionEndpointConstraintMetric(bounds, viewport),
      );
    },
    [activateCanvasPoint, getCanvasBounds, viewport],
  );

  const undoLastLine = useCallback(() => {
    const lastLine = draftLines.at(-1);
    if (!lastLine) return;
    setDraftLines((current) => current.slice(0, -1));
    if (draftLines.length === 1) setRestoredMarkingNotice(null);
    setClearLinesArmed(false);
    setPendingLinePoint(null);
    setLineCaptureProblem(null);
    setLineCaptureNotice("Paskutinė kraigo arba slėnio linija pašalinta.");
    onLastLineUndo?.(lastLine);
  }, [draftLines, onLastLineUndo]);

  const clearDraftLines = useCallback(() => {
    if (draftLines.length === 0) return;
    const clearedLines = draftLines;
    setDraftLines([]);
    setRestoredMarkingNotice(null);
    setClearLinesArmed(false);
    setPendingLinePoint(null);
    setLineMode(null);
    setLineCaptureProblem(null);
    setLineCaptureNotice(
      "Linijos pašalintos tik iš neišsaugoto juodraščio. Patvirtintą reviziją galima atkurti paspaudus „Perkrauti“.",
    );
    onLinesClear?.(clearedLines);
  }, [draftLines, onLinesClear]);

  const startLineEndpointDrag = useCallback(
    (
      event: PointerEvent<SVGEllipseElement>,
      lineId: string,
      endpoint: "start" | "end",
    ) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const drag = {
        endpoint,
        lineId,
        moved: false,
        pointerId: event.pointerId,
      } as const;
      draggingLineEndpointRef.current = drag;
      setDraggingLineEndpoint(drag);
      setLineMode(null);
      setPendingLinePoint(null);
      setLineCaptureProblem(null);
      setLineCaptureNotice(null);
    },
    [],
  );

  const moveLineEndpoint = useCallback(
    (event: PointerEvent<SVGEllipseElement>) => {
      const drag = draggingLineEndpointRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const bounds = getCanvasBounds();
      if (!bounds) return;
      event.preventDefault();
      event.stopPropagation();
      const currentLines = draftLinesRef.current;
      const currentLine = currentLines.find((line) => line.id === drag.lineId);
      if (!currentLine) return;
      const metric = roofFusionEndpointConstraintMetric(bounds, viewport);
      const pointerPoint = pointFromPointer(event, bounds, viewport);
      const constrained = constrainRoofFusionDraggedEndpoint(
        pointerPoint,
        draftOutline,
        roofFusionLineJunctionTargets(currentLines, drag.lineId, pointerPoint),
        metric,
      );
      const otherEndpoint =
        drag.endpoint === "start" ? currentLine.end : currentLine.start;
      try {
        assertWorkbenchSkeletonLineLengthV1(otherEndpoint, constrained);
      } catch {
        return;
      }
      const currentEndpoint = currentLine[drag.endpoint];
      if (
        currentEndpoint.x === constrained.x &&
        currentEndpoint.y === constrained.y
      ) {
        return;
      }
      const nextLines = currentLines.map((line) =>
        line.id === drag.lineId
          ? { ...line, [drag.endpoint]: constrained }
          : line,
      );
      const movedDrag = { ...drag, moved: true };
      draggingLineEndpointRef.current = movedDrag;
      setDraggingLineEndpoint(movedDrag);
      draftLinesRef.current = nextLines;
      setDraftLines(nextLines);
    },
    [draftOutline, getCanvasBounds, viewport],
  );

  const finishLineEndpointDrag = useCallback(
    (event: PointerEvent<SVGEllipseElement>) => {
      const drag = draggingLineEndpointRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const changedLine = draftLinesRef.current.find(
        (line) => line.id === drag.lineId,
      );
      draggingLineEndpointRef.current = null;
      setDraggingLineEndpoint(null);
      if (drag.moved) {
        setRestoredMarkingNotice(null);
        setLineCaptureNotice("Linijos galinis taškas patikslintas.");
        if (changedLine) onLineChange?.(changedLine);
      }
    },
    [onLineChange],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (panGesture?.pointerId === event.pointerId) {
        const moved =
          panGestureMovedRef.current ||
          hasRoofFusionPanGestureMoved(
            {
              clientX: panGesture.startClientX,
              clientY: panGesture.startClientY,
            },
            event,
          );
        if (!moved) return;
        panGestureMovedRef.current = true;
        const bounds = getCanvasBounds();
        if (!bounds) return;
        event.preventDefault();
        if (!panGesture.moved) {
          setPanGesture({ ...panGesture, moved: true });
        }
        setViewport(
          panRoofFusionViewport(panGesture.startViewport, {
            x: (event.clientX - panGesture.startClientX) / (bounds.width || 1),
            y: (event.clientY - panGesture.startClientY) / (bounds.height || 1),
          }),
        );
        return;
      }
      if (draggingVertex === null || stage !== "outline") return;
      const bounds = getCanvasBounds();
      if (!bounds) return;
      moveVertex(draggingVertex, pointFromPointer(event, bounds, viewport));
    },
    [draggingVertex, getCanvasBounds, moveVertex, panGesture, stage, viewport],
  );

  const handleCanvasPointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.isPrimary && event.button === 0) {
        // A genuine new pointer gesture makes any unsynthesized click from the
        // previous gesture stale. Its own pointerup will arm suppression again.
        suppressCanvasClickRef.current = false;
      }
      if (
        viewport.scale <= MIN_ROOF_FUSION_ZOOM ||
        !event.isPrimary ||
        event.button !== 0
      )
        return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDraggingVertex(null);
      panGestureMovedRef.current = false;
      setPanGesture({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewport: viewport,
        moved: false,
      });
    },
    [viewport],
  );

  const finishPointerGesture = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const ownsGesture = panGesture?.pointerId === event.pointerId;
      if (
        ownsGesture &&
        event.currentTarget.hasPointerCapture?.(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      const moved = panGestureMovedRef.current || Boolean(panGesture?.moved);
      if (event.type === "pointerup" && ownsGesture) {
        if (!moved) {
          const bounds = getCanvasBounds();
          if (bounds) {
            activateCanvasPoint(
              pointFromPointer(event, bounds, viewport),
              roofFusionEndpointConstraintMetric(bounds, viewport),
            );
          }
        }
        // Zoomed pointer activation is completed on pointerup because a
        // preventDefault/pointer-capture sequence may not synthesize click.
        suppressCanvasClickRef.current = true;
      }
      panGestureMovedRef.current = false;
      setPanGesture(null);
      setDraggingVertex(null);
    },
    [activateCanvasPoint, getCanvasBounds, panGesture, viewport],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!shouldHandleRoofFusionZoomWheel(event)) return;
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const anchor = clampRoofFusionPoint({
        x: (event.clientX - bounds.left) / (bounds.width || 1),
        y: (event.clientY - bounds.top) / (bounds.height || 1),
      });
      const boundedDelta = Math.max(-100, Math.min(100, event.deltaY));
      const factor = Math.exp(-boundedDelta * 0.0025);
      const next = zoomRoofFusionViewportAt(
        viewport,
        viewport.scale * factor,
        anchor,
      );
      setViewport(next);
      if (next.scale === MIN_ROOF_FUSION_ZOOM) {
        setPanGesture(null);
      }
    },
    [viewport],
  );

  const changeZoom = useCallback(
    (delta: number) => {
      const next = zoomRoofFusionViewportAt(viewport, viewport.scale + delta);
      setViewport(next);
      if (next.scale === MIN_ROOF_FUSION_ZOOM) {
        setPanGesture(null);
      }
    },
    [viewport],
  );

  const resetViewport = useCallback(() => {
    setViewport(DEFAULT_ROOF_FUSION_VIEWPORT);
    setPanGesture(null);
  }, []);

  const handleVertexKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>, index: number) => {
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
      if (nextStage === "review") {
        setLayerVisibility((current) => ({ ...current, roofPlanes: true }));
      }
      setLineMode(null);
      setPendingLinePoint(null);
      setLineCaptureProblem(null);
      setLineCaptureNotice(null);
      setAddingVertex(false);
      onStageChange?.(nextStage);
    },
    [onStageChange],
  );

  const primaryActionLabel = stage === "review" ? null : "Apskaičiuoti";

  const activeBlockers = useMemo(
    () => [...blockers, ...(stageBlockers?.[stage] ?? [])],
    [blockers, stage, stageBlockers],
  );

  const handlePrimaryAction = useCallback(async () => {
    if (primaryActionPending) return;
    if (activeBlockers.length) {
      setAdvancedOpen(true);
      return;
    }
    setPrimaryActionPending(true);
    try {
      const shouldAdvance = await onPrimaryAction?.(stage);
      if (shouldAdvance === false) {
        setAdvancedOpen(true);
        return;
      }
      goToStage("review");
    } finally {
      setPrimaryActionPending(false);
    }
  }, [
    activeBlockers.length,
    goToStage,
    onPrimaryAction,
    primaryActionPending,
    stage,
  ]);

  const activeOneCardStep: RoofFusionOneCardStep =
    stage === "review" ? "result" : "refine";
  const activeOneCardStepIndex =
    ROOF_FUSION_ONE_CARD_STEPS.indexOf(activeOneCardStep);
  const navigateToOneCardStep = useCallback(
    (step: RoofFusionOneCardStep) => {
      if (step === "object") {
        onChangeBuilding?.();
        return;
      }
      if (step === "refine" && stage === "review") {
        goToStage(draftLines.length > 0 ? "skeleton" : "outline");
        onEditResult?.();
      }
    },
    [draftLines.length, goToStage, onChangeBuilding, onEditResult, stage],
  );
  const activeSelectedRoofPlaneId = roofPlanes.some(
    (plane) => plane.id === selectedRoofPlaneId,
  )
    ? selectedRoofPlaneId
    : (roofPlanes[0]?.id ?? null);

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
  const canvasAspectRatio =
    orthoImageWidth && orthoImageHeight
      ? orthoImageWidth / orthoImageHeight
      : 4 / 3;
  const heightPointRadii = roofFusionScreenStableMarkerRadii(
    0.0035,
    canvasAspectRatio,
    viewport.scale,
  );
  const vertexHitRadii = roofFusionScreenStableMarkerRadii(
    0.022,
    canvasAspectRatio,
    viewport.scale,
  );
  const vertexRadii = roofFusionScreenStableMarkerRadii(
    0.006,
    canvasAspectRatio,
    viewport.scale,
  );
  const selectedVertexRadii = roofFusionScreenStableMarkerRadii(
    0.008,
    canvasAspectRatio,
    viewport.scale,
  );
  const lineEndpointRadii = roofFusionScreenStableMarkerRadii(
    ROOF_FUSION_SKELETON_ENDPOINT_RADIUS,
    canvasAspectRatio,
    viewport.scale,
  );
  const lineEndpointCenterRadii = roofFusionScreenStableMarkerRadii(
    ROOF_FUSION_SKELETON_ENDPOINT_CENTER_RADIUS,
    canvasAspectRatio,
    viewport.scale,
  );
  const lineHitRadii = roofFusionScreenStableMarkerRadii(
    ROOF_FUSION_SKELETON_HIT_RADIUS,
    canvasAspectRatio,
    viewport.scale,
  );
  const pendingLinePointRadii = roofFusionScreenStableMarkerRadii(
    0.0035,
    canvasAspectRatio,
    viewport.scale,
  );

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

          {sourceStatusPanel}

          {restoredMarkingNotice ? (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#71e6b4]/30 bg-[#46d69a]/10 px-3 py-2 text-sm text-[#dff9ed]"
              data-roof-fusion-restored-marking
            >
              <span aria-live="polite" role="status">
                <strong>Atkurtas ankstesnis žymėjimas</strong>
                <span className="ml-2 text-xs text-[#b8dccc]">
                  {restoredMarkingNotice.replace(
                    "Atkurtas ankstesnis žymėjimas · ",
                    "",
                  )}
                </span>
              </span>
              <button
                className="min-h-10 rounded-xl border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10"
                data-roof-fusion-redraw-lines
                onClick={() => {
                  if (stage === "review") onEditResult?.();
                  goToStage("skeleton");
                  setClearLinesArmed(true);
                }}
                type="button"
              >
                Išvalyti / perbraižyti
              </button>
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <nav
              aria-label="Matavimo eiga"
              className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-[#171e2a] p-1"
              data-roof-fusion-one-card-progress
            >
              {ROOF_FUSION_ONE_CARD_STEPS.map((item, index) => {
                const active = item === activeOneCardStep;
                const previous = index < activeOneCardStepIndex;
                const reachable =
                  previous &&
                  (item === "object"
                    ? Boolean(onChangeBuilding)
                    : item === "refine" && stage === "review");
                return (
                  <button
                    aria-current={active ? "step" : undefined}
                    aria-label={
                      reachable
                        ? `Grįžti į žingsnį ${oneCardStepLabels[item]}`
                        : oneCardStepLabels[item]
                    }
                    className={`min-h-11 rounded-xl px-2 py-2 text-left text-xs sm:px-3 ${active ? "bg-[#e8a317] font-semibold text-[#101318]" : reachable ? "cursor-pointer text-[#71e6b4] underline decoration-[#71e6b4]/45 underline-offset-4 hover:bg-white/5" : "cursor-not-allowed text-[#777f8c]"}`}
                    data-roof-fusion-change-building={
                      item === "object" && reachable ? true : undefined
                    }
                    data-roof-fusion-one-card-step={item}
                    data-roof-fusion-one-card-step-state={
                      active ? "active" : reachable ? "reachable" : "future"
                    }
                    disabled={!reachable}
                    key={item}
                    onClick={() => navigateToOneCardStep(item)}
                    type="button"
                  >
                    <span className="mr-1.5 opacity-60">0{index + 1}</span>
                    {oneCardStepLabels[item]}
                  </button>
                );
              })}
            </nav>
            <button
              aria-expanded={advancedOpen}
              className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-[#ddd8cd] hover:bg-white/10"
              data-roof-fusion-advanced-trigger
              onClick={() => setAdvancedOpen(true)}
              ref={advancedTriggerRef}
              type="button"
            >
              Advanced
            </button>
          </div>

          <div
            aria-label="Vaizdo mastelio ir pozicijos valdikliai"
            className="mb-2 flex flex-wrap items-center gap-2"
            data-roof-fusion-viewport-controls
            role="group"
          >
            <button
              aria-label="Mažinti vaizdą"
              className="min-h-11 min-w-11 rounded-xl border border-white/15 bg-white/5 px-3 text-lg font-semibold text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={viewport.scale <= MIN_ROOF_FUSION_ZOOM}
              onClick={() => changeZoom(-0.5)}
              type="button"
            >
              −
            </button>
            <output
              aria-label="Dabartinis vaizdo mastelis"
              aria-live="polite"
              className="min-w-16 rounded-xl border border-white/10 bg-[#171e2a] px-3 py-2 text-center text-sm font-semibold text-[#f3c66b]"
              data-roof-fusion-zoom-percent
            >
              {Math.round(viewport.scale * 100)}%
            </output>
            <button
              aria-label="Didinti vaizdą"
              className="min-h-11 min-w-11 rounded-xl border border-white/15 bg-white/5 px-3 text-lg font-semibold text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={viewport.scale >= MAX_ROOF_FUSION_ZOOM}
              onClick={() => changeZoom(0.5)}
              type="button"
            >
              +
            </button>
            <button
              className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={
                viewport.scale === MIN_ROOF_FUSION_ZOOM &&
                viewport.offsetX === 0 &&
                viewport.offsetY === 0
              }
              onClick={resetViewport}
              type="button"
            >
              Talpinti
            </button>
            <span className="text-xs text-[#aaa69d]">
              Ctrl/Cmd + ratukas keičia mastelį. Priartinus tempkite tuščią
              drobės vietą vaizdui perstumti.
            </span>
          </div>

          <div
            className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#202938]"
            data-roof-fusion-canvas-shell
            onWheel={handleWheel}
            ref={canvasShellRef}
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
              style={{
                transform: `translate(${viewport.offsetX * 100}%, ${viewport.offsetY * 100}%) scale(${viewport.scale})`,
                transformOrigin: "top left",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08101a]/55 via-transparent to-[#08101a]/10"
              style={{
                transform: `translate(${viewport.offsetX * 100}%, ${viewport.offsetY * 100}%) scale(${viewport.scale})`,
                transformOrigin: "top left",
              }}
            />
            <svg
              aria-label="Stogo žymėjimo sluoksniai"
              className={`absolute inset-0 h-full w-full ${viewport.scale > MIN_ROOF_FUSION_ZOOM ? `touch-none ${panGesture?.moved ? "cursor-grabbing" : "cursor-grab"}` : "touch-pan-y"}`}
              data-roof-fusion-direct-pan={
                viewport.scale > MIN_ROOF_FUSION_ZOOM ? "enabled" : "disabled"
              }
              data-roof-fusion-canvas
              data-roof-fusion-viewport
              data-roof-fusion-viewport-scale={viewport.scale}
              onClick={handleCanvasClick}
              onPointerCancel={finishPointerGesture}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointerGesture}
              onPointerLeave={() => {
                if (!panGesture) setDraggingVertex(null);
              }}
              role="img"
              preserveAspectRatio="none"
              style={{
                transform: `translate(${viewport.offsetX * 100}%, ${viewport.offsetY * 100}%) scale(${viewport.scale})`,
                transformOrigin: "top left",
              }}
              viewBox="0 0 1 1"
              xmlns="http://www.w3.org/2000/svg"
            >
              {layerVisibility.hoydedata && (
                <g data-roof-fusion-layer="hoydedata">
                  {heightPoints.map((item, index) => (
                    <ellipse
                      cx={item.point.x}
                      cy={item.point.y}
                      data-roof-fusion-height-point={index}
                      fill="#62d7a7"
                      key={index}
                      opacity=".72"
                      rx={heightPointRadii.rx}
                      ry={heightPointRadii.ry}
                    />
                  ))}
                </g>
              )}
              {layerVisibility.roofPlanes && (
                <g data-roof-fusion-layer="roofPlanes">
                  {roofPlanes.map((plane, index) => (
                    <polygon
                      aria-label={plane.label ?? `Stogo plokštuma ${index + 1}`}
                      className={
                        stage === "review" ? "cursor-pointer" : undefined
                      }
                      data-roof-fusion-roof-plane={plane.id}
                      fill={index % 2 ? "#ef9b4f" : "#55c7a3"}
                      fillOpacity={
                        activeSelectedRoofPlaneId === plane.id ? ".42" : ".2"
                      }
                      key={plane.id}
                      onClick={(event) => {
                        if (stage !== "review") return;
                        event.stopPropagation();
                        setSelectedRoofPlaneId(plane.id);
                      }}
                      onKeyDown={(event) => {
                        if (
                          stage === "review" &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          setSelectedRoofPlaneId(plane.id);
                        }
                      }}
                      points={pointsAttribute(plane.points)}
                      role={stage === "review" ? "button" : undefined}
                      stroke={index % 2 ? "#ef9b4f" : "#55c7a3"}
                      strokeWidth={
                        activeSelectedRoofPlaneId === plane.id ? "3px" : "2px"
                      }
                      tabIndex={stage === "review" ? 0 : undefined}
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
                  fillOpacity={approvedOutlineFillOpacity / 100}
                  points={pointsAttribute(draftOutline)}
                  stroke="#46d69a"
                  strokeWidth=".007"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {layerVisibility.skeleton && (
                <g data-roof-fusion-layer="skeleton">
                  {draftLines.map((line) => (
                    <line
                      aria-hidden="true"
                      data-roof-fusion-line-hit-target={line.id}
                      key={`${line.id}:hit-target`}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      pointerEvents="stroke"
                      stroke="transparent"
                      strokeLinecap="round"
                      strokeWidth={ROOF_FUSION_SKELETON_HIT_STROKE}
                      vectorEffect="non-scaling-stroke"
                      x1={line.start.x}
                      x2={line.end.x}
                      y1={line.start.y}
                      y2={line.end.y}
                    />
                  ))}
                  {displayLines.map((line) => (
                    <line
                      data-roof-fusion-line-kind={line.kind}
                      key={line.id}
                      stroke={line.kind === "ridge" ? "#f8d164" : "#8cb8ff"}
                      strokeDasharray={
                        line.id === "pending-line" ? ".012 .009" : undefined
                      }
                      strokeLinecap="round"
                      strokeWidth={
                        line.id === "pending-line"
                          ? ROOF_FUSION_PENDING_LINE_STROKE
                          : ROOF_FUSION_SKELETON_LINE_STROKE
                      }
                      vectorEffect="non-scaling-stroke"
                      x1={line.start.x}
                      x2={line.end.x}
                      y1={line.start.y}
                      y2={line.end.y}
                    />
                  ))}
                  {draftLines.map((line) => (
                    <g key={`${line.id}:endpoints`}>
                      {([line.start, line.end] as const).map((point, index) => (
                        <g
                          data-roof-fusion-line-endpoint={`${line.id}:${index}`}
                          key={`${line.id}:endpoint:${index}`}
                        >
                          <ellipse
                            aria-hidden="true"
                            className={
                              draggingLineEndpoint?.lineId === line.id &&
                              draggingLineEndpoint.endpoint ===
                                (index === 0 ? "start" : "end")
                                ? "cursor-grabbing touch-none"
                                : "cursor-grab touch-none"
                            }
                            cx={point.x}
                            cy={point.y}
                            data-roof-fusion-line-endpoint-hit-target={`${line.id}:${index}`}
                            data-roof-fusion-line-endpoint-dragging={
                              draggingLineEndpoint?.lineId === line.id &&
                              draggingLineEndpoint.endpoint ===
                                (index === 0 ? "start" : "end")
                                ? "true"
                                : "false"
                            }
                            fill="transparent"
                            onClick={(event) => event.stopPropagation()}
                            onPointerCancel={finishLineEndpointDrag}
                            onPointerDown={(event) =>
                              startLineEndpointDrag(
                                event,
                                line.id,
                                index === 0 ? "start" : "end",
                              )
                            }
                            onPointerMove={moveLineEndpoint}
                            onPointerUp={finishLineEndpointDrag}
                            pointerEvents="all"
                            rx={lineHitRadii.rx}
                            ry={lineHitRadii.ry}
                          />
                          <ellipse
                            aria-hidden="true"
                            cx={point.x}
                            cy={point.y}
                            data-roof-fusion-line-endpoint-outline={`${line.id}:${index}`}
                            fill="#fffdf7"
                            pointerEvents="none"
                            rx={lineEndpointRadii.rx}
                            ry={lineEndpointRadii.ry}
                          />
                          <ellipse
                            aria-hidden="true"
                            cx={point.x}
                            cy={point.y}
                            data-roof-fusion-line-endpoint-center={`${line.id}:${index}`}
                            fill={line.kind === "ridge" ? "#e8a317" : "#629dff"}
                            pointerEvents="none"
                            rx={lineEndpointCenterRadii.rx}
                            ry={lineEndpointCenterRadii.ry}
                          />
                        </g>
                      ))}
                    </g>
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
                  <g
                    aria-label={`Kontūro taškas ${index + 1}. Rodyklėmis perkelti.`}
                    className="cursor-move touch-none outline-none"
                    data-roof-fusion-vertex={index}
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
                    role="button"
                    tabIndex={0}
                  >
                    <ellipse
                      cx={point.x}
                      cy={point.y}
                      data-roof-fusion-vertex-hit-target={index}
                      fill="transparent"
                      rx={vertexHitRadii.rx}
                      ry={vertexHitRadii.ry}
                    />
                    <ellipse
                      cx={point.x}
                      cy={point.y}
                      data-roof-fusion-vertex-marker={index}
                      fill={selectedVertex === index ? "#fff" : "#46d69a"}
                      pointerEvents="none"
                      rx={
                        selectedVertex === index
                          ? selectedVertexRadii.rx
                          : vertexRadii.rx
                      }
                      ry={
                        selectedVertex === index
                          ? selectedVertexRadii.ry
                          : vertexRadii.ry
                      }
                      stroke="#0b111a"
                      strokeWidth=".003"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
              {pendingLinePoint && (
                <ellipse
                  cx={pendingLinePoint.x}
                  cy={pendingLinePoint.y}
                  data-roof-fusion-pending-line-point
                  fill="#fff"
                  pointerEvents="none"
                  rx={pendingLinePointRadii.rx}
                  ry={pendingLinePointRadii.ry}
                  stroke="#e8a317"
                  strokeWidth=".003"
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

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label
              className="flex min-w-[220px] flex-1 items-center gap-3 text-xs font-medium text-[#ddd8cd]"
              data-roof-fusion-approved-outline-opacity-control
            >
              <span className="shrink-0">Kontūro ryškumas</span>
              <input
                aria-label="Patvirtinto ploto spalvos ryškumas"
                className="w-full accent-[#46d69a] disabled:opacity-40"
                disabled={!layerVisibility.approvedOutline}
                max="100"
                min="0"
                onChange={(event) =>
                  setApprovedOutlineFillOpacity(Number(event.target.value))
                }
                type="range"
                value={approvedOutlineFillOpacity}
              />
              <output aria-live="polite" className="w-9 text-right">
                {approvedOutlineFillOpacity}%
              </output>
            </label>
            {stage !== "review" ? (
              <div
                aria-label="Žymėjimo įrankiai"
                className="flex rounded-xl border border-white/10 bg-[#171e2a] p-1"
                data-roof-fusion-edit-mode
                role="group"
              >
                <button
                  aria-pressed={stage === "outline"}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${stage === "outline" ? "bg-white/10 text-white" : "text-[#aaa69d]"}`}
                  data-roof-fusion-edit-mode-option="outline"
                  data-roof-fusion-stage-tab="outline"
                  onClick={() => goToStage("outline")}
                  type="button"
                >
                  Kontūras
                </button>
                <button
                  aria-pressed={stage === "skeleton"}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${stage === "skeleton" ? "bg-[#e8a317]/15 text-[#f3c66b]" : "text-[#aaa69d]"}`}
                  data-roof-fusion-edit-mode-option="skeleton"
                  data-roof-fusion-stage-tab="skeleton"
                  onClick={() => goToStage("skeleton")}
                  type="button"
                >
                  Sudėtingas stogas
                </button>
              </div>
            ) : null}
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
                    setLineCaptureProblem(null);
                    setLineCaptureNotice(null);
                  }}
                  type="button"
                >
                  {kind === "ridge"
                    ? draftLines.some((line) => line.kind === "ridge")
                      ? "＋ Dar vienas kraigas"
                      : "＋ Kraigas"
                    : draftLines.some((line) => line.kind === "valley")
                      ? "⌄ Dar vienas slėnis"
                      : "⌄ Slėnis"}
                </button>
              ))}
              <button
                className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                data-roof-fusion-undo-last-line
                disabled={draftLines.length === 0}
                onClick={undoLastLine}
                type="button"
              >
                Atšaukti paskutinę liniją
              </button>
              <button
                className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                data-roof-fusion-clear-lines
                disabled={draftLines.length === 0}
                onClick={() => setClearLinesArmed(true)}
                type="button"
              >
                Perbraižyti visas linijas
              </button>
              <span className="text-xs text-[#aaa69d]">
                {lineMode
                  ? pendingLinePoint
                    ? "Pasirinkite antrą tašką"
                    : "Pasirinkite pirmą tašką"
                  : ""}
              </span>
              {clearLinesArmed ? (
                <div
                  className="basis-full rounded-xl border border-[#f3c66b]/35 bg-[#e8a317]/10 p-3 text-xs text-[#ddd8cd]"
                  data-roof-fusion-clear-lines-confirmation
                  role="alert"
                >
                  <p>
                    Bus išvalytos tik šio neišsaugoto juodraščio linijos.
                    Patvirtinta revizija liks saugi ir ją galėsite atkurti per
                    „Perkrauti“.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="min-h-10 rounded-lg bg-[#e8a317] px-3 font-semibold text-[#101318]"
                      data-roof-fusion-confirm-clear-lines
                      onClick={clearDraftLines}
                      type="button"
                    >
                      Patvirtinti linijų išvalymą
                    </button>
                    <button
                      className="min-h-10 rounded-lg border border-white/15 px-3 text-[#ddd8cd]"
                      onClick={() => setClearLinesArmed(false)}
                      type="button"
                    >
                      Atšaukti
                    </button>
                  </div>
                </div>
              ) : null}
              {lineCaptureProblem ? (
                <span
                  className="basis-full text-xs text-[#ffadad]"
                  data-roof-fusion-line-problem
                  role="alert"
                >
                  {lineCaptureProblem}
                </span>
              ) : null}
              {lineCaptureNotice ? (
                <span
                  className="basis-full text-xs text-[#71e6b4]"
                  data-roof-fusion-line-notice
                  role="status"
                >
                  {lineCaptureNotice}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 border-t border-white/10 bg-[#151c28] p-4 sm:p-5 xl:w-[360px] xl:border-t-0 xl:border-l">
          <div className="space-y-4">
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

            {stage === "review" && roofPlanes.length ? (
              <div
                className="rounded-2xl border border-white/10 bg-[#0f151f] p-3"
                data-roof-fusion-surface-results
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">Stogo šlaitai</strong>
                  <span className="text-xs text-[#aaa69d]">
                    {roofPlanes.length}
                  </span>
                </div>
                <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">
                  {roofPlanes.map((plane, index) => (
                    <button
                      aria-pressed={activeSelectedRoofPlaneId === plane.id}
                      className={`grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left ${activeSelectedRoofPlaneId === plane.id ? "border-[#e8a317]/60 bg-[#e8a317]/10" : "border-white/10 bg-[#151c28] hover:border-white/20"}`}
                      data-roof-fusion-surface-result={plane.id}
                      key={plane.id}
                      onClick={() => setSelectedRoofPlaneId(plane.id)}
                      type="button"
                    >
                      <span>
                        <strong className="block text-xs">
                          {plane.label ?? `Šlaitas ${index + 1}`}
                        </strong>
                        <span className="mt-0.5 block text-[10px] text-[#aaa69d]">
                          Nuolydis {formatNumber(plane.slopeDegrees, "°")}
                          {plane.confidence
                            ? ` · ${confidenceLabels[plane.confidence]}`
                            : ""}
                        </span>
                        {plane.netAreaSquareMeters !== undefined &&
                        plane.netAreaSquareMeters !== plane.areaSquareMeters ? (
                          <span className="mt-0.5 block text-[10px] text-[#aaa69d]">
                            Grynasis plotas{" "}
                            {formatNumber(plane.netAreaSquareMeters, " m²")}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-right">
                        <strong className="block text-sm text-[#f3c66b]">
                          {formatNumber(plane.areaSquareMeters, " m²")}
                        </strong>
                        <span className="block text-[9px] text-[#aaa69d]">
                          paviršius
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#e8a317]/25 bg-[#e8a317]/10 p-3 text-xs leading-relaxed text-[#ddd8cd]">
              <strong className="text-[#f3c66b]">
                Šaltinio kontūras nekintamas.
              </strong>{" "}
              Jis lieka matomas brūkšniuota linija, o pataisymai kuriami kaip
              atskiras patvirtintas kontūras.
            </div>

            {stage === "review" ? (
              <div className="grid gap-2">
                <div
                  className="rounded-2xl border border-[#46d69a]/30 bg-[#46d69a]/10 p-4 text-sm text-[#ddd8cd]"
                  data-roof-fusion-preview-complete
                  role="status"
                >
                  <strong className="block text-[#71e6b4]">
                    Matavimo rezultatas parengtas peržiūrai
                  </strong>
                  <span className="mt-1 block text-xs leading-relaxed">
                    Rezultatas neišsiųstas klientui ir dar nenaudojamas
                    kainodarai.
                  </span>
                  {resultIdentity ? (
                    <span
                      className="mt-2 block truncate font-mono text-[10px] text-[#aaa69d]"
                      data-roof-fusion-result-identity={
                        resultIdentity.snapshotId
                      }
                      title={`${resultIdentity.snapshotId} · ${resultIdentity.snapshotHash}`}
                    >
                      {resultIdentity.measurementMethod} · r
                      {resultIdentity.revision} · {resultIdentity.snapshotId}
                    </span>
                  ) : null}
                </div>
                <button
                  className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-[#ddd8cd] hover:bg-white/10"
                  data-roof-fusion-edit-result
                  onClick={() => {
                    goToStage("outline");
                    onEditResult?.();
                  }}
                  type="button"
                >
                  Keisti žymėjimą
                </button>
              </div>
            ) : (
              <button
                className="min-h-12 w-full rounded-xl bg-[#e8a317] px-4 py-3 text-sm font-bold text-[#101318] shadow-lg shadow-[#e8a317]/10 transition hover:bg-[#f0b12e] disabled:cursor-not-allowed disabled:opacity-45"
                data-roof-fusion-primary-action="calculate"
                disabled={primaryActionPending}
                onClick={() => void handlePrimaryAction()}
                type="button"
              >
                {primaryActionPending ? "Skaičiuojama…" : primaryActionLabel}
              </button>
            )}
            {stage !== "review" && activeBlockers.length > 0 ? (
              <p className="text-center text-xs text-[#ffadad]">
                Paspaudus „Apskaičiuoti“ bus parodyti reikalingi sprendimai.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {advancedOpen ? (
        <div
          aria-label="Advanced nustatymai"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex justify-end bg-black/65"
          data-roof-fusion-advanced
          role="dialog"
        >
          <button
            aria-label="Uždaryti Advanced nustatymus"
            className="absolute inset-0 cursor-default"
            data-roof-fusion-advanced-backdrop
            onClick={() => setAdvancedOpen(false)}
            type="button"
          />
          <aside
            className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#111722] p-5 shadow-2xl"
            ref={advancedDialogRef}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Advanced</h3>
                <p className="mt-1 text-xs leading-5 text-[#aaa69d]">
                  Papildomi šaltiniai, sluoksniai ir atsarginiai veiksmai.
                  Normaliam matavimo keliui jų atverti nereikia.
                </p>
              </div>
              <button
                aria-label="Uždaryti Advanced nustatymus"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 text-xl text-[#ddd8cd] hover:bg-white/10"
                data-roof-fusion-advanced-close
                onClick={() => setAdvancedOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            {activeBlockers.length ? (
              <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-3">
                <strong className="text-sm text-red-100">
                  Rekomenduojami kiti veiksmai
                </strong>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-100">
                  {activeBlockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-2">
              <strong className="text-xs tracking-[.12em] text-[#aaa69d] uppercase">
                Techniniai sluoksniai
              </strong>
              {(Object.keys(layerLabels) as RoofFusionLayer[]).map((layer) => (
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
                    {layerVisibility[layer] ? "Rodomas" : "Paslėptas"}
                  </span>
                </button>
              ))}
            </div>

            {advancedPanel ? (
              <div
                className="mt-5 border-t border-white/10 pt-5"
                data-roof-fusion-advanced-source-actions
              >
                {advancedPanel}
              </div>
            ) : null}

            {persistencePanel ? (
              <div className="mt-5">{persistencePanel}</div>
            ) : null}

            <div
              className="mt-5 rounded-xl border border-dashed border-white/15 p-3 text-xs text-[#aaa69d]"
              data-roof-fusion-legacy-fallback-slot
            >
              {legacyFallbackPanel ?? (
                <>
                  <strong className="block text-[#ddd8cd]">
                    Senas rankinis skaičiavimas (fallback)
                  </strong>
                  <span className="mt-1 block">
                    Naudokite tik tada, kai patikimesnis RF skaičiavimas
                    negalimas.
                  </span>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
