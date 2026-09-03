import { z } from "zod";
import {
  canonicalSha256V1,
  canonicalizeJsonValueV1,
  compareCanonicalStringsV1,
  uniqueCanonicalStringsV1,
} from "./canonicalization-v1";

/**
 * The editable, plan-view topology captured in the administrator workbench.
 * It intentionally stops before height fitting: a later height-segmentation
 * step turns these approved plan constraints into 3D roof surfaces.
 */
export const ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION =
  "assisted-manual-roof-geometry.v1" as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);

const vertexSchema = z
  .object({
    vertexId: identifier,
    xM: z.number(),
    yM: z.number(),
  })
  .strict();

const polygonReferenceSchema = z
  .object({ vertexIds: z.array(identifier).min(3).max(500) })
  .strict();

const pointSchema = z
  .object({
    xM: z.number(),
    yM: z.number(),
  })
  .strict();

const coordinateSystemSchema = z
  .object({
    kind: z.literal("projected_crs"),
    reference: z.literal("EPSG:25833"),
    axisOrder: z.literal("easting_northing"),
  })
  .strict();

export const assistedManualRoofGeometryV1Schema = z
  .object({
    schemaVersion: z.literal(ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION),
    coordinateSystem: coordinateSystemSchema,
    vertices: z.array(vertexSchema).min(3).max(10_000),
    /** Original source evidence. This is never an administrator edit target. */
    sourceFootprint: z
      .object({
        footprintId: identifier,
        sourceId: identifier,
        sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/u),
        /** Raw source geometry, deliberately independent of editable vertices. */
        points: z.array(pointSchema).min(3).max(500),
      })
      .strict(),
    /** One or more administrator-approved eave outlines. */
    roofMasses: z
      .array(
        polygonReferenceSchema
          .extend({
            massId: identifier,
            outlineId: identifier,
            approvedByActorId: identifier,
            approvedAt: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    skeletonEdges: z
      .array(
        z
          .object({
            edgeId: identifier,
            roofMassId: identifier,
            fromVertexId: identifier,
            toVertexId: identifier,
            type: z.enum(["ridge", "valley", "hip", "eave"]),
            provenance: z.enum(["manual", "automatic"]),
          })
          .strict(),
      )
      .max(1_000),
    openings: z
      .array(
        polygonReferenceSchema
          .extend({
            openingId: identifier,
            roofMassId: identifier,
            kind: z.enum(["skylight", "roof_hatch", "chimney", "vent", "dormer", "unknown"]),
          })
          .strict(),
      )
      .max(2_000),
    obstacles: z
      .array(
        polygonReferenceSchema
          .extend({
            obstacleId: identifier,
            roofMassId: identifier,
            kind: z.enum([
              "chimney",
              "vent",
              "snow_guard",
              "solar_panel",
              "antenna",
              "tree_cover",
              "access_restriction",
              "unknown",
            ]),
          })
          .strict(),
      )
      .max(2_000),
  })
  .strict();

export type AssistedManualRoofGeometryV1 = z.infer<
  typeof assistedManualRoofGeometryV1Schema
>;

export type AssistedManualRoofGeometryIssueCodeV1 =
  | "SCHEMA_INVALID"
  | "NON_FINITE_COORDINATE"
  | "DUPLICATE_ID"
  | "UNKNOWN_VERTEX"
  | "DUPLICATE_RING_VERTEX"
  | "DEGENERATE_POLYGON"
  | "SELF_INTERSECTING_POLYGON"
  | "UNKNOWN_ROOF_MASS"
  | "SKELETON_ZERO_LENGTH"
  | "SKELETON_ENDPOINT_OUTSIDE_MASS"
  | "EAVE_ENDPOINT_NOT_ON_MASS_BOUNDARY"
  | "FEATURE_OUTSIDE_MASS";

export type AssistedManualRoofGeometryIssueV1 = {
  code: AssistedManualRoofGeometryIssueCodeV1;
  entityRefs: string[];
};

export class AssistedManualRoofGeometryValidationError extends Error {
  constructor(readonly issues: AssistedManualRoofGeometryIssueV1[]) {
    super(
      `Assisted manual roof geometry is invalid: ${issues
        .map((issue) => `${issue.code}(${issue.entityRefs.join(",")})`)
        .join("; ")}`,
    );
    this.name = "AssistedManualRoofGeometryValidationError";
  }
}

type Point = { xM: number; yM: number };

function uniqueSorted(values: string[]) {
  return uniqueCanonicalStringsV1(values);
}

function canonicalRing(vertexIds: string[]) {
  const rotations = (values: string[]) =>
    values.map((_, index) => [...values.slice(index), ...values.slice(0, index)]);
  return [...rotations(vertexIds), ...rotations([...vertexIds].reverse())].sort(
    (left, right) => compareCanonicalStringsV1(left.join("\u0000"), right.join("\u0000")),
  )[0];
}

function canonicalPointRing(points: Point[]) {
  const rotations = (values: Point[]) =>
    values.map((_, index) => [...values.slice(index), ...values.slice(0, index)]);
  return [...rotations(points), ...rotations([...points].reverse())].sort((left, right) =>
    compareCanonicalStringsV1(
      left.map((point) => `${point.xM}\u0000${point.yM}`).join("\u0001"),
      right.map((point) => `${point.xM}\u0000${point.yM}`).join("\u0001"),
    ),
  )[0];
}

function cross(from: Point, to: Point, point: Point) {
  return (to.xM - from.xM) * (point.yM - from.yM) - (to.yM - from.yM) * (point.xM - from.xM);
}

function onSegment(point: Point, from: Point, to: Point) {
  return (
    Math.abs(cross(from, to, point)) <= 1e-8 &&
    point.xM >= Math.min(from.xM, to.xM) - 1e-8 &&
    point.xM <= Math.max(from.xM, to.xM) + 1e-8 &&
    point.yM >= Math.min(from.yM, to.yM) - 1e-8 &&
    point.yM <= Math.max(from.yM, to.yM) + 1e-8
  );
}

function segmentsIntersect(firstFrom: Point, firstTo: Point, secondFrom: Point, secondTo: Point) {
  const firstSide = cross(firstFrom, firstTo, secondFrom);
  const secondSide = cross(firstFrom, firstTo, secondTo);
  const thirdSide = cross(secondFrom, secondTo, firstFrom);
  const fourthSide = cross(secondFrom, secondTo, firstTo);
  if (
    ((firstSide > 0 && secondSide < 0) || (firstSide < 0 && secondSide > 0)) &&
    ((thirdSide > 0 && fourthSide < 0) || (thirdSide < 0 && fourthSide > 0))
  )
    return true;
  return (
    onSegment(secondFrom, firstFrom, firstTo) ||
    onSegment(secondTo, firstFrom, firstTo) ||
    onSegment(firstFrom, secondFrom, secondTo) ||
    onSegment(firstTo, secondFrom, secondTo)
  );
}

function polygonArea(points: Point[]) {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.xM * next.yM - next.xM * point.yM;
    }, 0) / 2,
  );
}

function pointInOrOnPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (onSegment(point, previousPoint, currentPoint)) return true;
    if (
      currentPoint.yM > point.yM !== previousPoint.yM > point.yM &&
      point.xM <
        ((previousPoint.xM - currentPoint.xM) * (point.yM - currentPoint.yM)) /
          (previousPoint.yM - currentPoint.yM) +
          currentPoint.xM
    )
      inside = !inside;
  }
  return inside;
}

function pointOnPolygonBoundary(point: Point, polygon: Point[]) {
  return polygon.some((from, index) => onSegment(point, from, polygon[(index + 1) % polygon.length]));
}

function issue(code: AssistedManualRoofGeometryIssueCodeV1, ...entityRefs: string[]) {
  return { code, entityRefs: uniqueSorted(entityRefs) };
}

function sortIssues(issues: AssistedManualRoofGeometryIssueV1[]) {
  return issues.sort((left, right) => {
    const byCode = compareCanonicalStringsV1(left.code, right.code);
    return byCode || compareCanonicalStringsV1(left.entityRefs.join("\u0000"), right.entityRefs.join("\u0000"));
  });
}

function nonFinitePointIssues(value: unknown, property: "vertices" | "points", prefix: string) {
  if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>)[property])) return [];
  return ((value as Record<string, unknown>)[property] as unknown[]).flatMap((vertex, index) => {
    if (!vertex || typeof vertex !== "object") return [];
    const candidate = vertex as { vertexId?: unknown; xM?: unknown; yM?: unknown };
    return [candidate.xM, candidate.yM].some((coordinate) => typeof coordinate === "number" && !Number.isFinite(coordinate))
      ? [issue("NON_FINITE_COORDINATE", typeof candidate.vertexId === "string" ? candidate.vertexId : `${prefix}/${index}`)]
      : [];
  });
}

function nonFiniteVertexIssues(value: unknown) {
  const sourceFootprint = value && typeof value === "object" ? (value as { sourceFootprint?: unknown }).sourceFootprint : undefined;
  return [
    ...nonFinitePointIssues(value, "vertices", "vertices"),
    ...nonFinitePointIssues(sourceFootprint, "points", "sourceFootprint/points"),
  ];
}

function ringIssues(entityId: string, vertexIds: string[], vertices: Map<string, Point>) {
  const issues: AssistedManualRoofGeometryIssueV1[] = [];
  const missing = uniqueSorted(vertexIds.filter((vertexId) => !vertices.has(vertexId)));
  if (missing.length) issues.push(issue("UNKNOWN_VERTEX", entityId, ...missing));
  if (new Set(vertexIds).size !== vertexIds.length) issues.push(issue("DUPLICATE_RING_VERTEX", entityId));
  if (missing.length || new Set(vertexIds).size !== vertexIds.length) return issues;
  const points = vertexIds.map((vertexId) => vertices.get(vertexId)!);
  if (polygonArea(points) <= 1e-8) issues.push(issue("DEGENERATE_POLYGON", entityId));
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === second || firstNext === second || secondNext === first || (first === 0 && secondNext === 0)) continue;
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) {
        issues.push(issue("SELF_INTERSECTING_POLYGON", entityId));
        return issues;
      }
    }
  }
  return issues;
}

function polygonIssues(entityId: string, points: Point[]) {
  if (polygonArea(points) <= 1e-8) return [issue("DEGENERATE_POLYGON", entityId)];
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === second || firstNext === second || secondNext === first || (first === 0 && secondNext === 0)) continue;
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) return [issue("SELF_INTERSECTING_POLYGON", entityId)];
    }
  }
  return [];
}

/** Returns stable machine-readable issues; callers must reject any non-empty result. */
export function validateAssistedManualRoofGeometryV1(value: unknown): AssistedManualRoofGeometryIssueV1[] {
  const finiteIssues = nonFiniteVertexIssues(value);
  const parsed = assistedManualRoofGeometryV1Schema.safeParse(canonicalizeJsonValueV1(value));
  if (!parsed.success) return sortIssues([...finiteIssues, issue("SCHEMA_INVALID")]);
  const input = parsed.data;
  const allIds = [
    ...input.vertices.map((item) => item.vertexId),
    input.sourceFootprint.footprintId,
    ...input.roofMasses.flatMap((item) => [item.massId, item.outlineId]),
    ...input.skeletonEdges.map((item) => item.edgeId),
    ...input.openings.map((item) => item.openingId),
    ...input.obstacles.map((item) => item.obstacleId),
  ];
  const seen = new Set<string>();
  const duplicates = uniqueSorted(allIds.filter((id) => (seen.has(id) ? true : !seen.add(id))));
  const issues: AssistedManualRoofGeometryIssueV1[] = [...finiteIssues];
  if (duplicates.length) issues.push(issue("DUPLICATE_ID", ...duplicates));
  const vertices = new Map(input.vertices.map((vertex) => [vertex.vertexId, vertex]));
  issues.push(...polygonIssues(input.sourceFootprint.footprintId, input.sourceFootprint.points));
  for (const mass of input.roofMasses) issues.push(...ringIssues(mass.massId, mass.vertexIds, vertices));
  for (const opening of input.openings) issues.push(...ringIssues(opening.openingId, opening.vertexIds, vertices));
  for (const obstacle of input.obstacles) issues.push(...ringIssues(obstacle.obstacleId, obstacle.vertexIds, vertices));

  const masses = new Map(input.roofMasses.map((mass) => [mass.massId, mass]));
  const massPoints = (massId: string) => masses.get(massId)?.vertexIds.map((vertexId) => vertices.get(vertexId)!).filter(Boolean);
  const verifyFeature = (entityId: string, massId: string, vertexIds: string[]) => {
    const polygon = massPoints(massId);
    if (!polygon) {
      issues.push(issue("UNKNOWN_ROOF_MASS", entityId, massId));
      return;
    }
    if (vertexIds.every((vertexId) => vertices.has(vertexId)) && vertexIds.some((vertexId) => !pointInOrOnPolygon(vertices.get(vertexId)!, polygon))) {
      issues.push(issue("FEATURE_OUTSIDE_MASS", entityId, massId));
    }
  };
  for (const opening of input.openings) verifyFeature(opening.openingId, opening.roofMassId, opening.vertexIds);
  for (const obstacle of input.obstacles) verifyFeature(obstacle.obstacleId, obstacle.roofMassId, obstacle.vertexIds);
  for (const edge of input.skeletonEdges) {
    const polygon = massPoints(edge.roofMassId);
    const from = vertices.get(edge.fromVertexId);
    const to = vertices.get(edge.toVertexId);
    if (!polygon) {
      issues.push(issue("UNKNOWN_ROOF_MASS", edge.edgeId, edge.roofMassId));
      continue;
    }
    if (!from || !to) {
      issues.push(issue("UNKNOWN_VERTEX", edge.edgeId, ...[edge.fromVertexId, edge.toVertexId].filter((vertexId) => !vertices.has(vertexId))));
      continue;
    }
    if (Math.hypot(from.xM - to.xM, from.yM - to.yM) <= 1e-8) issues.push(issue("SKELETON_ZERO_LENGTH", edge.edgeId));
    if (!pointInOrOnPolygon(from, polygon) || !pointInOrOnPolygon(to, polygon)) issues.push(issue("SKELETON_ENDPOINT_OUTSIDE_MASS", edge.edgeId, edge.roofMassId));
    if (edge.type === "eave" && (!pointOnPolygonBoundary(from, polygon) || !pointOnPolygonBoundary(to, polygon))) issues.push(issue("EAVE_ENDPOINT_NOT_ON_MASS_BOUNDARY", edge.edgeId, edge.roofMassId));
  }
  return sortIssues(issues);
}

/** Throws instead of producing partial topology: a calculation may only consume validated input. */
export function assertAssistedManualRoofGeometryV1(value: unknown): AssistedManualRoofGeometryV1 {
  const issues = validateAssistedManualRoofGeometryV1(value);
  if (issues.length) throw new AssistedManualRoofGeometryValidationError(issues);
  return assistedManualRoofGeometryV1Schema.parse(canonicalizeJsonValueV1(value));
}

/** Stable representation handed from the workbench to plane fitting / area calculation. */
export function canonicalAssistedManualRoofGeometryV1(value: AssistedManualRoofGeometryV1): AssistedManualRoofGeometryV1 {
  const input = assertAssistedManualRoofGeometryV1(value);
  const result = structuredClone(input);
  result.vertices.sort((left, right) => compareCanonicalStringsV1(left.vertexId, right.vertexId));
  result.sourceFootprint.points = canonicalPointRing(result.sourceFootprint.points);
  result.roofMasses = result.roofMasses
    .map((mass) => ({ ...mass, vertexIds: canonicalRing(mass.vertexIds) }))
    .sort((left, right) => compareCanonicalStringsV1(left.massId, right.massId));
  result.skeletonEdges = result.skeletonEdges
    .map((edge) => {
      const [fromVertexId, toVertexId] = [edge.fromVertexId, edge.toVertexId].sort(compareCanonicalStringsV1);
      return { ...edge, fromVertexId, toVertexId };
    })
    .sort((left, right) => compareCanonicalStringsV1(left.edgeId, right.edgeId));
  result.openings = result.openings
    .map((opening) => ({ ...opening, vertexIds: canonicalRing(opening.vertexIds) }))
    .sort((left, right) => compareCanonicalStringsV1(left.openingId, right.openingId));
  result.obstacles = result.obstacles
    .map((obstacle) => ({ ...obstacle, vertexIds: canonicalRing(obstacle.vertexIds) }))
    .sort((left, right) => compareCanonicalStringsV1(left.obstacleId, right.obstacleId));
  return result;
}

export type AssistedManualRoofGeometryCalculationReadyV1 = {
  schemaVersion: typeof ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION;
  geometryHash: string;
  geometry: AssistedManualRoofGeometryV1;
};

/**
 * This is the deterministic 2D constraint payload for the existing height
 * segmentation pipeline. It preserves typed manual/automatic skeleton edges;
 * fitting must add 3D surface vertices before calling geometry-calculation.v1.
 */
export function prepareAssistedManualRoofGeometryForCalculationV1(
  value: AssistedManualRoofGeometryV1,
): AssistedManualRoofGeometryCalculationReadyV1 {
  const geometry = canonicalAssistedManualRoofGeometryV1(value);
  return {
    schemaVersion: ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
    geometryHash: canonicalSha256V1(geometry, "takfornyelse:assisted-manual-roof-geometry:v1"),
    geometry,
  };
}
