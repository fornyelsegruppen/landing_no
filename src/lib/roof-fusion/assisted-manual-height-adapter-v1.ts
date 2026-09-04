import { z } from "zod";
import type { NorgeIBilderGeoReference } from "@/lib/providers/norge-i-bilder-capture-provider";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import {
  assertAssistedManualRoofGeometryV1,
  canonicalAssistedManualRoofGeometryV1,
  type AssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";
import {
  canonicalSha256V1,
  canonicalizeJsonValueV1,
} from "./canonicalization-v1";
import {
  calculateRoofGeometryV1,
  roofGeometryInputHashV1,
  type RoofGeometryInputV1,
  ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
} from "./geometry-calculation-v1";
import {
  buildRoofSourceRequestV1,
  buildRoofSourceResultV1,
  roofSourceResultToSnapshotV1,
  type RoofSourceRequestV1,
  type RoofSourceResultV1,
} from "./source-adapter-v1";
import type { RoofSnapshotV1 } from "./roof-snapshot-v1";
import { subdivideAssistedManualRoofSurfacesV1 } from "./assisted-manual-surface-subdivision-v1";

export const ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION =
  "assisted-manual-height-adapter-input.v1" as const;
export const ASSISTED_MANUAL_HEIGHT_ADAPTER_ID =
  "assisted-manual-height-adapter" as const;
export const ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION =
  "assisted-manual-height-adapter.v1.0.0" as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);

const actorSchema = z
  .object({
    actorId: identifier,
    actorType: z.enum(["system", "administrator", "worker", "customer"]),
    displayName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const assistedManualHeightAdapterInputV1Schema = z
  .object({
    schemaVersion: z.literal(
      ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION,
    ),
    requestId: identifier,
    caseId: identifier,
    targetSnapshotId: identifier,
    previousSnapshotId: identifier.optional(),
    propertyId: identifier.optional(),
    legacyMeasurementId: z
      .union([z.string(), z.number().int().positive()])
      .optional(),
    idempotencyKey: z.string().trim().min(8).max(300),
    requestedAt: z.string().datetime({ offset: true }),
    generatedAt: z.string().datetime({ offset: true }),
    geometry: z.unknown(),
    heightSurface: z.custom<KartverketHeightSurfaceV1>(),
    orthophoto: z
      .object({
        sourceId: identifier,
        rawContentHash: z.string().regex(/^[a-f0-9]{64}$/u),
        capturedAt: z.string().datetime({ offset: true }),
        providerObjectId: z.string().trim().min(1).max(500).optional(),
        attribution: z.string().trim().min(1).max(500),
        provider: z.string().trim().min(1).max(160).default("norgeibilder.no"),
        geoReference: z.custom<NorgeIBilderGeoReference>(),
      })
      .strict(),
    actor: actorSchema,
  })
  .strict();

export type AssistedManualHeightAdapterInputV1 = Omit<
  z.infer<typeof assistedManualHeightAdapterInputV1Schema>,
  "geometry"
> & {
  geometry: AssistedManualRoofGeometryV1;
};

export type AssistedManualHeightAdapterSummaryV1 = {
  schemaVersion: typeof ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION;
  status: "review_required" | "blocked";
  pricingReady: false;
  geometryInputHash: string | null;
  sourceResultStatus: RoofSourceResultV1["status"];
  blockers: string[];
};

export type AssistedManualHeightAdapterResultV1 = {
  request: RoofSourceRequestV1;
  sourceResult: RoofSourceResultV1;
  snapshot: RoofSnapshotV1;
  geometryInput: RoofGeometryInputV1 | null;
  calculation: ReturnType<typeof calculateRoofGeometryV1> | null;
  summary: AssistedManualHeightAdapterSummaryV1;
};

type Point2 = { xM: number; yM: number };
type Point3 = Point2 & { zM: number };
type PlaneModel = {
  a: number;
  b: number;
  /** Elevation at the local fitting origin. */
  c: number;
  originX: number;
  originY: number;
  rmseM: number;
  sampleCount: number;
};

const MIN_ROOF_SAMPLES = 6;
const MAX_PLANE_RMSE_M = 1.2;
const MIN_HEIGHT_ABOVE_TERRAIN_M = 1.5;

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function pointOnSegment(point: Point2, from: Point2, to: Point2) {
  const area =
    (point.yM - from.yM) * (to.xM - from.xM) -
    (point.xM - from.xM) * (to.yM - from.yM);
  return (
    Math.abs(area) <= 1e-6 &&
    point.xM >= Math.min(from.xM, to.xM) - 1e-6 &&
    point.xM <= Math.max(from.xM, to.xM) + 1e-6 &&
    point.yM >= Math.min(from.yM, to.yM) - 1e-6 &&
    point.yM <= Math.max(from.yM, to.yM) + 1e-6
  );
}

function pointInPolygon(point: Point2, polygon: Point2[]) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const intersects =
      currentPoint.yM > point.yM !== previousPoint.yM > point.yM &&
      point.xM <
        ((previousPoint.xM - currentPoint.xM) * (point.yM - currentPoint.yM)) /
          (previousPoint.yM - currentPoint.yM) +
          currentPoint.xM;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonArea(polygon: Point2[]) {
  const origin = polygon[0];
  if (!origin) return 0;
  return (
    Math.abs(
      polygon.reduce((sum, point, index) => {
        const next = polygon[(index + 1) % polygon.length];
        const x = point.xM - origin.xM;
        const y = point.yM - origin.yM;
        const nextX = next.xM - origin.xM;
        const nextY = next.yM - origin.yM;
        return sum + x * nextY - nextX * y;
      }, 0),
    ) / 2
  );
}

function projectToImage(point: Point2, reference: NorgeIBilderGeoReference) {
  const spanX = reference.bounds.maxEastingM - reference.bounds.minEastingM;
  const spanY = reference.bounds.maxNorthingM - reference.bounds.minNorthingM;
  return {
    x:
      ((point.xM - reference.bounds.minEastingM) / spanX) *
      reference.imageWidth,
    y:
      ((reference.bounds.maxNorthingM - point.yM) / spanY) *
      reference.imageHeight,
  };
}

function isPointInsideOrtho(
  point: Point2,
  reference: NorgeIBilderGeoReference,
) {
  if (
    reference.extentTrust !== "actual-visible-extent" ||
    reference.crs !== "EPSG:25833" ||
    reference.imageWidth <= 0 ||
    reference.imageHeight <= 0
  ) {
    return false;
  }
  const projected = projectToImage(point, reference);
  return (
    Number.isFinite(projected.x) &&
    Number.isFinite(projected.y) &&
    projected.x >= 0 &&
    projected.x <= reference.imageWidth &&
    projected.y >= 0 &&
    projected.y <= reference.imageHeight
  );
}

function isPointInsideHeightSurface(
  point: Point2,
  surface: KartverketHeightSurfaceV1,
) {
  return (
    point.xM >= surface.bbox.minEastingM &&
    point.xM <= surface.bbox.maxEastingM &&
    point.yM >= surface.bbox.minNorthingM &&
    point.yM <= surface.bbox.maxNorthingM
  );
}

function solve3x3(matrix: number[][], values: number[]) {
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (
        Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])
      ) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot][column]) < 1e-9) return null;
    [augmented[column], augmented[pivot]] = [
      augmented[pivot],
      augmented[column],
    ];
    const divisor = augmented[column][column];
    for (let cell = column; cell <= 3; cell += 1) {
      augmented[column][cell] /= divisor;
    }
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let cell = column; cell <= 3; cell += 1) {
        augmented[row][cell] -= factor * augmented[column][cell];
      }
    }
  }
  return augmented.map((row) => row[3]);
}

function fitPlane(points: Point3[]): PlaneModel | null {
  if (points.length < 3) return null;
  const originX =
    points.reduce((sum, point) => sum + point.xM, 0) / points.length;
  const originY =
    points.reduce((sum, point) => sum + point.yM, 0) / points.length;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxz = 0;
  let syz = 0;
  for (const point of points) {
    const x = point.xM - originX;
    const y = point.yM - originY;
    sx += x;
    sy += y;
    sz += point.zM;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxz += x * point.zM;
    syz += y * point.zM;
  }
  const solved = solve3x3(
    [
      [sxx, sxy, sx],
      [sxy, syy, sy],
      [sx, sy, points.length],
    ],
    [sxz, syz, sz],
  );
  if (!solved) return null;
  const [a, b, c] = solved;
  const squaredError = points.reduce((sum, point) => {
    const predicted = a * (point.xM - originX) + b * (point.yM - originY) + c;
    return sum + (point.zM - predicted) ** 2;
  }, 0);
  return {
    a: round(a, 9),
    b: round(b, 9),
    c: round(c, 9),
    originX,
    originY,
    rmseM: round(Math.sqrt(squaredError / points.length), 6),
    sampleCount: points.length,
  };
}

function sampleRoofPoints(
  polygon: Point2[],
  surface: KartverketHeightSurfaceV1,
) {
  const samples: Point3[] = [];
  for (let row = 0; row < surface.grid.height; row += 1) {
    const yM =
      surface.bbox.maxNorthingM - (row + 0.5) * surface.grid.cellHeightM;
    for (let column = 0; column < surface.grid.width; column += 1) {
      const xM =
        surface.bbox.minEastingM + (column + 0.5) * surface.grid.cellWidthM;
      if (!pointInPolygon({ xM, yM }, polygon)) continue;
      const index = row * surface.grid.width + column;
      const domElevationM = surface.values.domElevationM[index];
      const heightAboveTerrainM = surface.values.heightAboveTerrainM[index];
      if (
        domElevationM === null ||
        heightAboveTerrainM === null ||
        !Number.isFinite(domElevationM) ||
        !Number.isFinite(heightAboveTerrainM) ||
        heightAboveTerrainM < MIN_HEIGHT_ABOVE_TERRAIN_M
      ) {
        continue;
      }
      samples.push({ xM, yM, zM: domElevationM });
    }
  }
  return samples;
}

function sourceIssue(
  code: string,
  severity: "info" | "warning" | "error",
  message: string,
) {
  return { code, severity, message, retryable: false as const };
}

function sourceFingerprint(input: AssistedManualHeightAdapterInputV1) {
  return canonicalSha256V1(
    {
      geometry: canonicalAssistedManualRoofGeometryV1(input.geometry),
      heightDom: input.heightSurface.provenance.domContentSha256,
      heightDtm: input.heightSurface.provenance.dtmContentSha256,
      orthophoto: input.orthophoto.rawContentHash,
    },
    "takfornyelse:assisted-manual-height-adapter:fingerprint:v1",
  ).slice(0, 20);
}

function buildBlockedResult(
  input: AssistedManualHeightAdapterInputV1,
  blockers: string[],
) {
  const fingerprint = sourceFingerprint(input);
  const request = buildRoofSourceRequestV1({
    schemaVersion: "roof-source-request.v1",
    requestId: input.requestId,
    caseId: input.caseId,
    targetSnapshotId: input.targetSnapshotId,
    expectedInputVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    adapterId: ASSISTED_MANUAL_HEIGHT_ADAPTER_ID,
    idempotencyKey: input.idempotencyKey,
    requestedAt: input.requestedAt,
    input: {
      adapterInputHash: canonicalSha256V1(
        canonicalizeJsonValueV1(input),
        "takfornyelse:assisted-manual-height-adapter:input:v1",
      ),
    },
  });
  const sourceRecords = [
    {
      sourceId: input.geometry.sourceFootprint.sourceId,
      kind: "building_footprint" as const,
      provider: "Assisted manual source footprint",
      inputSchemaVersion: input.geometry.schemaVersion,
      adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
      retrievedAt: input.generatedAt,
      rawContentHash: input.geometry.sourceFootprint.sourceContentHash,
      license: {
        status: "authorized" as const,
        name: "Internal reviewed source geometry",
        attribution: "Takfornyelse reviewed geometry",
      },
      visibility: "customer_safe" as const,
      quality: {
        status: "usable" as const,
        score: 0.8,
        reasons: ["Administrator-approved draft geometry"],
      },
    },
    {
      sourceId: input.orthophoto.sourceId,
      kind: "orthophoto" as const,
      provider: input.orthophoto.provider,
      providerObjectId: input.orthophoto.providerObjectId,
      inputSchemaVersion: "norge-i-bilder-capture.v1",
      adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
      capturedAt: input.orthophoto.capturedAt,
      retrievedAt: input.generatedAt,
      rawContentHash: input.orthophoto.rawContentHash,
      license: {
        status: "authorized" as const,
        name: "Kartverket written permission for user-triggered screenshot capture",
        attribution: input.orthophoto.attribution,
      },
      visibility: "customer_safe" as const,
      quality: {
        status: "limited" as const,
        score: 0.4,
        reasons: blockers,
      },
    },
  ];
  const sourceResult = buildRoofSourceResultV1({
    schemaVersion: "roof-source-result.v1",
    status: "failed",
    adapterId: ASSISTED_MANUAL_HEIGHT_ADAPTER_ID,
    adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
    provider: "Takfornyelse assisted manual height adapter",
    providerInputVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    providerRequestId: fingerprint,
    requestInputHash: request.inputHash,
    idempotencyKey: request.idempotencyKey,
    receivedAt: input.generatedAt,
    rawContentHash: request.inputHash,
    sourceRecords,
    issues: blockers.map((blocker, index) =>
      sourceIssue(
        index === 0
          ? "ASSISTED_MANUAL_REGISTRATION_BLOCKED"
          : `ASSISTED_MANUAL_BLOCKER_${index + 1}`,
        "error",
        blocker,
      ),
    ),
  });
  const snapshot = roofSourceResultToSnapshotV1(request, sourceResult, {
    snapshotId: input.targetSnapshotId,
    revision: 1,
    supersedesSnapshotId: input.previousSnapshotId,
    caseId: input.caseId,
    propertyId: input.propertyId,
    legacyMeasurementId: input.legacyMeasurementId,
    inputVersion: request.expectedInputVersion,
    engineVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
    rendererVersion: "roof-renderer.v1.0.0",
    generatedAt: input.generatedAt,
    normalizedBy: input.actor,
  });
  return {
    request,
    sourceResult,
    snapshot,
    geometryInput: null,
    calculation: null,
    summary: {
      schemaVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION,
      status: "blocked" as const,
      pricingReady: false as const,
      geometryInputHash: null,
      sourceResultStatus: sourceResult.status,
      blockers,
    },
  } satisfies AssistedManualHeightAdapterResultV1;
}

function buildSuccessfulSources(
  input: AssistedManualHeightAdapterInputV1,
  manualSourceId: string,
) {
  return [
    {
      sourceId: input.geometry.sourceFootprint.sourceId,
      kind: "building_footprint" as const,
      provider: "Assisted manual source footprint",
      inputSchemaVersion: input.geometry.schemaVersion,
      adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
      retrievedAt: input.generatedAt,
      rawContentHash: input.geometry.sourceFootprint.sourceContentHash,
      license: {
        status: "authorized" as const,
        name: "Internal reviewed source geometry",
        attribution: "Takfornyelse reviewed geometry",
      },
      visibility: "customer_safe" as const,
      quality: {
        status: "usable" as const,
        score: 0.8,
        reasons: ["Administrator-approved source footprint reference"],
      },
    },
    {
      sourceId: input.orthophoto.sourceId,
      kind: "orthophoto" as const,
      provider: input.orthophoto.provider,
      providerObjectId: input.orthophoto.providerObjectId,
      inputSchemaVersion: "norge-i-bilder-capture.v1",
      adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
      capturedAt: input.orthophoto.capturedAt,
      retrievedAt: input.generatedAt,
      rawContentHash: input.orthophoto.rawContentHash,
      license: {
        status: "authorized" as const,
        name: "Kartverket written permission for user-triggered screenshot capture",
        attribution: input.orthophoto.attribution,
      },
      visibility: "customer_safe" as const,
      quality: {
        status: "usable" as const,
        score: 0.9,
        reasons: ["Actual visible extent was captured and preserved"],
      },
    },
    {
      sourceId: "src-height-dom",
      kind: "lidar" as const,
      provider: input.heightSurface.provider,
      providerObjectId: input.heightSurface.provenance.domCoverageId,
      inputSchemaVersion: input.heightSurface.schemaVersion,
      adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
      retrievedAt: input.heightSurface.provenance.retrievedAt,
      rawContentHash: input.heightSurface.provenance.domContentSha256,
      license: {
        status: "authorized" as const,
        name: input.heightSurface.provenance.license,
        attribution: input.heightSurface.provenance.attribution,
        termsVersion: "NLOD-2.0",
      },
      visibility: "customer_safe" as const,
      quality: {
        status: input.heightSurface.quality.status,
        score: input.heightSurface.quality.coverageRatio,
        reasons: input.heightSurface.quality.reasons,
      },
    },
    {
      sourceId: "src-height-dtm",
      kind: "lidar" as const,
      provider: input.heightSurface.provider,
      providerObjectId: input.heightSurface.provenance.dtmCoverageId,
      inputSchemaVersion: input.heightSurface.schemaVersion,
      adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
      retrievedAt: input.heightSurface.provenance.retrievedAt,
      rawContentHash: input.heightSurface.provenance.dtmContentSha256,
      license: {
        status: "authorized" as const,
        name: input.heightSurface.provenance.license,
        attribution: input.heightSurface.provenance.attribution,
        termsVersion: "NLOD-2.0",
      },
      visibility: "customer_safe" as const,
      quality: {
        status: input.heightSurface.quality.status,
        score: input.heightSurface.quality.coverageRatio,
        reasons: input.heightSurface.quality.reasons,
      },
    },
    {
      sourceId: manualSourceId,
      kind: "manual" as const,
      provider: "Takfornyelse admin roof workbench",
      providerObjectId: input.actor.actorId,
      inputSchemaVersion: input.geometry.schemaVersion,
      adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
      retrievedAt: input.generatedAt,
      rawContentHash: canonicalSha256V1(
        canonicalAssistedManualRoofGeometryV1(input.geometry),
        "takfornyelse:assisted-manual-height-adapter:manual-source:v1",
      ),
      license: {
        status: "authorized" as const,
        name: "Internal manual review",
        attribution: input.actor.displayName ?? input.actor.actorId,
      },
      visibility: "internal" as const,
      quality: {
        status: "usable" as const,
        score: 0.95,
        reasons: ["Administrator approved the editable roof topology"],
      },
    },
  ];
}

export function adaptAssistedManualRoofGeometryToSnapshotV1(
  inputValue: AssistedManualHeightAdapterInputV1,
): AssistedManualHeightAdapterResultV1 {
  const parsed = assistedManualHeightAdapterInputV1Schema.parse(
    canonicalizeJsonValueV1(inputValue),
  );
  const geometry = assertAssistedManualRoofGeometryV1(parsed.geometry);
  const input: AssistedManualHeightAdapterInputV1 = { ...parsed, geometry };

  const georegistrationBlockers: string[] = [];
  if (
    input.heightSurface.schemaVersion !== "kartverket-height-surface.v1" ||
    input.heightSurface.coordinateSystem !== "EPSG:25833"
  ) {
    georegistrationBlockers.push(
      "Høydedata surface contract is invalid or not expressed in EPSG:25833.",
    );
  }
  if (
    input.orthophoto.geoReference.extentTrust !== "actual-visible-extent" ||
    input.orthophoto.geoReference.crs !== "EPSG:25833"
  ) {
    georegistrationBlockers.push(
      "Orthophoto extent is not an actual visible EPSG:25833 extent.",
    );
  }

  const allPlanPoints: Point2[] = [
    ...geometry.sourceFootprint.points,
    ...geometry.vertices.map((vertex) => ({ xM: vertex.xM, yM: vertex.yM })),
  ];
  if (
    allPlanPoints.some(
      (point) => !isPointInsideOrtho(point, input.orthophoto.geoReference),
    )
  ) {
    georegistrationBlockers.push(
      "Approved roof geometry extends outside the trusted orthophoto frame.",
    );
  }
  if (
    allPlanPoints.some(
      (point) => !isPointInsideHeightSurface(point, input.heightSurface),
    )
  ) {
    georegistrationBlockers.push(
      "Approved roof geometry extends outside the Høydedata grid.",
    );
  }
  if (georegistrationBlockers.length) {
    return buildBlockedResult(input, georegistrationBlockers);
  }

  const subdivision = geometry.skeletonEdges.length
    ? subdivideAssistedManualRoofSurfacesV1(geometry, input.heightSurface)
    : null;
  if (subdivision && subdivision.status !== "ready") {
    return buildBlockedResult(
      input,
      subdivision.issues.map(
        (item) =>
          `[${item.code}] Rankinis kraigas ar sąlaja nesudaro saugaus uždaro stogo paviršių padalijimo. Pataisykite linijos galus arba pridėkite trūkstamą liniją.`,
      ),
    );
  }
  if (subdivision && geometry.obstacles.length) {
    return buildBlockedResult(input, [
      "[OBSTACLE_SURFACE_OWNERSHIP_REQUIRED] Kliūtys negali būti automatiškai priskirtos kraigo padalytiems paviršiams; reikalinga peržiūra.",
    ]);
  }

  const manualSourceId = "src-assisted-manual";
  const sources = buildSuccessfulSources(input, manualSourceId);
  const sourceRefs = [
    input.geometry.sourceFootprint.sourceId,
    input.orthophoto.sourceId,
    "src-height-dom",
    "src-height-dtm",
    manualSourceId,
  ];
  const sourceVertexMap = new Map(
    input.geometry.vertices.map((vertex) => [
      vertex.vertexId,
      { xM: vertex.xM, yM: vertex.yM },
    ]),
  );
  const observations: RoofGeometryInputV1["provenance"]["observations"] = [];
  const vertices: RoofGeometryInputV1["vertices"] = [];
  const surfaces: RoofGeometryInputV1["surfaces"] = [];
  const openings: RoofGeometryInputV1["openings"] = [];
  const obstacles: RoofGeometryInputV1["obstacles"] = [];
  const issues: RoofSourceResultV1["issues"] = [];
  const blockers: string[] = [];

  const calculationMasses = subdivision
    ? subdivision.surfaces.map((surface) => ({
        mass: geometry.roofMasses.find(
          (item) => item.massId === surface.roofMassId,
        )!,
        surfaceId: surface.surfaceId,
        vertexIds: surface.vertexIds,
        fittedVertices: surface.vertices,
        edgeIds: surface.edgeIds,
        openingIds: surface.openingIds,
      }))
    : geometry.roofMasses.map((mass) => ({
        mass,
        surfaceId: `surface-${mass.massId}`,
        vertexIds: mass.vertexIds,
        fittedVertices: undefined,
        edgeIds: undefined,
        openingIds: geometry.openings
          .filter((item) => item.roofMassId === mass.massId)
          .map((item) => item.openingId),
      }));

  for (const calculationMass of calculationMasses) {
    const { mass, surfaceId, vertexIds } = calculationMass;
    const fittedVertexMap = new Map(
      calculationMass.fittedVertices?.map((vertex) => [
        vertex.vertexId,
        vertex,
      ]),
    );
    const polygon = vertexIds.map((vertexId) => {
      const point =
        fittedVertexMap.get(vertexId) ?? sourceVertexMap.get(vertexId);
      if (!point)
        throw new TypeError(`Missing assisted manual vertex ${vertexId}`);
      return point;
    });
    const samples = sampleRoofPoints(polygon, input.heightSurface);
    if (samples.length < MIN_ROOF_SAMPLES) {
      return buildBlockedResult(input, [
        `Roof mass ${mass.massId} has too few elevated Høydedata samples for a safe plane fit.`,
      ]);
    }
    const plane = fitPlane(samples);
    if (!plane || plane.rmseM > MAX_PLANE_RMSE_M) {
      return buildBlockedResult(input, [
        `Roof mass ${mass.massId} does not fit a stable Høydedata plane within the safe RMSE limit.`,
      ]);
    }
    const localVertexIdFor = (vertexId: string) =>
      subdivision ? `v-subdivision-${vertexId}` : `v-${surfaceId}-${vertexId}`;
    const zFor = (point: Point2) =>
      round(
        plane.a * (point.xM - plane.originX) +
          plane.b * (point.yM - plane.originY) +
          plane.c,
        6,
      );
    const massVertexIds = vertexIds.map((vertexId) => {
      const point =
        fittedVertexMap.get(vertexId) ?? sourceVertexMap.get(vertexId)!;
      const geometryVertexId = localVertexIdFor(vertexId);
      if (!vertices.some((vertex) => vertex.vertexId === geometryVertexId)) {
        vertices.push({
          vertexId: geometryVertexId,
          xM: round(point.xM, 6),
          yM: round(point.yM, 6),
          zM:
            "zM" in point && typeof point.zM === "number"
              ? round(point.zM, 6)
              : zFor(point),
          uncertaintyM: round(Math.max(0.25, plane.rmseM + 0.15), 6),
          sourceRefs,
        });
      }
      return geometryVertexId;
    });
    surfaces.push({
      surfaceId,
      contourId: `contour-${surfaceId}`,
      vertexIds: massVertexIds,
      edgeIds:
        calculationMass.edgeIds ??
        massVertexIds.map(
          (_vertexId, index) => `edge-${surfaceId}-${index + 1}`,
        ),
      quality: "estimated",
      sourceRefs,
    });
    observations.push({
      observationId: `obs-mass-${surfaceId}`,
      kind: "surface_exists",
      targetRef: surfaceId,
      value: {
        approvedAt: mass.approvedAt,
        sampleCount: plane.sampleCount,
        fitRmseM: plane.rmseM,
        horizontalAreaM2: round(polygonArea(polygon), 3),
      },
      status: "accepted",
      sourceRefs: [manualSourceId, "src-height-dom", "src-height-dtm"],
      confidence: {
        level:
          plane.rmseM <= 0.45 ? "high" : plane.rmseM <= 0.8 ? "medium" : "low",
        score: round(Math.max(0.4, 1 - plane.rmseM / 2), 6),
        basis: "derived",
        rationale:
          "A deterministic single-plane fit was derived from the approved roof mass and Høydedata cells.",
      },
      reasons: [
        "The administrator approved this roof mass in EPSG:25833.",
        "Only trusted orthophoto and Høydedata sources were used.",
      ],
    });

    for (const opening of geometry.openings.filter((item) =>
      calculationMass.openingIds.includes(item.openingId),
    )) {
      const openingVertexIds = opening.vertexIds.map((vertexId) => {
        const point = sourceVertexMap.get(vertexId)!;
        const geometryVertexId = `v-${opening.openingId}-${vertexId}`;
        vertices.push({
          vertexId: geometryVertexId,
          xM: round(point.xM, 6),
          yM: round(point.yM, 6),
          zM: zFor(point),
          uncertaintyM: round(Math.max(0.25, plane.rmseM + 0.15), 6),
          sourceRefs,
        });
        return geometryVertexId;
      });
      openings.push({
        openingId: opening.openingId,
        surfaceId,
        contourId: `contour-${opening.openingId}`,
        vertexIds: openingVertexIds,
        kind: opening.kind,
        quality: "estimated",
        sourceRefs,
      });
    }

    for (const obstacle of geometry.obstacles.filter(
      (item) => item.roofMassId === mass.massId,
    )) {
      const obstacleVertexIds = obstacle.vertexIds.map((vertexId) => {
        const point = sourceVertexMap.get(vertexId)!;
        const geometryVertexId = `v-${obstacle.obstacleId}-${vertexId}`;
        vertices.push({
          vertexId: geometryVertexId,
          xM: round(point.xM, 6),
          yM: round(point.yM, 6),
          zM: zFor(point),
          uncertaintyM: round(Math.max(0.25, plane.rmseM + 0.15), 6),
          sourceRefs,
        });
        return geometryVertexId;
      });
      obstacles.push({
        obstacleId: obstacle.obstacleId,
        surfaceId,
        contourId: `contour-${obstacle.obstacleId}`,
        vertexIds: obstacleVertexIds,
        kind: obstacle.kind,
        quality: "estimated",
        sourceRefs,
      });
    }
  }

  if (geometry.skeletonEdges.length > 0) {
    blockers.push(
      "Manual ridge, valley, hip, and eave hints were used for explicit plane subdivision; the resulting shared topology still requires review before pricing.",
    );
    issues.push(
      sourceIssue(
        "ASSISTED_SKELETON_REVIEW_REQUIRED",
        "warning",
        "Skeleton edges were used to subdivide the approved mass into fitted surfaces and are preserved as review evidence.",
      ),
    );
    for (const edge of geometry.skeletonEdges) {
      const subdivisionEdge = subdivision?.edges.find((item) =>
        item.sourceSkeletonEdgeIds.includes(edge.edgeId),
      );
      observations.push({
        observationId: `obs-skeleton-${edge.edgeId}`,
        kind: "edge_type",
        targetRef:
          subdivisionEdge?.surfaceIds[0] ?? `surface-${edge.roofMassId}`,
        value: {
          edgeId: edge.edgeId,
          roofMassId: edge.roofMassId,
          type: edge.type,
          provenance: edge.provenance,
          fromVertexId: edge.fromVertexId,
          toVertexId: edge.toVertexId,
          surfaceIds: subdivisionEdge?.surfaceIds ?? [],
        },
        status: "accepted",
        sourceRefs: [manualSourceId],
        confidence: {
          level: "medium",
          score: 0.75,
          basis: "human_assessed",
          rationale:
            "The administrator explicitly captured this edge type and it was used as a shared boundary for deterministic Høydedata plane fitting.",
        },
        reasons: [
          "Used for explicit surface subdivision and preserved for review.",
        ],
      });
    }
  }

  const acceptedObservationIds = observations.map(
    (observation) => observation.observationId,
  );
  const geometryInput: RoofGeometryInputV1 = {
    schemaVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    calculationId: `calc-assisted-${sourceFingerprint(input)}`,
    coordinateSystem: {
      kind: "projected_crs",
      reference: "EPSG:25833",
      axisOrder: "easting_northing",
    },
    vertices,
    surfaces,
    openings,
    obstacles,
    provenance: {
      sources,
      observations,
      fusionDecision: {
        decisionId: `fusion-assisted-${sourceFingerprint(input)}`,
        policyVersion: "assisted-manual-height-adapter-policy.v1",
        acceptedObservationIds,
        rejectedObservationIds: [],
        conflictedObservationIds: [],
        decidedAt: input.generatedAt,
        decidedBy: input.actor,
        rationale:
          geometry.skeletonEdges.length > 0
            ? "Approved roof masses were explicitly subdivided by the captured skeleton before trusted Høydedata planes were fitted."
            : "Approved roof masses and trusted Høydedata were converted into preliminary calculable planes with no internal skeleton hints pending.",
      },
    },
    measurement: {
      method: "manual_workbench",
      class: "preliminary",
      confidence: {
        level: geometry.skeletonEdges.length > 0 ? "low" : "medium",
        score: geometry.skeletonEdges.length > 0 ? 0.58 : 0.74,
        basis: "derived",
        rationale:
          geometry.skeletonEdges.length > 0
            ? "Areas and pitches are preliminary because the manual skeleton subdivision and shared topology still require human review."
            : "Areas and pitches are preliminary because they derive from one fitted plane per approved roof mass.",
      },
    },
  };
  const calculation = calculateRoofGeometryV1(geometryInput);
  const request = buildRoofSourceRequestV1({
    schemaVersion: "roof-source-request.v1",
    requestId: input.requestId,
    caseId: input.caseId,
    targetSnapshotId: input.targetSnapshotId,
    expectedInputVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    adapterId: ASSISTED_MANUAL_HEIGHT_ADAPTER_ID,
    idempotencyKey: input.idempotencyKey,
    requestedAt: input.requestedAt,
    input: {
      geometryInputHash: roofGeometryInputHashV1(geometryInput),
      adapterInputHash: canonicalSha256V1(
        canonicalizeJsonValueV1(input),
        "takfornyelse:assisted-manual-height-adapter:input:v1",
      ),
      calculationId: calculation.calculationId,
    },
  });
  const sourceResult = buildRoofSourceResultV1({
    schemaVersion: "roof-source-result.v1",
    status: issues.length ? "partial" : "complete",
    adapterId: ASSISTED_MANUAL_HEIGHT_ADAPTER_ID,
    adapterVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
    provider: "Takfornyelse assisted manual height adapter",
    providerInputVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    providerRequestId: calculation.calculationId,
    requestInputHash: request.inputHash,
    idempotencyKey: request.idempotencyKey,
    receivedAt: input.generatedAt,
    rawContentHash: calculation.inputHash,
    sourceRecords: calculation.normalized.provenance.sources,
    issues,
    normalized: calculation.normalized,
  });
  const snapshot = roofSourceResultToSnapshotV1(request, sourceResult, {
    snapshotId: input.targetSnapshotId,
    revision: 1,
    supersedesSnapshotId: input.previousSnapshotId,
    caseId: input.caseId,
    propertyId: input.propertyId,
    legacyMeasurementId: input.legacyMeasurementId,
    inputVersion: request.expectedInputVersion,
    engineVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_VERSION,
    rendererVersion: "roof-renderer.v1.0.0",
    generatedAt: input.generatedAt,
    normalizedBy: input.actor,
  });
  return {
    request,
    sourceResult,
    snapshot,
    geometryInput,
    calculation,
    summary: {
      schemaVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION,
      status: snapshot.state === "blocked" ? "blocked" : "review_required",
      pricingReady: false,
      geometryInputHash: calculation.inputHash,
      sourceResultStatus: sourceResult.status,
      blockers,
    },
  };
}
