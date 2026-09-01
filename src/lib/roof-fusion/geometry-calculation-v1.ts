import { z } from "zod";
import {
  canonicalSha256V1,
  canonicalizeJsonValueV1,
  compareCanonicalStringsV1,
  uniqueCanonicalStringsV1,
} from "./canonicalization-v1";
import {
  canonicalRoofGeometryV1,
  roofSnapshotV1SeedSchema,
  type RoofConfidenceV1,
  type RoofMeasurementValueV1,
} from "./roof-snapshot-v1";
import {
  buildRoofSourceResultV1,
  roofSourceInputHashV1,
  roofSourceNormalizedHashV1,
  roofSourceRequestV1Schema,
  type RoofSourceRequestV1,
  type RoofSourceResultV1,
} from "./source-adapter-v1";

export const ROOF_GEOMETRY_INPUT_SCHEMA_VERSION =
  "roof-geometry-input.v1" as const;
export const ROOF_GEOMETRY_CALCULATION_SCHEMA_VERSION =
  "roof-geometry-calculation.v1" as const;
export const ROOF_GEOMETRY_CALCULATOR_VERSION =
  "roof-geometry-calculator.v1.0.0" as const;
export const ROOF_GEOMETRY_SOURCE_ADAPTER_ID =
  "deterministic-roof-geometry" as const;
export const ROOF_GEOMETRY_SOURCE_ADAPTER_VERSION =
  "deterministic-roof-geometry.v1.0.0" as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);

const geometryShape = roofSnapshotV1SeedSchema.shape.geometry.shape;

const geometrySurfaceInputSchema = z
  .object({
    surfaceId: identifier,
    contourId: identifier,
    vertexIds: z.array(identifier).min(3).max(500),
    edgeIds: z.array(identifier).min(3).max(500),
    quality: geometryShape.surfaces.element.shape.quality,
    sourceRefs: z.array(identifier).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.vertexIds.length !== value.edgeIds.length) {
      context.addIssue({
        code: "custom",
        message: "A surface needs one stable edge ID per boundary segment",
        path: ["edgeIds"],
      });
    }
  });

const geometryOpeningInputSchema = z
  .object({
    openingId: identifier,
    surfaceId: identifier,
    contourId: identifier,
    vertexIds: z.array(identifier).min(3).max(500),
    kind: geometryShape.openings.element.shape.kind,
    quality: geometryShape.openings.element.shape.quality,
    sourceRefs: z.array(identifier).min(1).max(100),
  })
  .strict();

const geometryObstacleInputSchema = z
  .object({
    obstacleId: identifier,
    surfaceId: identifier.optional(),
    contourId: identifier.optional(),
    vertexIds: z.array(identifier).min(3).max(500).optional(),
    kind: geometryShape.obstacles.element.shape.kind,
    height: geometryShape.obstacles.element.shape.height,
    quality: geometryShape.obstacles.element.shape.quality,
    sourceRefs: z.array(identifier).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.contourId) !== Boolean(value.vertexIds)) {
      context.addIssue({
        code: "custom",
        message: "Obstacle contourId and vertexIds must be supplied together",
      });
    }
  });

export const roofGeometryInputV1Schema = z
  .object({
    schemaVersion: z.literal(ROOF_GEOMETRY_INPUT_SCHEMA_VERSION),
    calculationId: identifier,
    coordinateSystem: roofSnapshotV1SeedSchema.shape.coordinateSystem,
    vertices: geometryShape.vertices.element
      .extend({ zM: z.number().finite() })
      .array()
      .min(3)
      .max(10_000),
    surfaces: z.array(geometrySurfaceInputSchema).min(1).max(1_000),
    openings: z.array(geometryOpeningInputSchema).max(2_000),
    obstacles: z.array(geometryObstacleInputSchema).max(2_000),
    provenance: roofSnapshotV1SeedSchema.shape.provenance,
    measurement: roofSnapshotV1SeedSchema.shape.measurement,
  })
  .strict();

export type RoofGeometryInputV1 = z.infer<typeof roofGeometryInputV1Schema>;
type GeometryVertexV1 = RoofGeometryInputV1["vertices"][number];
type GeometrySurfaceInputV1 = RoofGeometryInputV1["surfaces"][number];
type NormalizedRoofSourceV1 = NonNullable<RoofSourceResultV1["normalized"]>;

export type RoofGeometryCalculationV1 = {
  schemaVersion: typeof ROOF_GEOMETRY_CALCULATION_SCHEMA_VERSION;
  calculatorVersion: typeof ROOF_GEOMETRY_CALCULATOR_VERSION;
  calculationId: string;
  inputHash: string;
  normalizedContentHash: string;
  calculationHash: string;
  normalized: NormalizedRoofSourceV1;
  trace: {
    assumptions: string[];
    surfaces: Array<{
      surfaceId: string;
      horizontalAreaM2: number;
      surfaceAreaM2: number;
      openingAreaM2: number;
      netSurfaceAreaM2: number;
      pitchDegrees: number;
      azimuthDegrees: number | null;
    }>;
    edges: Array<{
      edgeId: string;
      classification: NormalizedRoofSourceV1["geometry"]["edges"][number]["type"];
      length2dM: number;
      length3dM: number;
      adjacentSurfaceIds: string[];
    }>;
  };
};

export class RoofGeometryCalculationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly entityRefs: string[] = [],
  ) {
    super(message);
    this.name = "RoofGeometryCalculationError";
  }
}

function digest(domain: string, value: unknown) {
  return canonicalSha256V1(value, domain);
}

function round(value: number, decimals = 9) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function uniqueSorted(values: string[]) {
  return uniqueCanonicalStringsV1(values);
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  return uniqueSorted(
    values.filter((value) => (seen.has(value) ? true : !seen.add(value))),
  );
}

function canonicalInput(input: RoofGeometryInputV1) {
  const value = structuredClone(input);
  value.vertices.sort((left, right) =>
    compareCanonicalStringsV1(left.vertexId, right.vertexId),
  );
  value.surfaces.sort((left, right) =>
    compareCanonicalStringsV1(left.surfaceId, right.surfaceId),
  );
  value.openings.sort((left, right) =>
    compareCanonicalStringsV1(left.openingId, right.openingId),
  );
  value.obstacles.sort((left, right) =>
    compareCanonicalStringsV1(left.obstacleId, right.obstacleId),
  );
  value.provenance.sources.sort((left, right) =>
    compareCanonicalStringsV1(left.sourceId, right.sourceId),
  );
  value.provenance.observations.sort((left, right) =>
    compareCanonicalStringsV1(left.observationId, right.observationId),
  );
  value.provenance.fusionDecision.acceptedObservationIds = uniqueSorted(
    value.provenance.fusionDecision.acceptedObservationIds,
  );
  value.provenance.fusionDecision.rejectedObservationIds = uniqueSorted(
    value.provenance.fusionDecision.rejectedObservationIds,
  );
  value.provenance.fusionDecision.conflictedObservationIds = uniqueSorted(
    value.provenance.fusionDecision.conflictedObservationIds,
  );
  return value;
}

export function roofGeometryInputHashV1(input: RoofGeometryInputV1) {
  return digest("takfornyelse:roof-geometry-input:v1", canonicalInput(input));
}

function geometryCalculationHashV1(
  calculation: Omit<
    RoofGeometryCalculationV1,
    "calculationHash" | "normalized"
  >,
) {
  return digest("takfornyelse:roof-geometry-calculation:v1", calculation);
}

type Vector3 = { x: number; y: number; z: number };

function subtract(left: GeometryVertexV1, right: GeometryVertexV1): Vector3 {
  return {
    x: left.xM - right.xM,
    y: left.yM - right.yM,
    z: left.zM - right.zM,
  };
}

function dot(left: Vector3, right: Vector3) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function magnitude(vector: Vector3) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function polygonVectorArea(points: GeometryVertexV1[]): Vector3 {
  return points.reduce(
    (sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return {
        x: sum.x + (point.yM - next.yM) * (point.zM + next.zM),
        y: sum.y + (point.zM - next.zM) * (point.xM + next.xM),
        z: sum.z + (point.xM - next.xM) * (point.yM + next.yM),
      };
    },
    { x: 0, y: 0, z: 0 },
  );
}

function polygonHorizontalArea(points: GeometryVertexV1[]) {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.xM * next.yM - next.xM * point.yM;
      }, 0),
    ) / 2
  );
}

function cross2d(
  first: GeometryVertexV1,
  second: GeometryVertexV1,
  third: GeometryVertexV1,
) {
  return (
    (second.xM - first.xM) * (third.yM - first.yM) -
    (second.yM - first.yM) * (third.xM - first.xM)
  );
}

function pointOnSegment(
  point: GeometryVertexV1,
  from: GeometryVertexV1,
  to: GeometryVertexV1,
) {
  const tolerance = 1e-9;
  return (
    Math.abs(cross2d(from, to, point)) <= tolerance &&
    point.xM >= Math.min(from.xM, to.xM) - tolerance &&
    point.xM <= Math.max(from.xM, to.xM) + tolerance &&
    point.yM >= Math.min(from.yM, to.yM) - tolerance &&
    point.yM <= Math.max(from.yM, to.yM) + tolerance
  );
}

function segmentsIntersect2d(
  firstFrom: GeometryVertexV1,
  firstTo: GeometryVertexV1,
  secondFrom: GeometryVertexV1,
  secondTo: GeometryVertexV1,
) {
  const firstSide = cross2d(firstFrom, firstTo, secondFrom);
  const secondSide = cross2d(firstFrom, firstTo, secondTo);
  const thirdSide = cross2d(secondFrom, secondTo, firstFrom);
  const fourthSide = cross2d(secondFrom, secondTo, firstTo);
  if (
    ((firstSide > 0 && secondSide < 0) || (firstSide < 0 && secondSide > 0)) &&
    ((thirdSide > 0 && fourthSide < 0) || (thirdSide < 0 && fourthSide > 0))
  )
    return true;
  return (
    pointOnSegment(secondFrom, firstFrom, firstTo) ||
    pointOnSegment(secondTo, firstFrom, firstTo) ||
    pointOnSegment(firstFrom, secondFrom, secondTo) ||
    pointOnSegment(firstTo, secondFrom, secondTo)
  );
}

function assertSimplePlanPolygon(points: GeometryVertexV1[], entityId: string) {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first ||
        (first === 0 && secondNext === 0)
      )
        continue;
      if (
        segmentsIntersect2d(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext],
        )
      ) {
        throw new RoofGeometryCalculationError(
          "SELF_INTERSECTING_FACET",
          `Facet ${entityId} has a self-intersecting plan contour`,
          [entityId],
        );
      }
    }
  }
}

function pointStrictlyInsidePolygon(
  point: GeometryVertexV1,
  polygon: GeometryVertexV1[],
) {
  for (let index = 0; index < polygon.length; index += 1) {
    if (
      pointOnSegment(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length],
      )
    )
      return false;
  }
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.yM > point.yM !== previousPoint.yM > point.yM &&
      point.xM <
        ((previousPoint.xM - currentPoint.xM) * (point.yM - currentPoint.yM)) /
          (previousPoint.yM - currentPoint.yM) +
          currentPoint.xM;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonsOverlap(
  first: GeometryVertexV1[],
  second: GeometryVertexV1[],
) {
  for (let left = 0; left < first.length; left += 1) {
    for (let right = 0; right < second.length; right += 1) {
      if (
        segmentsIntersect2d(
          first[left],
          first[(left + 1) % first.length],
          second[right],
          second[(right + 1) % second.length],
        )
      )
        return true;
    }
  }
  return (
    pointStrictlyInsidePolygon(first[0], second) ||
    pointStrictlyInsidePolygon(second[0], first)
  );
}

function plane(points: GeometryVertexV1[], entityId: string) {
  assertSimplePlanPolygon(points, entityId);
  const areaVector = polygonVectorArea(points);
  const vectorMagnitude = magnitude(areaVector);
  if (vectorMagnitude < 1e-9) {
    throw new RoofGeometryCalculationError(
      "DEGENERATE_FACET",
      `Facet ${entityId} has no measurable 3D area`,
      [entityId],
    );
  }
  const sign = areaVector.z < 0 ? -1 : 1;
  const normal = {
    x: (areaVector.x / vectorMagnitude) * sign,
    y: (areaVector.y / vectorMagnitude) * sign,
    z: (areaVector.z / vectorMagnitude) * sign,
  };
  const tolerance = Math.max(
    0.005,
    ...points.map((point) => point.uncertaintyM * 2),
  );
  const anchor = points[0];
  const outOfPlane = points.filter(
    (point) => Math.abs(dot(subtract(point, anchor), normal)) > tolerance,
  );
  if (outOfPlane.length) {
    throw new RoofGeometryCalculationError(
      "NON_PLANAR_FACET",
      `Facet ${entityId} exceeds its declared vertex uncertainty`,
      [entityId, ...outOfPlane.map((point) => point.vertexId)],
    );
  }
  const horizontalArea = polygonHorizontalArea(points);
  if (horizontalArea < 1e-9) {
    throw new RoofGeometryCalculationError(
      "ZERO_HORIZONTAL_AREA",
      `Facet ${entityId} has no plan-view area`,
      [entityId],
    );
  }
  const surfaceArea = vectorMagnitude / 2;
  const pitchDegrees =
    (Math.atan2(Math.hypot(normal.x, normal.y), normal.z) * 180) / Math.PI;
  const azimuthDegrees =
    pitchDegrees < 1e-9
      ? null
      : ((Math.atan2(normal.x, normal.y) * 180) / Math.PI + 360) % 360;
  return {
    normal,
    horizontalArea: round(horizontalArea),
    surfaceArea: round(surfaceArea),
    pitchDegrees: round(pitchDegrees),
    azimuthDegrees: azimuthDegrees === null ? null : round(azimuthDegrees, 6),
    tolerance,
  };
}

function calculationConfidence(
  vertices: GeometryVertexV1[],
  rationale: string,
): RoofConfidenceV1 {
  const maximumUncertainty = Math.max(
    ...vertices.map((vertex) => vertex.uncertaintyM),
  );
  const score = round(Math.max(0.5, 1 - maximumUncertainty / 2), 6);
  return {
    level: score >= 0.9 ? "high" : score >= 0.7 ? "medium" : "low",
    score,
    basis: "derived",
    rationale,
  };
}

function exactMeasurement(
  unit: RoofMeasurementValueV1["unit"],
  value: number,
  sourceRefs: string[],
  confidence: RoofConfidenceV1,
): RoofMeasurementValueV1 {
  return {
    mode: "exact",
    unit,
    min: round(value),
    max: round(value),
    sourceRefs: uniqueSorted(sourceRefs),
    confidence,
  };
}

function verticesFor(
  ids: string[],
  vertices: Map<string, GeometryVertexV1>,
  entityId: string,
) {
  const missing = ids.filter((id) => !vertices.has(id));
  if (missing.length) {
    throw new RoofGeometryCalculationError(
      "VERTEX_REFERENCE_MISSING",
      `${entityId} references missing vertices`,
      [entityId, ...missing],
    );
  }
  if (new Set(ids).size !== ids.length) {
    throw new RoofGeometryCalculationError(
      "VERTEX_REFERENCE_DUPLICATED",
      `${entityId} repeats a boundary vertex`,
      [entityId],
    );
  }
  return ids.map((id) => vertices.get(id)!);
}

type WorkingSurface = {
  input: GeometrySurfaceInputV1;
  points: GeometryVertexV1[];
  plane: ReturnType<typeof plane>;
};

type WorkingEdge = {
  edgeId: string;
  fromVertexId: string;
  toVertexId: string;
  adjacentSurfaceIds: string[];
  sourceRefs: string[];
};

function classifyEdge(
  edge: WorkingEdge,
  surfaces: Map<string, WorkingSurface>,
  vertices: Map<string, GeometryVertexV1>,
) {
  const from = vertices.get(edge.fromVertexId)!;
  const to = vertices.get(edge.toVertexId)!;
  const edgeMeanZ = (from.zM + to.zM) / 2;
  const edgeSlope = Math.abs(from.zM - to.zM);
  const tolerance = Math.max(0.01, from.uncertaintyM + to.uncertaintyM);
  const deltas = edge.adjacentSurfaceIds.map((surfaceId) => {
    const surface = surfaces.get(surfaceId)!;
    const other = surface.points.filter(
      (point) =>
        point.vertexId !== edge.fromVertexId &&
        point.vertexId !== edge.toVertexId,
    );
    const otherMeanZ =
      other.reduce((sum, point) => sum + point.zM, 0) / other.length;
    return edgeMeanZ - otherMeanZ;
  });

  if (deltas.length === 1) {
    return edgeSlope <= tolerance && deltas[0] < -tolerance
      ? ("eave" as const)
      : ("rake" as const);
  }
  if (deltas.every((delta) => delta > tolerance))
    return edgeSlope <= tolerance ? ("ridge" as const) : ("hip" as const);
  if (deltas.every((delta) => delta < -tolerance)) return "valley" as const;
  return "unknown" as const;
}

function assertUniqueInputIds(input: RoofGeometryInputV1) {
  const duplicateIds = duplicates([
    ...input.vertices.map((vertex) => vertex.vertexId),
    ...input.surfaces.map((surface) => surface.surfaceId),
    ...input.surfaces.map((surface) => surface.contourId),
    ...input.openings.map((opening) => opening.openingId),
    ...input.openings.map((opening) => opening.contourId),
    ...input.obstacles.map((obstacle) => obstacle.obstacleId),
    ...input.obstacles.flatMap((obstacle) =>
      obstacle.contourId ? [obstacle.contourId] : [],
    ),
  ]);
  if (duplicateIds.length) {
    throw new RoofGeometryCalculationError(
      "DUPLICATE_ENTITY_ID",
      `Geometry input contains duplicate entity IDs: ${duplicateIds.join(",")}`,
      duplicateIds,
    );
  }
}

export function calculateRoofGeometryV1(
  inputValue: RoofGeometryInputV1,
): RoofGeometryCalculationV1 {
  const input = roofGeometryInputV1Schema.parse(
    canonicalizeJsonValueV1(inputValue),
  );
  if (!["preliminary", "fused_estimate"].includes(input.measurement.class)) {
    throw new RoofGeometryCalculationError(
      "MEASUREMENT_CLASS_NOT_CALCULABLE",
      "Deterministic calculation cannot promote a measurement into a verified class",
    );
  }
  assertUniqueInputIds(input);
  const sourceIds = new Set(
    input.provenance.sources.map((source) => source.sourceId),
  );
  const allSourceRefs = [
    ...input.vertices.flatMap((vertex) => vertex.sourceRefs),
    ...input.surfaces.flatMap((surface) => surface.sourceRefs),
    ...input.openings.flatMap((opening) => opening.sourceRefs),
    ...input.obstacles.flatMap((obstacle) => obstacle.sourceRefs),
  ];
  const missingSourceRefs = uniqueSorted(
    allSourceRefs.filter((sourceRef) => !sourceIds.has(sourceRef)),
  );
  if (missingSourceRefs.length) {
    throw new RoofGeometryCalculationError(
      "SOURCE_REFERENCE_MISSING",
      "Geometry input references undeclared evidence sources",
      missingSourceRefs,
    );
  }

  const vertices = new Map(
    input.vertices.map((vertex) => [vertex.vertexId, vertex]),
  );
  const workingSurfaces = new Map<string, WorkingSurface>();
  for (const surface of input.surfaces) {
    const points = verticesFor(surface.vertexIds, vertices, surface.surfaceId);
    workingSurfaces.set(surface.surfaceId, {
      input: surface,
      points,
      plane: plane(points, surface.surfaceId),
    });
  }

  const workingEdges = new Map<string, WorkingEdge>();
  const physicalEdges = new Map<string, string>();
  for (const surface of input.surfaces) {
    surface.vertexIds.forEach((fromVertexId, index) => {
      const toVertexId =
        surface.vertexIds[(index + 1) % surface.vertexIds.length];
      const edgeId = surface.edgeIds[index];
      const physicalKey = [fromVertexId, toVertexId]
        .sort(compareCanonicalStringsV1)
        .join("|");
      const existingPhysicalId = physicalEdges.get(physicalKey);
      if (existingPhysicalId && existingPhysicalId !== edgeId) {
        throw new RoofGeometryCalculationError(
          "PHYSICAL_EDGE_ID_CONFLICT",
          `One physical edge has multiple IDs`,
          [existingPhysicalId, edgeId],
        );
      }
      physicalEdges.set(physicalKey, edgeId);
      const existing = workingEdges.get(edgeId);
      if (
        existing &&
        [existing.fromVertexId, existing.toVertexId]
          .sort(compareCanonicalStringsV1)
          .join("|") !== physicalKey
      ) {
        throw new RoofGeometryCalculationError(
          "EDGE_ID_GEOMETRY_CONFLICT",
          `Edge ${edgeId} refers to different vertex pairs`,
          [edgeId],
        );
      }
      if (existing) {
        existing.adjacentSurfaceIds.push(surface.surfaceId);
        existing.sourceRefs.push(...surface.sourceRefs);
      } else {
        workingEdges.set(edgeId, {
          edgeId,
          fromVertexId,
          toVertexId,
          adjacentSurfaceIds: [surface.surfaceId],
          sourceRefs: [...surface.sourceRefs],
        });
      }
    });
  }
  const overShared = [...workingEdges.values()].filter(
    (edge) => edge.adjacentSurfaceIds.length > 2,
  );
  if (overShared.length) {
    throw new RoofGeometryCalculationError(
      "NON_MANIFOLD_EDGE",
      "A roof edge cannot be shared by more than two surfaces",
      overShared.map((edge) => edge.edgeId),
    );
  }

  const surfaceIds = new Set(
    input.surfaces.map((surface) => surface.surfaceId),
  );
  const openingPolygonsBySurface = new Map<
    string,
    Array<{ openingId: string; points: GeometryVertexV1[] }>
  >();
  const calculatedOpenings = input.openings.map((opening) => {
    if (!surfaceIds.has(opening.surfaceId)) {
      throw new RoofGeometryCalculationError(
        "OPENING_SURFACE_MISSING",
        `Opening ${opening.openingId} references a missing surface`,
        [opening.openingId, opening.surfaceId],
      );
    }
    const points = verticesFor(opening.vertexIds, vertices, opening.openingId);
    const openingPlane = plane(points, opening.openingId);
    const workingSurface = workingSurfaces.get(opening.surfaceId)!;
    const surfacePlane = workingSurface.plane;
    if (Math.abs(dot(openingPlane.normal, surfacePlane.normal)) < 0.999) {
      throw new RoofGeometryCalculationError(
        "OPENING_NOT_COPLANAR",
        `Opening ${opening.openingId} is not aligned to its roof surface`,
        [opening.openingId, opening.surfaceId],
      );
    }
    const surfaceAnchor = workingSurface.points[0];
    if (
      points.some(
        (point) =>
          Math.abs(dot(subtract(point, surfaceAnchor), surfacePlane.normal)) >
          Math.max(surfacePlane.tolerance, point.uncertaintyM * 2),
      )
    ) {
      throw new RoofGeometryCalculationError(
        "OPENING_NOT_ON_SURFACE",
        `Opening ${opening.openingId} is offset from its roof surface`,
        [opening.openingId, opening.surfaceId],
      );
    }
    if (
      points.some(
        (point) => !pointStrictlyInsidePolygon(point, workingSurface.points),
      )
    ) {
      throw new RoofGeometryCalculationError(
        "OPENING_OUTSIDE_SURFACE",
        `Opening ${opening.openingId} is not strictly inside its roof surface`,
        [opening.openingId, opening.surfaceId],
      );
    }
    const priorOpenings = openingPolygonsBySurface.get(opening.surfaceId) ?? [];
    const overlap = priorOpenings.find((prior) =>
      polygonsOverlap(points, prior.points),
    );
    if (overlap) {
      throw new RoofGeometryCalculationError(
        "OPENING_OVERLAP",
        `Opening ${opening.openingId} overlaps another roof opening`,
        [opening.openingId, overlap.openingId],
      );
    }
    openingPolygonsBySurface.set(opening.surfaceId, [
      ...priorOpenings,
      { openingId: opening.openingId, points },
    ]);
    const confidence = calculationConfidence(
      points,
      "Deterministic opening area from explicit coplanar 3D vertices",
    );
    return {
      openingId: opening.openingId,
      surfaceId: opening.surfaceId,
      contourId: opening.contourId,
      kind: opening.kind,
      horizontalArea: exactMeasurement(
        "m2",
        openingPlane.horizontalArea,
        opening.sourceRefs,
        confidence,
      ),
      surfaceArea: exactMeasurement(
        "m2",
        openingPlane.surfaceArea,
        opening.sourceRefs,
        confidence,
      ),
      quality: opening.quality,
      sourceRefs: uniqueSorted(opening.sourceRefs),
    };
  });

  const calculatedSurfaces = input.surfaces.map((surface) => {
    const working = workingSurfaces.get(surface.surfaceId)!;
    const openings = calculatedOpenings.filter(
      (opening) => opening.surfaceId === surface.surfaceId,
    );
    const openingArea = round(
      openings.reduce(
        (sum, opening) => sum + (opening.surfaceArea.min ?? 0),
        0,
      ),
    );
    if (openingArea > working.plane.surfaceArea + working.plane.tolerance) {
      throw new RoofGeometryCalculationError(
        "OPENING_AREA_EXCEEDS_SURFACE",
        `Openings exceed surface ${surface.surfaceId}`,
        [surface.surfaceId, ...openings.map((opening) => opening.openingId)],
      );
    }
    const confidence = calculationConfidence(
      working.points,
      "Deterministic planar calculation from explicit calibrated 3D vertices",
    );
    return {
      surfaceId: surface.surfaceId,
      outerContourId: surface.contourId,
      openingIds: openings
        .map((opening) => opening.openingId)
        .sort(compareCanonicalStringsV1),
      edgeIds: [...surface.edgeIds].sort(compareCanonicalStringsV1),
      normal: [
        round(working.plane.normal.x),
        round(working.plane.normal.y),
        round(working.plane.normal.z),
      ] as [number, number, number],
      azimuthDegrees: working.plane.azimuthDegrees,
      pitch: exactMeasurement(
        "deg",
        working.plane.pitchDegrees,
        surface.sourceRefs,
        confidence,
      ),
      grossHorizontalArea: exactMeasurement(
        "m2",
        working.plane.horizontalArea,
        surface.sourceRefs,
        confidence,
      ),
      grossSurfaceArea: exactMeasurement(
        "m2",
        working.plane.surfaceArea,
        surface.sourceRefs,
        confidence,
      ),
      netSurfaceArea: exactMeasurement(
        "m2",
        Math.max(0, working.plane.surfaceArea - openingArea),
        uniqueSorted([
          ...surface.sourceRefs,
          ...openings.flatMap((opening) => opening.sourceRefs),
        ]),
        confidence,
      ),
      quality: surface.quality,
      sourceRefs: uniqueSorted(surface.sourceRefs),
    };
  });

  const calculatedEdges = [...workingEdges.values()].map((edge) => {
    const from = vertices.get(edge.fromVertexId)!;
    const to = vertices.get(edge.toVertexId)!;
    const classification = classifyEdge(edge, workingSurfaces, vertices);
    const sourceRefs = uniqueSorted([
      ...edge.sourceRefs,
      ...from.sourceRefs,
      ...to.sourceRefs,
    ]);
    const confidence = calculationConfidence(
      [from, to],
      "Deterministic edge length and topology classification from 3D vertices",
    );
    return {
      edgeId: edge.edgeId,
      fromVertexId: edge.fromVertexId,
      toVertexId: edge.toVertexId,
      adjacentSurfaceIds: uniqueSorted(edge.adjacentSurfaceIds),
      type: classification,
      length2d: exactMeasurement(
        "m",
        Math.hypot(to.xM - from.xM, to.yM - from.yM),
        sourceRefs,
        confidence,
      ),
      length3d: exactMeasurement(
        "m",
        Math.hypot(to.xM - from.xM, to.yM - from.yM, to.zM - from.zM),
        sourceRefs,
        confidence,
      ),
      gutterCandidate: classification === "eave",
      quality: "estimated" as const,
      sourceRefs,
    };
  });

  const contours = [
    ...input.surfaces.map((surface) => ({
      contourId: surface.contourId,
      kind: "surface_boundary" as const,
      vertexIds: surface.vertexIds,
      sourceRefs: uniqueSorted(surface.sourceRefs),
    })),
    ...input.openings.map((opening) => ({
      contourId: opening.contourId,
      kind: "opening_boundary" as const,
      vertexIds: opening.vertexIds,
      sourceRefs: uniqueSorted(opening.sourceRefs),
    })),
    ...input.obstacles.flatMap((obstacle) =>
      obstacle.contourId && obstacle.vertexIds
        ? [
            {
              contourId: obstacle.contourId,
              kind: "obstacle_boundary" as const,
              vertexIds: obstacle.vertexIds,
              sourceRefs: uniqueSorted(obstacle.sourceRefs),
            },
          ]
        : [],
    ),
  ];
  const normalized: NormalizedRoofSourceV1 = {
    coordinateSystem: input.coordinateSystem,
    geometry: canonicalRoofGeometryV1({
      vertices: input.vertices,
      contours,
      surfaces: calculatedSurfaces,
      edges: calculatedEdges,
      openings: calculatedOpenings,
      obstacles: input.obstacles.map((obstacle) => ({
        obstacleId: obstacle.obstacleId,
        surfaceId: obstacle.surfaceId,
        contourId: obstacle.contourId,
        kind: obstacle.kind,
        height: obstacle.height,
        quality: obstacle.quality,
        sourceRefs: uniqueSorted(obstacle.sourceRefs),
      })),
    }),
    provenance: structuredClone(input.provenance),
    measurement: structuredClone(input.measurement),
  };
  const inputHash = roofGeometryInputHashV1(input);
  const normalizedContentHash = roofSourceNormalizedHashV1(normalized);
  const surfaceTrace = calculatedSurfaces
    .map((surface) => ({
      surfaceId: surface.surfaceId,
      horizontalAreaM2: surface.grossHorizontalArea.min!,
      surfaceAreaM2: surface.grossSurfaceArea.min!,
      openingAreaM2: round(
        calculatedOpenings
          .filter((opening) => opening.surfaceId === surface.surfaceId)
          .reduce((sum, opening) => sum + (opening.surfaceArea.min ?? 0), 0),
      ),
      netSurfaceAreaM2: surface.netSurfaceArea.min!,
      pitchDegrees: surface.pitch.min!,
      azimuthDegrees: surface.azimuthDegrees,
    }))
    .sort((left, right) =>
      compareCanonicalStringsV1(left.surfaceId, right.surfaceId),
    );
  const edgeTrace = calculatedEdges
    .map((edge) => ({
      edgeId: edge.edgeId,
      classification: edge.type,
      length2dM: edge.length2d.min!,
      length3dM: edge.length3d.min!,
      adjacentSurfaceIds: edge.adjacentSurfaceIds,
    }))
    .sort((left, right) =>
      compareCanonicalStringsV1(left.edgeId, right.edgeId),
    );
  const trace = {
    assumptions: [
      "Input vertices are expressed in metres in the declared local or projected coordinate system",
      "Each surface and opening is planar within twice its declared vertex uncertainty",
      "Eave and shared-edge classifications are geometric candidates, not proof of installed guttering",
    ],
    surfaces: surfaceTrace,
    edges: edgeTrace,
  };
  const calculationHash = geometryCalculationHashV1({
    schemaVersion: ROOF_GEOMETRY_CALCULATION_SCHEMA_VERSION,
    calculatorVersion: ROOF_GEOMETRY_CALCULATOR_VERSION,
    calculationId: input.calculationId,
    inputHash,
    normalizedContentHash,
    trace,
  });
  return {
    schemaVersion: ROOF_GEOMETRY_CALCULATION_SCHEMA_VERSION,
    calculatorVersion: ROOF_GEOMETRY_CALCULATOR_VERSION,
    calculationId: input.calculationId,
    inputHash,
    normalizedContentHash,
    calculationHash,
    normalized,
    trace,
  };
}

export function verifyRoofGeometryCalculationV1(
  calculation: RoofGeometryCalculationV1,
) {
  if (
    calculation.schemaVersion !== ROOF_GEOMETRY_CALCULATION_SCHEMA_VERSION ||
    calculation.calculatorVersion !== ROOF_GEOMETRY_CALCULATOR_VERSION
  ) {
    throw new RoofGeometryCalculationError(
      "UNSUPPORTED_CALCULATION_VERSION",
      "Roof geometry calculation version is not supported",
    );
  }
  const normalizedContentHash = roofSourceNormalizedHashV1(
    calculation.normalized,
  );
  if (normalizedContentHash !== calculation.normalizedContentHash) {
    throw new RoofGeometryCalculationError(
      "NORMALIZED_CONTENT_HASH_MISMATCH",
      "Roof geometry normalized content has changed after calculation",
    );
  }
  const calculationHash = geometryCalculationHashV1({
    schemaVersion: calculation.schemaVersion,
    calculatorVersion: calculation.calculatorVersion,
    calculationId: calculation.calculationId,
    inputHash: calculation.inputHash,
    normalizedContentHash: calculation.normalizedContentHash,
    trace: calculation.trace,
  });
  if (calculationHash !== calculation.calculationHash) {
    throw new RoofGeometryCalculationError(
      "CALCULATION_HASH_MISMATCH",
      "Roof geometry calculation trace has changed",
    );
  }
  return calculation;
}

export function roofGeometryCalculationToSourceResultV1(
  requestInput: RoofSourceRequestV1,
  calculationInput: RoofGeometryCalculationV1,
  receivedAt: string,
) {
  const request = roofSourceRequestV1Schema.parse(
    canonicalizeJsonValueV1(requestInput),
  );
  const calculation = verifyRoofGeometryCalculationV1(calculationInput);
  if (roofSourceInputHashV1(request) !== request.inputHash) {
    throw new RoofGeometryCalculationError(
      "GEOMETRY_REQUEST_HASH_MISMATCH",
      "Roof geometry source request input hash has changed",
    );
  }
  if (
    request.adapterId !== ROOF_GEOMETRY_SOURCE_ADAPTER_ID ||
    request.expectedInputVersion !== ROOF_GEOMETRY_INPUT_SCHEMA_VERSION
  ) {
    throw new RoofGeometryCalculationError(
      "GEOMETRY_REQUEST_CONTRACT_MISMATCH",
      "Roof source request does not target the deterministic geometry adapter",
    );
  }
  const requestInputContract = z
    .object({
      geometryInputHash: z.string().regex(/^[a-f0-9]{64}$/u),
      calculationId: identifier,
    })
    .strict()
    .parse(request.input);
  if (
    requestInputContract.geometryInputHash !== calculation.inputHash ||
    requestInputContract.calculationId !== calculation.calculationId
  ) {
    throw new RoofGeometryCalculationError(
      "GEOMETRY_REQUEST_INPUT_MISMATCH",
      "Roof geometry calculation does not belong to the requested input",
    );
  }
  const unknownEdges = calculation.normalized.geometry.edges.filter(
    (edge) => edge.type === "unknown",
  );
  return buildRoofSourceResultV1({
    schemaVersion: "roof-source-result.v1",
    status: unknownEdges.length ? "partial" : "complete",
    adapterId: ROOF_GEOMETRY_SOURCE_ADAPTER_ID,
    adapterVersion: ROOF_GEOMETRY_SOURCE_ADAPTER_VERSION,
    provider: "Takfornyelse deterministic roof geometry calculator",
    providerInputVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    providerRequestId: calculation.calculationId,
    requestInputHash: request.inputHash,
    idempotencyKey: request.idempotencyKey,
    receivedAt,
    rawContentHash: calculation.inputHash,
    sourceRecords: calculation.normalized.provenance.sources,
    issues: unknownEdges.length
      ? [
          {
            code: "GEOMETRY_EDGE_CLASSIFICATION_UNKNOWN",
            severity: "warning",
            message:
              "One or more geometric edge classifications require human review",
            retryable: false,
          },
        ]
      : [],
    normalized: calculation.normalized,
  });
}
