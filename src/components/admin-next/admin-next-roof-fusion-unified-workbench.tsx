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
export const ROOF_FUSION_SKELETON_LINE_STROKE = "2px";
export const ROOF_FUSION_PENDING_LINE_STROKE = "2px";
export const ROOF_FUSION_SKELETON_ENDPOINT_RADIUS = 0.003;
export const ROOF_FUSION_SKELETON_ENDPOINT_CENTER_RADIUS = 0.0015;
export const ROOF_FUSION_SKELETON_HIT_RADIUS = 0.022;
export const ROOF_FUSION_SKELETON_HIT_STROKE = "22px";
export const ROOF_FUSION_GEOMETRY_TOKENS = {
  approved: "#35c7b2",
  source: "#91a0b3",
  ridge: "#f4b63f",
  valley: "#55bfe8",
  contrastHalo: "rgba(255,255,255,.68)",
} as const;
export const DEFAULT_ROOF_FUSION_VIEWPORT: RoofFusionViewport = {
  scale: MIN_ROOF_FUSION_ZOOM,
  offsetX: 0,
  offsetY: 0,
};

export type RoofFusionStage = "outline" | "skeleton" | "slopes" | "review";
export type RoofFusionOneCardStep = "object" | "refine" | "result";
export type RoofFusionResultState = "idle" | "updating" | "current" | "stale";
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
  displayId?: string;
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
  draftHash?: string;
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
  originalLine: RoofFusionLine;
  originalLines: readonly RoofFusionLine[];
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
  /** Address-selection OSM area, shown only as provenance context. */
  preliminaryHorizontalAreaSquareMeters?: number;
  averageSlopeDegrees?: number;
  footprintPerimeterMeters?: number;
  confidence?: RoofFusionConfidence;
  confidenceReason?: string;
  resultIdentity?: RoofFusionResultIdentity;
  resultState?: RoofFusionResultState;
  reviewStatus?: "ready" | "review_required" | "blocked";
  blockers?: readonly string[];
  /** Last calculation diagnostics; visible without preventing an explicit retry. */
  calculationProblems?: readonly string[];
  stageBlockers?: Partial<Record<RoofFusionStage, readonly string[]>>;
  guardNotice?: string;
  /** Changes only when the parent explicitly rehydrates persisted geometry. */
  geometryHydrationSignal?: string | number;
  /** Changes only when that hydration restores an earlier measurement session. */
  restoredGeometrySignal?: string | number;
  /** The persistent wrapper can replace this legacy notice with its decision gate. */
  showRestoredMarkingNotice?: boolean;
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
  /** Commit every line affected by one shared-node edit together. */
  onLinesChange?: (lines: readonly RoofFusionLine[]) => void;
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

export function fitRoofFusionViewportToOutline(
  points: readonly RoofFusionPoint[],
  bounds: Pick<DOMRect, "width" | "height">,
  paddingPixels?: number,
): RoofFusionViewport {
  if (
    points.length < 3 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    !points.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    )
  ) {
    return DEFAULT_ROOF_FUSION_VIEWPORT;
  }
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const safePadding = Math.max(
    24,
    paddingPixels ?? (bounds.width < 640 ? 112 : 72),
  );
  const horizontalPadding = Math.min(0.22, safePadding / bounds.width);
  const verticalPadding = Math.min(0.32, safePadding / bounds.height);
  const scale = Math.min(
    MAX_ROOF_FUSION_ZOOM,
    Math.max(
      MIN_ROOF_FUSION_ZOOM,
      Math.min(
        (1 - horizontalPadding * 2) / width,
        (1 - verticalPadding * 2) / height,
      ),
    ),
  );
  return clampRoofFusionViewport({
    scale,
    offsetX: 0.5 - ((minX + maxX) / 2) * scale,
    offsetY: 0.5 - ((minY + maxY) / 2) * scale,
  });
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
  metric?: WorkbenchEndpointConstraintMetricV1,
) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const xWeight = (metric?.xPixelsPerImageUnit ?? 1) ** 2;
  const yWeight = (metric?.yPixelsPerImageUnit ?? 1) ** 2;
  const lengthSquared = deltaX * deltaX * xWeight + deltaY * deltaY * yWeight;
  if (lengthSquared === 0) return start;
  const position = Math.min(
    1,
    Math.max(
      0,
      ((point.x - start.x) * deltaX * xWeight +
        (point.y - start.y) * deltaY * yWeight) /
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
  metric?: WorkbenchEndpointConstraintMetricV1,
) {
  let closest = outline[0] ?? point;
  let closestDistance = Number.POSITIVE_INFINITY;
  outline.forEach((start, index) => {
    const end = outline[(index + 1) % outline.length];
    if (!end) return;
    const candidate = closestPointOnSegment(point, start, end, metric);
    const distance = metric
      ? distanceInConstraintPixels(candidate, point, metric)
      : Math.hypot(candidate.x - point.x, candidate.y - point.y);
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
  metric?: WorkbenchEndpointConstraintMetricV1,
) {
  const candidates = lines.filter((line) => line.id !== excludedLineId);
  const targets = candidates.flatMap((line) => [line.start, line.end]);
  if (nearPoint) {
    candidates.forEach((line) => {
      targets.push(
        closestPointOnSegment(nearPoint, line.start, line.end, metric),
      );
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
  const boundaryPoint = closestPointOnOutline(safePoint, outline, metric);
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

type RoofFusionSnap = Readonly<{
  point: RoofFusionPoint;
  target: "junction" | "outline" | "line" | null;
}>;

/** Resolve one screen-space magnet before changing any geometry. Existing nodes
 * win over a nearby projection so a second branch reuses the exact junction. */
export function snapRoofFusionSkeletonPoint(
  point: RoofFusionPoint,
  outline: readonly RoofFusionPoint[],
  lines: readonly RoofFusionLine[],
  metric: WorkbenchEndpointConstraintMetricV1,
): RoofFusionSnap {
  const nearest = (candidates: readonly RoofFusionSnap[]) =>
    candidates
      .filter((candidate) => pointIsInsideOutline(candidate.point, outline))
      .map((candidate) => ({
        candidate,
        distance: distanceInConstraintPixels(point, candidate.point, metric),
      }))
      .filter(({ distance }) => distance <= metric.maxDistancePixels)
      .sort((first, second) => first.distance - second.distance)[0]?.candidate;
  const node = nearest([
    ...roofFusionLineJunctionTargets(lines).map((target) => ({
      point: target,
      target: "junction" as const,
    })),
    ...outline.map((target) => ({ point: target, target: "outline" as const })),
  ]);
  if (node) return node;
  const edge = nearest([
    ...lines.map((line) => ({
      point: closestPointOnSegment(point, line.start, line.end, metric),
      target: "line" as const,
    })),
    { point: closestPointOnOutline(point, outline, metric), target: "outline" },
  ]);
  return edge ?? { point, target: null };
}

function sameRoofFusionPoint(first: RoofFusionPoint, second: RoofFusionPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y) <= 1e-9;
}

/** Local guidance only: an endpoint must actually lie on another edge, not
 * merely be within the much larger interactive magnet radius. */
export function roofFusionDanglingEndpoints(
  lines: readonly RoofFusionLine[],
  outline: readonly RoofFusionPoint[],
) {
  const kindCounts = { ridge: 0, valley: 0 };
  return lines.flatMap((line, lineIndex) => {
    const kindIndex = ++kindCounts[line.kind];
    return (["start", "end"] as const).flatMap((endpoint, endpointIndex) => {
      const point = line[endpoint];
      const liesOnSegment = (start: RoofFusionPoint, end: RoofFusionPoint) => {
        const projected = closestPointOnSegment(point, start, end);
        return Math.hypot(point.x - projected.x, point.y - projected.y) <= 1e-8;
      };
      const onBoundary = outline.some((start, index) =>
        liesOnSegment(start, outline[(index + 1) % outline.length]),
      );
      const onAnotherLine = lines.some(
        (other, index) =>
          index !== lineIndex && liesOnSegment(other.start, other.end),
      );
      if (onBoundary || onAnotherLine) return [];
      return [
        {
          lineId: line.id,
          endpoint,
          point,
          label: `${line.kind === "ridge" ? "Kraigas" : "Sąlaja"} ${kindIndex}, galas ${endpointIndex + 1}`,
        },
      ];
    });
  });
}

function roofFusionSegmentStaysInOutline(
  line: RoofFusionLine,
  outline: readonly RoofFusionPoint[],
) {
  if (
    !pointIsInsideOutline(line.start, outline) ||
    !pointIsInsideOutline(line.end, outline)
  )
    return false;
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-18) return false;
  const positions = [0, 1];
  outline.forEach((start, index) => {
    const intersection = lineIntersection(line, {
      id: "boundary",
      kind: "ridge",
      start,
      end: outline[(index + 1) % outline.length],
    });
    if (intersection)
      positions.push(
        ((intersection.x - line.start.x) * dx +
          (intersection.y - line.start.y) * dy) /
          lengthSquared,
      );
  });
  positions.sort((first, second) => first - second);
  return positions.slice(1).every((position, index) => {
    const middle = (position + positions[index]) / 2;
    return pointIsInsideOutline(
      { x: line.start.x + middle * dx, y: line.start.y + middle * dy },
      outline,
    );
  });
}

function roofFusionSegmentsOverlap(
  first: RoofFusionLine,
  second: RoofFusionLine,
) {
  const dx = first.end.x - first.start.x;
  const dy = first.end.y - first.start.y;
  const lengthSquared = dx * dx + dy * dy;
  const length = Math.sqrt(lengthSquared);
  if (length <= 1e-9) return false;
  const positions: number[] = [];
  for (const point of [second.start, second.end]) {
    if (
      Math.abs(
        (point.x - first.start.x) * dy - (point.y - first.start.y) * dx,
      ) /
        length >
      1e-9
    )
      return false;
    positions.push(
      ((point.x - first.start.x) * dx + (point.y - first.start.y) * dy) /
        lengthSquared,
    );
  }
  return (
    (Math.min(1, Math.max(...positions)) -
      Math.max(0, Math.min(...positions))) *
      length >
    1e-9
  );
}

/** The same bounded preview is used for hover and commit. Only unattached tips
 * move; saved connected nodes and boundary anchors never get reinterpreted. */
export function connectRoofFusionDanglingEndpointsToNewLine(
  lines: readonly RoofFusionLine[],
  newLine: RoofFusionLine,
  outline: readonly RoofFusionPoint[],
  metric: WorkbenchEndpointConstraintMetricV1,
) {
  const attachments: {
    lineId: string;
    endpoint: "start" | "end";
    from: RoofFusionPoint;
    point: RoofFusionPoint;
  }[] = [];
  if (!roofFusionSegmentStaysInOutline(newLine, outline))
    return { lines: [...lines, newLine], attachments };
  let updatedLines = [...lines];
  const newDx = newLine.end.x - newLine.start.x;
  const newDy = newLine.end.y - newLine.start.y;
  const lengthSquared = newDx * newDx + newDy * newDy;
  for (const candidate of roofFusionDanglingEndpoints(lines, outline)) {
    const projected = closestPointOnSegment(
      candidate.point,
      newLine.start,
      newLine.end,
      metric,
    );
    const position =
      ((projected.x - newLine.start.x) * newDx +
        (projected.y - newLine.start.y) * newDy) /
      lengthSquared;
    if (
      position <= 1e-8 ||
      position >= 1 - 1e-8 ||
      sameRoofFusionPoint(projected, candidate.point) ||
      distanceInConstraintPixels(candidate.point, projected, metric) >
        metric.maxDistancePixels ||
      !pointIsInsideOutline(projected, outline)
    )
      continue;
    const original = updatedLines.find((line) => line.id === candidate.lineId);
    if (!original) continue;
    const changed = { ...original, [candidate.endpoint]: projected };
    try {
      assertWorkbenchSkeletonLineLengthV1(changed.start, changed.end);
    } catch {
      continue;
    }
    if (!roofFusionSegmentStaysInOutline(changed, outline)) continue;
    if (
      roofFusionSegmentsOverlap(changed, newLine) ||
      updatedLines.some(
        (line) =>
          line.id !== changed.id && roofFusionSegmentsOverlap(changed, line),
      )
    )
      continue;
    updatedLines = updatedLines.map((line) =>
      line.id === changed.id ? changed : line,
    );
    attachments.push({
      lineId: changed.id,
      endpoint: candidate.endpoint,
      from: candidate.point,
      point: projected,
    });
  }
  return { lines: [...updatedLines, newLine], attachments };
}

/** Move the shared node as one edit and carry existing branches along a changed
 * supporting line. Only exact pre-existing attachments participate. */
export function moveRoofFusionConnectedEndpoint(
  lines: readonly RoofFusionLine[],
  lineId: string,
  endpoint: "start" | "end",
  point: RoofFusionPoint,
): readonly RoofFusionLine[] {
  const selected = lines.find((line) => line.id === lineId);
  if (!selected) return lines;
  const originalPoint = selected[endpoint];
  const moved = lines.map((line) => ({
    ...line,
    start: sameRoofFusionPoint(line.start, originalPoint) ? point : line.start,
    end: sameRoofFusionPoint(line.end, originalPoint) ? point : line.end,
  }));
  const changedCarriers = lines.flatMap((line, index) =>
    sameRoofFusionPoint(line.start, originalPoint) ||
    sameRoofFusionPoint(line.end, originalPoint)
      ? [{ original: line, moved: moved[index] }]
      : [],
  );
  let lostCarrierConnection = false;
  const result = moved.map((line, index) => {
    const carry = (key: "start" | "end") => {
      const original = lines[index][key];
      if (sameRoofFusionPoint(original, originalPoint)) return point;
      for (const carrier of changedCarriers) {
        if (carrier.original.id === line.id) continue;
        const projected = closestPointOnSegment(
          original,
          carrier.original.start,
          carrier.original.end,
        );
        if (!sameRoofFusionPoint(projected, original)) continue;
        const otherCarriers = lines.filter(
          (other) =>
            !changedCarriers.some(
              (changed) => changed.original.id === other.id,
            ) &&
            !sameRoofFusionPoint(other.start, original) &&
            !sameRoofFusionPoint(other.end, original) &&
            sameRoofFusionPoint(
              original,
              closestPointOnSegment(original, other.start, other.end),
            ),
        );
        if (otherCarriers.length) {
          const intersection = otherCarriers
            .map((other) => lineIntersection(carrier.moved, other))
            .find(
              (candidate) =>
                candidate &&
                otherCarriers.every((other) =>
                  sameRoofFusionPoint(
                    candidate,
                    closestPointOnSegment(candidate, other.start, other.end),
                  ),
                ),
            );
          if (intersection) return intersection;
          lostCarrierConnection = true;
          return original;
        }
        const dx = carrier.original.end.x - carrier.original.start.x;
        const dy = carrier.original.end.y - carrier.original.start.y;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared <= 1e-18) continue;
        const position =
          ((original.x - carrier.original.start.x) * dx +
            (original.y - carrier.original.start.y) * dy) /
          lengthSquared;
        return {
          x:
            carrier.moved.start.x +
            position * (carrier.moved.end.x - carrier.moved.start.x),
          y:
            carrier.moved.start.y +
            position * (carrier.moved.end.y - carrier.moved.start.y),
        };
      }
      return line[key];
    };
    return { ...line, start: carry("start"), end: carry("end") };
  });
  return lostCarrierConnection ? lines : result;
}

/** Moving branches cannot attract their own supporting carrier: their apparent
 * target would move again with that carrier and reopen the junction. */
export function roofFusionStationaryEndpointDragLines(
  lines: readonly RoofFusionLine[],
  lineId: string,
  endpoint: "start" | "end",
) {
  const selected = lines.find((line) => line.id === lineId);
  if (!selected) return [];
  const originalPoint = selected[endpoint];
  const movingCarriers = lines.filter(
    (line) =>
      sameRoofFusionPoint(line.start, originalPoint) ||
      sameRoofFusionPoint(line.end, originalPoint),
  );
  return lines.filter((line) => {
    if (movingCarriers.includes(line)) return false;
    return !movingCarriers.some((carrier) =>
      [line.start, line.end].some(
        (point) =>
          !sameRoofFusionPoint(point, carrier.start) &&
          !sameRoofFusionPoint(point, carrier.end) &&
          sameRoofFusionPoint(
            point,
            closestPointOnSegment(point, carrier.start, carrier.end),
          ),
      ),
    );
  });
}

function polygonLabelAnchor(points: readonly RoofFusionPoint[]) {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

export function roofFusionPlaneLabelPlacements(
  planes: readonly RoofFusionRoofPlane[],
  scale = 1,
) {
  const safeScale = Math.max(1, scale);
  const occupied: RoofFusionPoint[] = [];
  const placements = new Map<string, RoofFusionPoint>();
  const offsets = [
    { x: 0, y: 0 },
    { x: 0.1 / safeScale, y: 0 },
    { x: -0.1 / safeScale, y: 0 },
    { x: 0, y: 0.08 / safeScale },
    { x: 0, y: -0.08 / safeScale },
    { x: 0.08 / safeScale, y: 0.06 / safeScale },
    { x: -0.08 / safeScale, y: -0.06 / safeScale },
  ];
  planes.forEach((plane) => {
    const anchor = polygonLabelAnchor(plane.points);
    const placement =
      offsets
        .map((offset) =>
          clampRoofFusionPoint({
            x: anchor.x + offset.x,
            y: anchor.y + offset.y,
          }),
        )
        .find((candidate) =>
          occupied.every(
            (current) =>
              Math.abs(candidate.x - current.x) * safeScale >= 0.09 ||
              Math.abs(candidate.y - current.y) * safeScale >= 0.055,
          ),
        ) ?? anchor;
    occupied.push(placement);
    placements.set(plane.id, placement);
  });
  return placements;
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
  skeleton: "Kraigai / sąlajos / kliūtys",
};

const confidenceLabels: Record<RoofFusionConfidence, string> = {
  high: "Aukštas",
  medium: "Vidutinis",
  low: "Žemas",
};

const planePalette = [
  "#78a9ff",
  "#c69cff",
  "#61c4d8",
  "#f29bc6",
  "#9eb4d8",
  "#d39ce8",
] as const;

export function roofFusionPlaneDisplayId(index: number) {
  let value = Math.max(0, Math.floor(index));
  let result = "";
  do {
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return result;
}

function planeColor(displayId: string) {
  const hash = [...displayId].reduce(
    (value, character) => value * 31 + character.charCodeAt(0),
    0,
  );
  return planePalette[Math.abs(hash) % planePalette.length];
}

export function localizedRoofFusionTechnicalText(value?: string) {
  if (!value) return "Techninė informacija nepateikta.";
  if (/areas and pitches are preliminary/iu.test(value)) {
    return "Plotai ir nuolydžiai yra preliminarūs; prieš naudojimą juos būtina peržiūrėti.";
  }
  if (/approved roof masses|trusted h.yde|calculable planes/iu.test(value)) {
    return "Patvirtintas stogo kontūras ir aukščio duomenys panaudoti preliminarioms plokštumoms apskaičiuoti.";
  }
  if (/[A-Za-z]{4,}/u.test(value) && !/[ĄČĘĖĮŠŲŪŽąčęėįšųūž]/u.test(value)) {
    return "Techninis patikimumo paaiškinimas prieinamas tik sistemos žurnale.";
  }
  return value;
}

function measurementMethodLabel(value: string) {
  if (value === "manual_workbench") return "Rankinis RF žymėjimas";
  if (value === "legacy_manual_pitch") return "Senas rankinis nuolydis";
  return "Roof Fusion skaičiavimas";
}

function restoredMarkingSummary(lines: readonly RoofFusionLine[]) {
  if (lines.length === 0) return null;
  const ridgeCount = lines.filter((line) => line.kind === "ridge").length;
  const valleyCount = lines.length - ridgeCount;
  return `Atkurtas ankstesnis žymėjimas · kraigų: ${ridgeCount} · sąlajų: ${valleyCount}`;
}

function drawnLineSummary(kind: RoofFusionLineKind, count: number) {
  const singular = kind === "ridge" ? "kraigas" : "sąlaja";
  const plural = kind === "ridge" ? "kraigai" : "sąlajos";
  const genitive = kind === "ridge" ? "kraigų" : "sąlajų";
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
  preliminaryHorizontalAreaSquareMeters,
  averageSlopeDegrees,
  footprintPerimeterMeters,
  confidence = "medium",
  confidenceReason,
  resultIdentity,
  resultState = resultIdentity ? "current" : "idle",
  reviewStatus,
  blockers = [],
  calculationProblems = [],
  stageBlockers,
  guardNotice = "Nieko neišsaugo, kol nepatvirtinta",
  geometryHydrationSignal,
  restoredGeometrySignal,
  showRestoredMarkingNotice = true,
  initialStage = "outline",
  initialLayers,
  onStageChange,
  onPrimaryAction,
  onOutlineChange,
  onLineCapture,
  onLineChange,
  onLinesChange,
  onLastLineUndo,
  onLinesClear,
  onLayerVisibilityChange,
  persistencePanel,
  legacyFallbackPanel,
  onChangeBuilding,
  onEditResult,
}: RoofFusionUnifiedWorkbenchProps) {
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
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
  const [hoverLineSnap, setHoverLineSnap] = useState<
    (RoofFusionSnap & { metric: WorkbenchEndpointConstraintMetricV1 }) | null
  >(null);
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
    showRestoredMarkingNotice ? restoredMarkingSummary(lines) : null,
  );
  const [clearLinesArmed, setClearLinesArmed] = useState(false);
  const [redrawRestoredGeometryArmed, setRedrawRestoredGeometryArmed] =
    useState(false);
  const [draggingLineEndpoint, setDraggingLineEndpoint] =
    useState<RoofFusionLineEndpointDrag | null>(null);
  const draggingLineEndpointRef = useRef<RoofFusionLineEndpointDrag | null>(
    null,
  );
  const draftLinesRef = useRef(draftLines);
  const lineCaptureUndoRef = useRef(
    new Map<string, readonly RoofFusionLine[]>(),
  );
  const lastGeometryHydrationSignalRef = useRef(geometryHydrationSignal);
  const lastRestoredGeometrySignalRef = useRef(restoredGeometrySignal);
  const [viewport, setViewport] = useState<RoofFusionViewport>(
    DEFAULT_ROOF_FUSION_VIEWPORT,
  );
  const autoFitAppliedRef = useRef(false);
  const [panGesture, setPanGesture] = useState<RoofFusionPanGesture | null>(
    null,
  );
  const panGestureMovedRef = useRef(false);
  const suppressCanvasClickRef = useRef(false);
  const [approvedOutlineFillOpacity, setApprovedOutlineFillOpacity] =
    useState(14);
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
    const restoredFromEarlierSession = !Object.is(
      lastRestoredGeometrySignalRef.current,
      restoredGeometrySignal,
    );
    lastRestoredGeometrySignalRef.current = restoredGeometrySignal;
    setDraftOutline(
      (approvedOutline?.length ? approvedOutline : sourceOutline).map(
        clampRoofFusionPoint,
      ),
    );
    setDraftLines(lines);
    lineCaptureUndoRef.current.clear();
    setPendingLinePoint(null);
    setHoverLineSnap(null);
    if (restoredFromEarlierSession && showRestoredMarkingNotice) {
      setRestoredMarkingNotice(
        restoredMarkingSummary(lines) ?? "atkurtas patvirtintas kontūras",
      );
    }
    setClearLinesArmed(false);
    setRedrawRestoredGeometryArmed(false);
  }, [
    approvedOutline,
    geometryHydrationSignal,
    lines,
    restoredGeometrySignal,
    showRestoredMarkingNotice,
    sourceOutline,
  ]);

  useEffect(() => {
    draftLinesRef.current = draftLines;
  }, [draftLines]);

  const getCanvasBounds = useCallback(
    () => canvasShellRef.current?.getBoundingClientRect() ?? null,
    [],
  );

  const stopLineDrawing = useCallback(() => {
    setLineMode(null);
    setPendingLinePoint(null);
    setHoverLineSnap(null);
    setLineCaptureProblem(null);
    setLineCaptureNotice(
      "Taškų taisymas: tempkite linijos galą. Sujungti taškai juda kartu.",
    );
  }, []);

  useEffect(() => {
    if (stage !== "skeleton") return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || advancedOpen) return;
      event.preventDefault();
      stopLineDrawing();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [advancedOpen, stage, stopLineDrawing]);

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
      let outlineConstrainedPoint: RoofFusionPoint;
      try {
        outlineConstrainedPoint = constrainWorkbenchPointToOutlineV1(
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
      const snap = endpointMetric
        ? snapRoofFusionSkeletonPoint(
            point,
            draftOutline,
            draftLines,
            endpointMetric,
          )
        : { point: outlineConstrainedPoint, target: null };
      const constrainedPoint = snap.point;
      const snappedToJunction =
        snap.target === "junction" || snap.target === "line";
      const snappedToOutline =
        snap.target === "outline" ||
        outlineConstrainedPoint.x !== point.x ||
        outlineConstrainedPoint.y !== point.y;
      setLineCaptureNotice(
        snappedToJunction
          ? `Taškas magnetiškai pritrauktas prie kraigo arba sąlajos jungties (${WORKBENCH_ENDPOINT_SNAP_TOLERANCE_PX} px).`
          : snappedToOutline
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
      if (
        draftLines.some(
          (line) =>
            (sameRoofFusionPoint(line.start, pendingLinePoint) &&
              sameRoofFusionPoint(line.end, constrainedPoint)) ||
            (sameRoofFusionPoint(line.end, pendingLinePoint) &&
              sameRoofFusionPoint(line.start, constrainedPoint)),
        )
      ) {
        setLineCaptureProblem(
          "Ši linija jau pažymėta. Pasirinkite kitą antrą tašką arba spauskite Esc.",
        );
        return;
      }
      let nextSequence = lineSequence;
      while (
        draftLines.some((line) => line.id === `manual-line-${nextSequence}`)
      )
        nextSequence += 1;
      const capturedLine: RoofFusionLine = {
        id: `manual-line-${nextSequence}`,
        kind: lineMode,
        start: pendingLinePoint,
        end: constrainedPoint,
      };
      if (!roofFusionSegmentStaysInOutline(capturedLine, draftOutline)) {
        setLineCaptureProblem(
          "Linija kerta vietą už stogo kontūro. Pasirinkite kitą antrą tašką arba dalykite liniją ties jungtimi.",
        );
        return;
      }
      if (
        draftLines.some((line) => roofFusionSegmentsOverlap(capturedLine, line))
      ) {
        setLineCaptureProblem(
          "Linija uždengia jau pažymėtą liniją. Junkite prie jos galo arba pasirinkite kitą antrą tašką.",
        );
        return;
      }
      const connected = endpointMetric
        ? connectRoofFusionDanglingEndpointsToNewLine(
            draftLines,
            capturedLine,
            draftOutline,
            endpointMetric,
          )
        : { lines: [...draftLines, capturedLine], attachments: [] };
      if (connected.attachments.length)
        lineCaptureUndoRef.current.set(capturedLine.id, draftLines);
      draftLinesRef.current = connected.lines;
      setDraftLines(connected.lines);
      const completedKindCount =
        draftLines.filter((line) => line.kind === lineMode).length + 1;
      setLineSequence(nextSequence + 1);
      setPendingLinePoint(null);
      setLineCaptureNotice(
        connected.attachments.length
          ? `${drawnLineSummary(lineMode, completedKindCount)} Prie naujos linijos prijungta esamų galų: ${connected.attachments.length}.`
          : drawnLineSummary(lineMode, completedKindCount),
      );
      if (connected.attachments.length && onLinesChange)
        onLinesChange(connected.lines);
      else {
        if (connected.attachments.length) {
          for (const line of connected.lines) {
            if (
              line.id !== capturedLine.id &&
              connected.attachments.some((item) => item.lineId === line.id)
            )
              onLineChange?.(line);
          }
        }
        onLineCapture?.(capturedLine);
      }
    },
    [
      addingVertex,
      draftOutline,
      draftLines,
      lineMode,
      lineSequence,
      onLineCapture,
      onLineChange,
      onLinesChange,
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
    if (pendingLinePoint) {
      setPendingLinePoint(null);
      setHoverLineSnap(null);
      setLineCaptureProblem(null);
      setLineCaptureNotice("Nebaigtos linijos pirmas taškas atšauktas.");
      return;
    }
    const lastLine = draftLines.at(-1);
    if (!lastLine) return;
    const previousLines = lineCaptureUndoRef.current.get(lastLine.id);
    const remainingLines = previousLines ?? draftLines.slice(0, -1);
    lineCaptureUndoRef.current.delete(lastLine.id);
    draftLinesRef.current = remainingLines;
    setDraftLines(remainingLines);
    if (draftLines.length === 1) setRestoredMarkingNotice(null);
    setClearLinesArmed(false);
    setPendingLinePoint(null);
    setLineCaptureProblem(null);
    setLineCaptureNotice("Paskutinė kraigo arba sąlajos linija pašalinta.");
    if (previousLines && onLinesChange) onLinesChange(remainingLines);
    else {
      if (previousLines) previousLines.forEach((line) => onLineChange?.(line));
      onLastLineUndo?.(lastLine);
    }
  }, [
    draftLines,
    onLastLineUndo,
    onLineChange,
    onLinesChange,
    pendingLinePoint,
  ]);

  const clearDraftLines = useCallback(() => {
    if (draftLines.length === 0 && !redrawRestoredGeometryArmed) return;
    const clearedLines = draftLines;
    const redrawWholeDraft = redrawRestoredGeometryArmed;
    if (redrawWholeDraft) {
      const resetOutline = sourceOutline.map(clampRoofFusionPoint);
      setDraftOutline(resetOutline);
      onOutlineChange?.(resetOutline);
    }
    setDraftLines([]);
    lineCaptureUndoRef.current.clear();
    setRestoredMarkingNotice(null);
    setClearLinesArmed(false);
    setRedrawRestoredGeometryArmed(false);
    setPendingLinePoint(null);
    setLineMode(null);
    setHoverLineSnap(null);
    setLineCaptureProblem(null);
    setLineCaptureNotice(
      redrawWholeDraft
        ? "Kontūras ir linijos pakeisti tik neišsaugotame juodraštyje. Patvirtintą reviziją galima atkurti paspaudus „Perkrauti“."
        : "Linijos pašalintos tik iš neišsaugoto juodraščio. Patvirtintą reviziją galima atkurti paspaudus „Perkrauti“.",
    );
    if (clearedLines.length > 0) onLinesClear?.(clearedLines);
  }, [
    draftLines,
    onLinesClear,
    onOutlineChange,
    redrawRestoredGeometryArmed,
    sourceOutline,
  ]);

  const startLineEndpointDrag = useCallback(
    (
      event: PointerEvent<SVGEllipseElement>,
      lineId: string,
      endpoint: "start" | "end",
    ) => {
      if (!event.isPrimary || event.button !== 0 || lineMode) return;
      const originalLine = draftLinesRef.current.find(
        (line) => line.id === lineId,
      );
      if (!originalLine) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const drag = {
        endpoint,
        lineId,
        moved: false,
        originalLine: {
          ...originalLine,
          start: { ...originalLine.start },
          end: { ...originalLine.end },
        },
        originalLines: draftLinesRef.current,
        pointerId: event.pointerId,
      } as const;
      draggingLineEndpointRef.current = drag;
      setDraggingLineEndpoint(drag);
      setLineMode(null);
      setPendingLinePoint(null);
      setLineCaptureProblem(null);
      setLineCaptureNotice(null);
    },
    [lineMode],
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
      const originalPoint = drag.originalLine[drag.endpoint];
      const independentLines = roofFusionStationaryEndpointDragLines(
        drag.originalLines,
        drag.lineId,
        drag.endpoint,
      );
      const attachmentCarriers = independentLines.filter((line) =>
        sameRoofFusionPoint(
          closestPointOnSegment(originalPoint, line.start, line.end),
          originalPoint,
        ),
      );
      if (
        attachmentCarriers.length > 1 &&
        attachmentCarriers.some((line, index) =>
          attachmentCarriers
            .slice(index + 1)
            .some((other) => lineIntersection(line, other) !== null),
        )
      ) {
        setLineCaptureProblem(
          "Jungtis priklauso keliems kraigams arba sąlajoms. Jos vietą keiskite taisydami tų linijų galinius taškus.",
        );
        return;
      }
      // An existing T junction slides on its carrier instead of silently
      // detaching the branch when the pointer leaves the magnet radius.
      const pointerOnCarrier = attachmentCarriers.length
        ? attachmentCarriers
            .map((line) =>
              closestPointOnSegment(pointerPoint, line.start, line.end, metric),
            )
            .sort(
              (first, second) =>
                distanceInConstraintPixels(pointerPoint, first, metric) -
                distanceInConstraintPixels(pointerPoint, second, metric),
            )[0]
        : pointerPoint;
      const snapped = snapRoofFusionSkeletonPoint(
        pointerOnCarrier,
        draftOutline,
        independentLines,
        metric,
      );
      const carrierSafePoint =
        attachmentCarriers.length &&
        !attachmentCarriers.some((line) =>
          sameRoofFusionPoint(
            closestPointOnSegment(snapped.point, line.start, line.end),
            snapped.point,
          ),
        )
          ? pointerOnCarrier
          : snapped.point;
      if (
        attachmentCarriers.length &&
        !pointIsInsideOutline(carrierSafePoint, draftOutline)
      )
        return;
      const constrained = pointIsInsideOutline(carrierSafePoint, draftOutline)
        ? carrierSafePoint
        : closestPointOnOutline(carrierSafePoint, draftOutline, metric);
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
      const nextLines = moveRoofFusionConnectedEndpoint(
        drag.originalLines,
        drag.lineId,
        drag.endpoint,
        constrained,
      );
      if (nextLines === drag.originalLines) {
        setLineCaptureProblem(
          "Šis perkėlimas nutrauktų jungtį su kitu kraigu arba sąlaja. Pasirinkite artimesnę jungties vietą.",
        );
        return;
      }
      try {
        nextLines.forEach((line) => {
          const original = currentLines.find((item) => item.id === line.id);
          if (
            original &&
            sameRoofFusionPoint(original.start, line.start) &&
            sameRoofFusionPoint(original.end, line.end)
          )
            return;
          if (
            !pointIsInsideOutline(line.start, draftOutline) ||
            !pointIsInsideOutline(line.end, draftOutline) ||
            !roofFusionSegmentStaysInOutline(line, draftOutline)
          )
            throw new Error("outside");
          assertWorkbenchSkeletonLineLengthV1(line.start, line.end);
          if (
            nextLines.some(
              (other) =>
                other.id !== line.id && roofFusionSegmentsOverlap(line, other),
            )
          )
            throw new Error("overlap");
        });
      } catch {
        setLineCaptureProblem(
          "Šis perkėlimas išvestų liniją už stogo kontūro arba uždengtų kitą liniją. Pasirinkite artimesnę jungties vietą.",
        );
        return;
      }
      setLineCaptureProblem(null);
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
      const changedLines = draftLinesRef.current.filter((line) => {
        const original = drag.originalLines.find((item) => item.id === line.id);
        return (
          original &&
          (!sameRoofFusionPoint(original.start, line.start) ||
            !sameRoofFusionPoint(original.end, line.end))
        );
      });
      draggingLineEndpointRef.current = null;
      setDraggingLineEndpoint(null);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      if (event.type !== "pointerup") {
        if (drag.moved) {
          const restoredLines = drag.originalLines;
          draftLinesRef.current = restoredLines;
          setDraftLines(restoredLines);
          setLineCaptureNotice("Linijos galinio taško keitimas atšauktas.");
        }
        return;
      }
      if (drag.moved) {
        setRestoredMarkingNotice(null);
        lineCaptureUndoRef.current.clear();
        setLineCaptureNotice(
          changedLines.length > 1
            ? "Jungtis patikslinta. Prijungtos linijos liko sujungtos."
            : "Linijos galinis taškas patikslintas.",
        );
        if (onLinesChange) onLinesChange(draftLinesRef.current);
        else changedLines.forEach((line) => onLineChange?.(line));
      }
    },
    [onLineChange, onLinesChange],
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
        autoFitAppliedRef.current = true;
        setViewport(
          panRoofFusionViewport(panGesture.startViewport, {
            x: (event.clientX - panGesture.startClientX) / (bounds.width || 1),
            y: (event.clientY - panGesture.startClientY) / (bounds.height || 1),
          }),
        );
        return;
      }
      if (stage === "skeleton" && lineMode) {
        const bounds = getCanvasBounds();
        if (!bounds) return;
        const point = pointFromPointer(event, bounds, viewport);
        const metric = roofFusionEndpointConstraintMetric(bounds, viewport);
        try {
          constrainWorkbenchPointToOutlineV1(point, draftOutline, metric);
          setHoverLineSnap({
            ...snapRoofFusionSkeletonPoint(
              point,
              draftOutline,
              draftLinesRef.current,
              metric,
            ),
            metric,
          });
        } catch {
          setHoverLineSnap(null);
        }
        return;
      }
      if (draggingVertex === null || stage !== "outline") return;
      const bounds = getCanvasBounds();
      if (!bounds) return;
      moveVertex(draggingVertex, pointFromPointer(event, bounds, viewport));
    },
    [
      draggingVertex,
      draftOutline,
      getCanvasBounds,
      lineMode,
      moveVertex,
      panGesture,
      stage,
      viewport,
    ],
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
      autoFitAppliedRef.current = true;
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
      autoFitAppliedRef.current = true;
      const next = zoomRoofFusionViewportAt(viewport, viewport.scale + delta);
      setViewport(next);
      if (next.scale === MIN_ROOF_FUSION_ZOOM) {
        setPanGesture(null);
      }
    },
    [viewport],
  );

  const resetViewport = useCallback(() => {
    autoFitAppliedRef.current = true;
    const bounds = getCanvasBounds();
    setViewport(
      bounds
        ? fitRoofFusionViewportToOutline(draftOutline, bounds)
        : DEFAULT_ROOF_FUSION_VIEWPORT,
    );
    setPanGesture(null);
  }, [draftOutline, getCanvasBounds]);

  useEffect(() => {
    if (
      stage === "review" ||
      autoFitAppliedRef.current ||
      draftOutline.length < 3
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (autoFitAppliedRef.current) return;
      const bounds = getCanvasBounds();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      autoFitAppliedRef.current = true;
      setViewport(fitRoofFusionViewportToOutline(draftOutline, bounds));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftOutline, getCanvasBounds, stage]);

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

  const focusExplicitWorkflowTarget = useCallback(
    (target: "editor" | "result" | "building-selection" = "editor") => {
      requestAnimationFrame(() => {
        const element =
          target === "building-selection"
            ? document.querySelector<HTMLElement>(
                "[data-roof-fusion-building-selection]",
              )
            : workspaceHeadingRef.current;
        if (!element) return;
        const reducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        element.scrollIntoView?.({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
        element.focus({ preventScroll: true });
      });
    },
    [],
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
  const visibleBlockers = [
    ...new Set([...activeBlockers, ...calculationProblems]),
  ];

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
      focusExplicitWorkflowTarget("result");
    } finally {
      setPrimaryActionPending(false);
    }
  }, [
    activeBlockers.length,
    focusExplicitWorkflowTarget,
    goToStage,
    onPrimaryAction,
    primaryActionPending,
    stage,
  ]);

  const refreshStaleResult = useCallback(async () => {
    if (primaryActionPending) return;
    setPrimaryActionPending(true);
    try {
      const refreshed = await onPrimaryAction?.("review");
      if (refreshed === false) setAdvancedOpen(true);
    } finally {
      setPrimaryActionPending(false);
    }
  }, [onPrimaryAction, primaryActionPending]);

  const reviewGate =
    resultState === "updating"
      ? {
          label: "Atnaujinama…",
          detail: "Tikrinama aktuali juodraščio revizija.",
          tone: "border-[#78a9ff]/35 bg-[#78a9ff]/10 text-[#cfe0ff]",
        }
      : resultState === "stale"
        ? {
            label: "Rezultatą reikia atnaujinti",
            detail: "Geometrija pasikeitė — ankstesni plotai paslėpti.",
            tone: "border-[#f3c66b]/35 bg-[#e8a317]/10 text-[#ffe2a3]",
          }
        : reviewStatus === "blocked"
          ? {
              label: "Skaičiavimas užblokuotas",
              detail: "Patikslinkite pažymėtą geometriją.",
              tone: "border-red-400/35 bg-red-400/10 text-red-100",
            }
          : reviewStatus === "review_required"
            ? {
                label: "Parengta rankinei peržiūrai",
                detail: "Rezultatas nėra perduotas kainodarai.",
                tone: "border-[#f3c66b]/35 bg-[#e8a317]/10 text-[#ffe2a3]",
              }
            : {
                label: "Parengta peržiūrai",
                detail: "Rezultatas nėra perduotas kainodarai.",
                tone: "border-[#78a9ff]/35 bg-[#78a9ff]/10 text-[#dce9ff]",
              };

  const activeOneCardStep: RoofFusionOneCardStep =
    stage === "review" ? "result" : "refine";
  const activeOneCardStepIndex =
    ROOF_FUSION_ONE_CARD_STEPS.indexOf(activeOneCardStep);
  const navigateToOneCardStep = useCallback(
    (step: RoofFusionOneCardStep) => {
      if (step === "object") {
        onChangeBuilding?.();
        focusExplicitWorkflowTarget("building-selection");
        return;
      }
      if (step === "refine") {
        if (stage === "review") {
          goToStage(draftLines.length > 0 ? "skeleton" : "outline");
          onEditResult?.();
        }
        focusExplicitWorkflowTarget("editor");
        return;
      }
      if (step === "result" && stage === "review") {
        focusExplicitWorkflowTarget("result");
      }
    },
    [
      draftLines.length,
      focusExplicitWorkflowTarget,
      goToStage,
      onChangeBuilding,
      onEditResult,
      stage,
    ],
  );
  const horizontalAreaDeltaSquareMeters =
    stage === "review" &&
    resultState === "current" &&
    horizontalAreaSquareMeters !== undefined &&
    preliminaryHorizontalAreaSquareMeters !== undefined
      ? horizontalAreaSquareMeters - preliminaryHorizontalAreaSquareMeters
      : undefined;
  const displayRoofPlanes = useMemo(
    () =>
      [...roofPlanes]
        .sort((first, second) =>
          (first.displayId ?? first.id).localeCompare(
            second.displayId ?? second.id,
          ),
        )
        .map((plane, index) => ({
          ...plane,
          displayId: plane.displayId ?? roofFusionPlaneDisplayId(index),
        })),
    [roofPlanes],
  );
  const activeSelectedRoofPlaneId = displayRoofPlanes.some(
    (plane) => plane.id === selectedRoofPlaneId,
  )
    ? selectedRoofPlaneId
    : (displayRoofPlanes[0]?.id ?? null);
  const planeLabelPlacements = useMemo(
    () => roofFusionPlaneLabelPlacements(displayRoofPlanes, viewport.scale),
    [displayRoofPlanes, viewport.scale],
  );

  const lineConnectionPreview = useMemo(
    () =>
      pendingLinePoint && lineMode && hoverLineSnap
        ? connectRoofFusionDanglingEndpointsToNewLine(
            draftLines,
            {
              id: "pending-line",
              kind: lineMode,
              start: pendingLinePoint,
              end: hoverLineSnap.point,
            },
            draftOutline,
            hoverLineSnap.metric,
          )
        : null,
    [draftLines, draftOutline, pendingLinePoint, lineMode, hoverLineSnap],
  );
  const previewExistingLines = lineConnectionPreview
    ? lineConnectionPreview.lines.filter((line) => line.id !== "pending-line")
    : draftLines;
  const displayLines = lineConnectionPreview?.lines ?? [
    ...draftLines,
    ...(pendingLinePoint && lineMode
      ? [
          {
            id: "pending-line",
            kind: lineMode,
            start: pendingLinePoint,
            end: hoverLineSnap?.point ?? pendingLinePoint,
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
  const danglingEndpoints = useMemo(
    () => roofFusionDanglingEndpoints(draftLines, draftOutline),
    [draftLines, draftOutline],
  );

  return (
    <section
      aria-label="Roof Fusion vieno lango matavimo darbo vieta"
      className="overflow-hidden rounded-3xl border border-white/10 bg-[#111722] text-[#f4f1ea] shadow-2xl shadow-black/30"
      data-roof-fusion-result-state={
        stage === "review" ? resultState : undefined
      }
      data-roof-fusion-workbench="unified"
      data-roof-fusion-stage={stage}
    >
      <div
        className={`flex flex-col gap-0 ${stage === "review" ? "xl:flex-row" : "md:flex-row"}`}
        data-roof-fusion-responsive-layout={
          stage === "review" ? "result" : "refine"
        }
      >
        <div
          className={`min-w-0 flex-1 bg-[#0c111a] p-3 ${stage === "review" ? "sm:p-3" : "sm:p-5"}`}
        >
          <div
            className={`${stage === "review" ? "mb-2" : "mb-4"} flex flex-wrap items-start justify-between gap-3`}
          >
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#e8a317] uppercase">
                Roof Fusion · Preview
              </p>
              <h2
                className="mt-1 scroll-mt-36 text-xl font-semibold tracking-tight outline-none sm:text-2xl"
                data-roof-fusion-active-anchor={
                  stage === "review" ? "result" : "editor"
                }
                data-roof-fusion-active-heading
                ref={workspaceHeadingRef}
                tabIndex={-1}
              >
                Sudėtingo stogo matavimas
              </h2>
              {stage !== "review" ? (
                <p className="mt-1 max-w-2xl text-sm text-[#c4c0b8]">
                  Viename ortofoto lange pažymėkite tik tai, ko sistema negali
                  patikimai nustatyti pati.
                </p>
              ) : null}
            </div>
            <span className="rounded-full border border-[#e8a317]/30 bg-[#e8a317]/10 px-3 py-1.5 text-xs font-medium text-[#f3c66b]">
              {guardNotice}
            </span>
          </div>

          {stage !== "review" ? sourceStatusPanel : null}

          {restoredMarkingNotice ? (
            <div
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#71e6b4]/30 bg-[#46d69a]/10 px-3 py-2 text-sm text-[#dff9ed]"
              data-roof-fusion-restored-marking
            >
              <span aria-live="polite" className="min-w-0 flex-1" role="status">
                <strong className="block text-xs sm:text-sm">
                  Atkurti ankstesni nebaigto matavimo pakeitimai
                </strong>
                <span className="mt-0.5 block text-[11px] text-[#b8dccc]">
                  {restoredMarkingNotice.replace(
                    "Atkurtas ankstesnis žymėjimas · ",
                    "",
                  )}
                </span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  aria-label="Tęsti atkurtą nebaigtą matavimą"
                  className="min-h-11 rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10"
                  data-roof-fusion-continue-restored
                  onClick={() => setRestoredMarkingNotice(null)}
                  title="Tęsti su atkurta kontūro ir linijų geometrija"
                  type="button"
                >
                  Tęsti
                </button>
                <button
                  aria-label="Perbraižyti atkurtą matavimo geometriją"
                  className="min-h-11 rounded-lg border border-[#f3c66b]/45 bg-[#e8a317]/10 px-3 text-xs font-semibold text-[#ffe2a3] hover:bg-[#e8a317]/20"
                  data-roof-fusion-redraw-lines
                  onClick={() => {
                    if (stage === "review") onEditResult?.();
                    goToStage("skeleton");
                    setRedrawRestoredGeometryArmed(true);
                    setClearLinesArmed(true);
                  }}
                  title="Pradėti nuo šaltinio kontūro; patvirtinta revizija liks saugi"
                  type="button"
                >
                  Perbraižyti
                </button>
              </div>
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
                    disabled={!reachable && !active}
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
              aria-label="Talpinti pasirinktą stogą darbo zonoje"
              onClick={resetViewport}
              title="Talpinti pasirinktą stogą su saugiu tarpu aplink kontūrą"
              type="button"
            >
              Talpinti stogą
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
                setHoverLineSnap(null);
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
                  {displayRoofPlanes.map((plane, index) => (
                    <g key={plane.id}>
                      <polygon
                        aria-label={`${plane.displayId} · ${plane.label ?? `Stogo plokštuma ${index + 1}`}`}
                        aria-pressed={activeSelectedRoofPlaneId === plane.id}
                        className={
                          stage === "review" ? "cursor-pointer" : undefined
                        }
                        data-roof-fusion-roof-plane={plane.id}
                        fill="transparent"
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
                        pointerEvents={stage === "review" ? "all" : "none"}
                        points={pointsAttribute(plane.points)}
                        role={stage === "review" ? "button" : undefined}
                        stroke="transparent"
                        strokeWidth="22px"
                        tabIndex={stage === "review" ? 0 : undefined}
                        vectorEffect="non-scaling-stroke"
                      />
                      <polygon
                        aria-hidden="true"
                        data-roof-fusion-roof-plane-outer={plane.id}
                        fill={planeColor(plane.displayId)}
                        fillOpacity={
                          activeSelectedRoofPlaneId === plane.id ? ".24" : ".14"
                        }
                        pointerEvents="none"
                        points={pointsAttribute(plane.points)}
                        stroke={ROOF_FUSION_GEOMETRY_TOKENS.contrastHalo}
                        strokeLinejoin="round"
                        strokeWidth="3px"
                        vectorEffect="non-scaling-stroke"
                      />
                      <polygon
                        aria-hidden="true"
                        data-roof-fusion-roof-plane-inner={plane.id}
                        fill="none"
                        pointerEvents="none"
                        points={pointsAttribute(plane.points)}
                        stroke={planeColor(plane.displayId)}
                        strokeLinejoin="round"
                        strokeWidth="1.5px"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
                </g>
              )}
              {layerVisibility.sourceOutline && sourceOutline.length >= 3 && (
                <g data-roof-fusion-layer-group="sourceOutline">
                  <polygon
                    aria-hidden="true"
                    data-roof-fusion-layer="sourceOutline"
                    fill="none"
                    points={pointsAttribute(sourceOutline)}
                    stroke={ROOF_FUSION_GEOMETRY_TOKENS.contrastHalo}
                    strokeDasharray="6px 5px"
                    strokeWidth="3px"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polygon
                    aria-hidden="true"
                    fill="none"
                    points={pointsAttribute(sourceOutline)}
                    stroke={ROOF_FUSION_GEOMETRY_TOKENS.source}
                    strokeDasharray="6px 5px"
                    strokeWidth="1.5px"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}
              {layerVisibility.approvedOutline && draftOutline.length >= 3 && (
                <g data-roof-fusion-layer-group="approvedOutline">
                  <polygon
                    aria-hidden="true"
                    data-roof-fusion-layer="approvedOutline"
                    fill={ROOF_FUSION_GEOMETRY_TOKENS.approved}
                    fillOpacity={approvedOutlineFillOpacity / 100}
                    points={pointsAttribute(draftOutline)}
                    stroke={ROOF_FUSION_GEOMETRY_TOKENS.contrastHalo}
                    strokeLinejoin="round"
                    strokeWidth="3.5px"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polygon
                    aria-hidden="true"
                    fill="none"
                    points={pointsAttribute(draftOutline)}
                    stroke={ROOF_FUSION_GEOMETRY_TOKENS.approved}
                    strokeLinejoin="round"
                    strokeWidth="2px"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}
              {layerVisibility.skeleton && (
                <g data-roof-fusion-layer="skeleton">
                  {previewExistingLines.map((line) => (
                    <line
                      aria-hidden="true"
                      data-roof-fusion-line-hit-target={line.id}
                      key={`${line.id}:hit-target`}
                      onClick={
                        lineMode
                          ? undefined
                          : (event) => event.stopPropagation()
                      }
                      onPointerDown={
                        lineMode
                          ? undefined
                          : (event) => event.stopPropagation()
                      }
                      pointerEvents={lineMode ? "none" : "stroke"}
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
                      aria-hidden="true"
                      key={`${line.id}:outer`}
                      pointerEvents="none"
                      stroke={ROOF_FUSION_GEOMETRY_TOKENS.contrastHalo}
                      strokeDasharray={
                        line.id === "pending-line" || line.kind === "valley"
                          ? "6px 5px"
                          : undefined
                      }
                      strokeLinecap="round"
                      strokeWidth="3.5px"
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
                      pointerEvents="none"
                      key={line.id}
                      stroke={
                        line.kind === "ridge"
                          ? ROOF_FUSION_GEOMETRY_TOKENS.ridge
                          : ROOF_FUSION_GEOMETRY_TOKENS.valley
                      }
                      strokeDasharray={
                        line.id === "pending-line" || line.kind === "valley"
                          ? "6px 5px"
                          : undefined
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
                  {previewExistingLines.map((line) => (
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
                            onClick={
                              lineMode
                                ? undefined
                                : (event) => event.stopPropagation()
                            }
                            onLostPointerCapture={finishLineEndpointDrag}
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
                            pointerEvents={lineMode ? "none" : "all"}
                            rx={lineHitRadii.rx}
                            ry={lineHitRadii.ry}
                          />
                          <ellipse
                            aria-hidden="true"
                            cx={point.x}
                            cy={point.y}
                            data-roof-fusion-line-endpoint-outline={`${line.id}:${index}`}
                            fill={
                              line.kind === "ridge"
                                ? ROOF_FUSION_GEOMETRY_TOKENS.ridge
                                : ROOF_FUSION_GEOMETRY_TOKENS.valley
                            }
                            pointerEvents="none"
                            rx={lineEndpointRadii.rx}
                            ry={lineEndpointRadii.ry}
                          />
                          <ellipse
                            aria-hidden="true"
                            cx={point.x}
                            cy={point.y}
                            data-roof-fusion-line-endpoint-center={`${line.id}:${index}`}
                            fill="#fffdf7"
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
                      fill={
                        selectedVertex === index
                          ? ROOF_FUSION_GEOMETRY_TOKENS.approved
                          : "#fffdf7"
                      }
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
                      stroke={ROOF_FUSION_GEOMETRY_TOKENS.approved}
                      strokeWidth="2px"
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
                  stroke={
                    lineMode === "valley"
                      ? ROOF_FUSION_GEOMETRY_TOKENS.valley
                      : ROOF_FUSION_GEOMETRY_TOKENS.ridge
                  }
                  strokeWidth="2px"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {stage === "skeleton" &&
                layerVisibility.skeleton &&
                danglingEndpoints.map((endpoint) => (
                  <ellipse
                    aria-label={`${endpoint.label}: neprijungtas`}
                    cx={endpoint.point.x}
                    cy={endpoint.point.y}
                    data-roof-fusion-dangling-endpoint={`${endpoint.lineId}:${endpoint.endpoint}`}
                    fill="none"
                    key={`dangling:${endpoint.lineId}:${endpoint.endpoint}`}
                    pointerEvents="none"
                    rx={pendingLinePointRadii.rx * 2.5}
                    ry={pendingLinePointRadii.ry * 2.5}
                    stroke="#ffadad"
                    strokeWidth="2px"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{endpoint.label}: neprijungtas</title>
                  </ellipse>
                ))}
              {stage === "skeleton" && lineMode && hoverLineSnap?.target && (
                <ellipse
                  aria-hidden="true"
                  cx={hoverLineSnap.point.x}
                  cy={hoverLineSnap.point.y}
                  data-roof-fusion-snap-target={hoverLineSnap.target}
                  fill="none"
                  pointerEvents="none"
                  rx={pendingLinePointRadii.rx * 1.8}
                  ry={pendingLinePointRadii.ry * 1.8}
                  stroke="#fffdf7"
                  strokeWidth="2px"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {stage === "skeleton" &&
                lineConnectionPreview?.attachments.map((attachment) => (
                  <ellipse
                    aria-hidden="true"
                    cx={attachment.point.x}
                    cy={attachment.point.y}
                    data-roof-fusion-connection-preview={`${attachment.lineId}:${attachment.endpoint}`}
                    fill="none"
                    key={`connection-preview:${attachment.lineId}:${attachment.endpoint}`}
                    pointerEvents="none"
                    rx={pendingLinePointRadii.rx * 2.5}
                    ry={pendingLinePointRadii.ry * 2.5}
                    stroke="#fffdf7"
                    strokeWidth="2px"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            </svg>
            {stage === "review" &&
              resultState === "current" &&
              layerVisibility.roofPlanes &&
              displayRoofPlanes.map((plane) => {
                const position = planeLabelPlacements.get(plane.id);
                if (!position) return null;
                return (
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-[#09111d]/90 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white shadow-sm ${activeSelectedRoofPlaneId === plane.id ? "ring-1 ring-white/70" : ""}`}
                    data-roof-fusion-plane-label={plane.id}
                    key={`${plane.id}:label`}
                    style={{
                      borderColor: planeColor(plane.displayId),
                      left: `${(viewport.offsetX + position.x * viewport.scale) * 100}%`,
                      top: `${(viewport.offsetY + position.y * viewport.scale) * 100}%`,
                    }}
                  >
                    {plane.displayId} ·{" "}
                    {formatNumber(plane.areaSquareMeters, " m²")}
                  </span>
                );
              })}
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px] font-medium">
              <span
                className="rounded-full border bg-[#111722]/85 px-2.5 py-1"
                style={{
                  borderColor: ROOF_FUSION_GEOMETRY_TOKENS.source,
                  color: ROOF_FUSION_GEOMETRY_TOKENS.source,
                }}
              >
                ╌ Šaltinis (nekintamas)
              </span>
              <span
                className="rounded-full border bg-[#111722]/85 px-2.5 py-1"
                style={{
                  borderColor: ROOF_FUSION_GEOMETRY_TOKENS.approved,
                  color: ROOF_FUSION_GEOMETRY_TOKENS.approved,
                }}
              >
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
            {stage === "skeleton" ? (
              <div
                aria-label="Kraigų ir sąlajų žymėjimo įrankiai"
                className="absolute top-2 right-2 left-2 z-30 grid grid-cols-2 gap-1.5 rounded-xl border border-white/20 bg-[#09111d]/95 p-1.5 shadow-xl backdrop-blur-sm sm:grid-cols-4"
                data-roof-fusion-skeleton-toolbar="canvas-overlay"
                role="group"
              >
                {(["ridge", "valley"] as const).map((kind) => (
                  <button
                    aria-pressed={lineMode === kind}
                    aria-label={
                      kind === "ridge" ? "Žymėti kraigą" : "Žymėti sąlają"
                    }
                    className={`min-h-11 min-w-0 rounded-lg border px-2 text-xs leading-tight font-semibold ${lineMode === kind ? "border-[#e8a317] bg-[#e8a317]/15 text-[#f3c66b]" : "border-white/15 bg-white/5 text-[#ddd8cd] hover:bg-white/10"}`}
                    data-roof-fusion-line-mode={kind}
                    key={kind}
                    onClick={() => {
                      setLineMode(kind);
                      setPendingLinePoint(null);
                      setHoverLineSnap(null);
                      setLineCaptureProblem(null);
                      setLineCaptureNotice(null);
                    }}
                    title={
                      kind === "ridge"
                        ? "Pridėti kraigo liniją dviem paspaudimais"
                        : "Pridėti sąlajos liniją dviem paspaudimais"
                    }
                    type="button"
                  >
                    {kind === "ridge"
                      ? draftLines.some((line) => line.kind === "ridge")
                        ? "＋ Dar vienas kraigas"
                        : "＋ Kraigas"
                      : draftLines.some((line) => line.kind === "valley")
                        ? "⌄ Dar viena sąlaja"
                        : "⌄ Sąlaja"}
                  </button>
                ))}
                <button
                  aria-label="Atšaukti paskutinę kraigo arba sąlajos liniją"
                  className="min-h-11 min-w-0 rounded-lg border border-white/15 bg-white/5 px-2 text-xs leading-tight font-semibold text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  data-roof-fusion-undo-last-line
                  disabled={draftLines.length === 0 && !pendingLinePoint}
                  onClick={undoLastLine}
                  title="Atšaukti paskutinę nubrėžtą liniją"
                  type="button"
                >
                  Atšaukti paskutinę
                </button>
                <button
                  aria-label="Perbraižyti visas kraigų ir sąlajų linijas"
                  className="min-h-11 min-w-0 rounded-lg border border-white/15 bg-white/5 px-2 text-xs leading-tight font-semibold text-[#ddd8cd] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  data-roof-fusion-clear-lines
                  disabled={draftLines.length === 0}
                  onClick={() => {
                    setRedrawRestoredGeometryArmed(false);
                    setClearLinesArmed(true);
                  }}
                  title="Išvalyti visas šio neišsaugoto juodraščio linijas"
                  type="button"
                >
                  Perbraižyti linijas
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {stage !== "review" ? (
              <div
                aria-label="Geometrijos linijų legenda"
                className="flex flex-wrap items-center gap-3 text-[11px] text-[#c4c0b8]"
                data-roof-fusion-geometry-legend
              >
                {(
                  [
                    ["source", "Šaltinis"],
                    ["approved", "Kontūras"],
                    ["ridge", "Kraigas"],
                    ["valley", "Sąlaja"],
                  ] as const
                ).map(([kind, label]) => (
                  <span className="inline-flex items-center gap-1.5" key={kind}>
                    <span
                      aria-hidden="true"
                      className={`inline-block w-6 border-t-2 ${kind === "valley" || kind === "source" ? "border-dashed" : ""}`}
                      data-roof-fusion-geometry-legend-token={kind}
                      style={{
                        borderColor: ROOF_FUSION_GEOMETRY_TOKENS[kind],
                      }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            {stage !== "review" ? (
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
            ) : null}
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
              aria-live="polite"
              className="mt-2 flex flex-wrap items-center gap-2"
              data-roof-fusion-skeleton-tools
            >
              <span className="text-xs text-[#aaa69d]">
                {lineMode
                  ? pendingLinePoint
                    ? "Pasirinkite antrą tašką"
                    : "Pasirinkite pirmą tašką"
                  : "Tempdami tašką taisykite liniją arba bendrą jungtį."}
              </span>
              <button
                aria-pressed={lineMode === null}
                className="min-h-11 rounded-lg border border-white/15 px-3 text-xs text-[#ddd8cd] hover:bg-white/10"
                data-roof-fusion-edit-points
                data-roof-fusion-edit-lines
                onClick={stopLineDrawing}
                type="button"
              >
                Taisyti taškus · Esc
              </button>
              {lineMode && (
                <span className="text-xs text-[#aaa69d]">
                  Baltas žiedas rodo magnetinę jungtį. Įrankis lieka aktyvus
                  kitai linijai.
                </span>
              )}
              {clearLinesArmed ? (
                <div
                  className="basis-full rounded-xl border border-[#f3c66b]/35 bg-[#e8a317]/10 p-3 text-xs text-[#ddd8cd]"
                  data-roof-fusion-clear-lines-confirmation
                  role="alert"
                >
                  <p>
                    {redrawRestoredGeometryArmed
                      ? "Bus atkurta pradinė šaltinio kontūro geometrija ir išvalytos šio neišsaugoto juodraščio linijos."
                      : "Bus išvalytos tik šio neišsaugoto juodraščio linijos."}
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
                      onClick={() => {
                        setClearLinesArmed(false);
                        setRedrawRestoredGeometryArmed(false);
                      }}
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
              {lineConnectionPreview &&
                lineConnectionPreview.attachments.length > 0 && (
                  <span
                    className="basis-full text-xs text-[#71e6b4]"
                    data-roof-fusion-connection-preview-notice
                  >
                    Prijungiama: {lineConnectionPreview.attachments.length}{" "}
                    esamų galų prie naujos linijos (
                    {WORKBENCH_ENDPOINT_SNAP_TOLERANCE_PX} px).
                  </span>
                )}
              {danglingEndpoints.length > 0 && (
                <span
                  className="basis-full text-xs text-[#ffadad]"
                  data-roof-fusion-dangling-guidance
                >
                  Neprijungtų galų: {danglingEndpoints.length}. Prijunkite
                  pažymėtus taškus prie kontūro arba kitos linijos.
                </span>
              )}
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

        <aside
          className={`w-full shrink-0 border-t border-white/10 bg-[#151c28] p-4 ${stage === "review" ? "xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:w-[390px] xl:overflow-hidden xl:border-t-0 xl:border-l" : "sm:p-5 md:w-[300px] md:border-t-0 md:border-l lg:w-[340px]"}`}
        >
          <div
            className={
              stage === "review"
                ? "flex h-full min-h-0 flex-col gap-3"
                : "space-y-4"
            }
          >
            {stage === "review" ? (
              <div
                aria-live="polite"
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${reviewGate.tone}`}
                data-roof-fusion-preview-complete={
                  resultState === "current" ? true : undefined
                }
                data-roof-fusion-review-gate={resultState}
                role="status"
              >
                <span>
                  <strong className="block">{reviewGate.label}</strong>
                  <span className="mt-0.5 block opacity-80">
                    {reviewGate.detail}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-current/25 px-2 py-1 font-semibold">
                  Preview
                </span>
              </div>
            ) : null}
            {stage !== "review" ? (
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
                  {visibleBlockers.length ? (
                    <ul
                      className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#ffadad]"
                      data-roof-fusion-visible-blockers
                    >
                      {visibleBlockers.map((blocker) => (
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
            ) : null}

            <dl className="grid grid-cols-2 gap-2" data-roof-fusion-metrics>
              {stage !== "review" ? (
                <div className="rounded-xl border border-white/10 bg-[#0f151f] p-3">
                  <dt className="text-[11px] text-[#aaa69d]">Horizontalus</dt>
                  <dd className="mt-1 text-lg font-semibold">
                    {formatNumber(horizontalAreaSquareMeters, " m²")}
                  </dd>
                </div>
              ) : (
                <div
                  className="col-span-2 rounded-xl border border-white/10 bg-[#0f151f] p-2.5"
                  data-roof-fusion-horizontal-result
                >
                  <dt className="text-[10px] text-[#aaa69d]">
                    Horizontalus plotas
                  </dt>
                  <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <strong className="text-base text-white">
                      {formatNumber(
                        resultState === "current"
                          ? horizontalAreaSquareMeters
                          : undefined,
                        " m²",
                      )}
                    </strong>
                    {horizontalAreaDeltaSquareMeters !== undefined &&
                    Math.abs(horizontalAreaDeltaSquareMeters) >= 0.05 ? (
                      <span
                        className="text-[10px] text-[#aaa69d]"
                        data-roof-fusion-preliminary-area-delta
                      >
                        nuo OSM preliminaraus{" "}
                        {horizontalAreaDeltaSquareMeters > 0 ? "+" : ""}
                        {formatNumber(horizontalAreaDeltaSquareMeters, " m²")}
                      </span>
                    ) : null}
                  </dd>
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-[#0f151f] p-2.5">
                <dt className="text-[10px] text-[#aaa69d]">Tikras plotas</dt>
                <dd className="mt-1 text-base font-semibold text-white">
                  {formatNumber(totalSurfaceAreaSquareMeters, " m²")}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f151f] p-2.5">
                <dt className="text-[10px] text-[#aaa69d]">Vid. nuolydis</dt>
                <dd className="mt-1 text-base font-semibold">
                  {formatNumber(averageSlopeDegrees, "°")}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f151f] p-2.5">
                <dt className="text-[10px] text-[#aaa69d]">Perimetras</dt>
                <dd className="mt-1 text-base font-semibold">
                  {formatNumber(footprintPerimeterMeters, " m")}
                </dd>
              </div>
            </dl>

            {stage === "review" && displayRoofPlanes.length ? (
              <div
                className="min-h-0 flex-1 rounded-2xl border border-white/10 bg-[#0f151f] p-3"
                data-roof-fusion-surface-results
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">Stogo šlaitai</strong>
                  <span className="text-xs text-[#aaa69d]">
                    {displayRoofPlanes.length}
                  </span>
                </div>
                <div className="mt-2 grid max-h-[min(32dvh,16rem)] gap-1.5 overflow-y-auto pr-1">
                  {displayRoofPlanes.map((plane, index) => (
                    <button
                      aria-pressed={activeSelectedRoofPlaneId === plane.id}
                      className={`grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left ${activeSelectedRoofPlaneId === plane.id ? "border-white/35 bg-white/10" : "border-white/10 bg-[#151c28] hover:border-white/20"}`}
                      data-roof-fusion-surface-result={plane.id}
                      key={plane.id}
                      onClick={() => setSelectedRoofPlaneId(plane.id)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: planeColor(plane.displayId) }}
                      />
                      <span className="min-w-0">
                        <strong className="block truncate text-xs">
                          {plane.displayId} ·{" "}
                          {plane.label ?? `Šlaitas ${index + 1}`}
                        </strong>
                        <span className="mt-0.5 block text-[10px] text-[#aaa69d]">
                          {formatNumber(plane.slopeDegrees, "°")} nuolydis
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
                        <strong className="block text-sm text-white">
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

            {stage === "review" ? (
              <details
                className="rounded-xl border border-white/10 bg-[#0f151f] text-xs text-[#c4c0b8]"
                data-roof-fusion-measurement-info
              >
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-semibold text-[#ddd8cd]">
                  <span>Matavimo informacija</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-[#aaa69d]">
                    {confidenceLabels[confidence]}
                  </span>
                </summary>
                <div className="space-y-2 border-t border-white/10 px-3 py-3 leading-relaxed">
                  <p>
                    <strong className="text-[#ddd8cd]">Patikimumas:</strong>{" "}
                    {localizedRoofFusionTechnicalText(confidenceReason)}
                  </p>
                  <p>
                    <strong className="text-[#ddd8cd]">
                      Šaltinio kontūras nekintamas.
                    </strong>{" "}
                    Pataisymai saugomi atskirame patvirtintame kontūre.
                  </p>
                  {resultState === "current" &&
                  horizontalAreaSquareMeters !== undefined ? (
                    <p data-roof-fusion-area-provenance>
                      <strong className="text-[#ddd8cd]">
                        Horizontalus plotas:
                      </strong>{" "}
                      {formatNumber(horizontalAreaSquareMeters, " m²")} gauta iš
                      kanoninės EPSG:25833 patvirtintos ir apskaičiuotos
                      geometrijos.
                      {preliminaryHorizontalAreaSquareMeters !== undefined ? (
                        <>
                          {" "}
                          OSM preliminarus kontūras buvo{" "}
                          {formatNumber(
                            preliminaryHorizontalAreaSquareMeters,
                            " m²",
                          )}
                          ; nedidelis projekcijos ir patvirtinto kontūro
                          skirtumas yra tikėtinas.
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {activeBlockers.length ? (
                    <ul className="list-disc space-y-1 pl-4 text-[#ffd3a6]">
                      {activeBlockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  ) : null}
                  {resultIdentity ? (
                    <p
                      className="font-mono text-[10px] break-all text-[#8e98a8]"
                      data-roof-fusion-result-identity={
                        resultIdentity.snapshotId
                      }
                    >
                      {measurementMethodLabel(resultIdentity.measurementMethod)}{" "}
                      · r{resultIdentity.revision} · draft{" "}
                      {resultIdentity.draftHash?.slice(0, 12) ?? "—"}… · result{" "}
                      {resultIdentity.snapshotHash.slice(0, 12)}…
                    </p>
                  ) : null}
                  {sourceStatusPanel}
                </div>
              </details>
            ) : (
              <div className="rounded-2xl border border-[#e8a317]/25 bg-[#e8a317]/10 p-3 text-xs leading-relaxed text-[#ddd8cd]">
                <strong className="text-[#f3c66b]">
                  Šaltinio kontūras nekintamas.
                </strong>{" "}
                Jis lieka matomas brūkšniuota linija, o pataisymai kuriami kaip
                atskiras patvirtintas kontūras.
              </div>
            )}

            {stage === "review" ? (
              <div className="sticky bottom-0 mt-auto grid gap-2 border-t border-white/10 bg-[#151c28] pt-3">
                {resultState === "current" ? (
                  <div
                    className="flex items-center justify-between gap-2 text-[11px] text-[#aaa69d]"
                    data-roof-fusion-offer-transfer-boundary
                  >
                    <span>Perkėlimas į pasiūlymą dar neįjungtas</span>
                    <span className="rounded-full border border-white/15 px-2 py-0.5">
                      tik Preview
                    </span>
                  </div>
                ) : null}
                {resultState === "stale" || resultState === "updating" ? (
                  <button
                    className="min-h-11 rounded-xl bg-[#78a9ff] px-4 text-sm font-bold text-[#07101d] hover:bg-[#91b9ff] disabled:cursor-wait disabled:opacity-60"
                    data-roof-fusion-refresh-result
                    disabled={
                      primaryActionPending || resultState === "updating"
                    }
                    onClick={() => void refreshStaleResult()}
                    type="button"
                  >
                    {primaryActionPending || resultState === "updating"
                      ? "Atnaujinama…"
                      : "Atnaujinti skaičiavimą"}
                  </button>
                ) : (
                  <button
                    className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-[#ddd8cd] hover:bg-white/10"
                    data-roof-fusion-edit-result
                    onClick={() => navigateToOneCardStep("refine")}
                    type="button"
                  >
                    Keisti žymėjimą
                  </button>
                )}
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
