import { z } from "zod";
import {
  canonicalJsonV1,
  canonicalSha256V1,
  canonicalizeJsonValueV1,
  compareCanonicalStringsV1,
  uniqueCanonicalStringsV1,
} from "./canonicalization-v1";

export const ROOF_SNAPSHOT_SCHEMA_VERSION = "roof-snapshot.v1" as const;
export const ROOF_RENDERER_SCHEMA_VERSION = "roof-renderer.v1" as const;
export const ROOF_SNAPSHOT_HASH_ALGORITHM = "sha256" as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const timestamp = z.string().datetime({ offset: true });

type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.null(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const confidenceSchema = z
  .object({
    level: z.enum(["high", "medium", "low", "unknown"]),
    score: z.number().min(0).max(1).nullable(),
    basis: z.enum([
      "calibrated",
      "provider_reported",
      "human_assessed",
      "derived",
      "unknown",
    ]),
    rationale: z.string().trim().min(1).max(1_500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.level === "unknown" && value.score !== null) {
      context.addIssue({
        code: "custom",
        message: "Unknown confidence cannot claim a score",
        path: ["score"],
      });
    }
    if (value.level !== "unknown" && value.score === null) {
      context.addIssue({
        code: "custom",
        message: "Known confidence requires a score",
        path: ["score"],
      });
    }
  });

const measurementValueSchema = z
  .object({
    mode: z.enum(["exact", "range", "unknown"]),
    unit: z.enum(["m", "m2", "deg"]),
    min: z.number().finite().nonnegative().nullable(),
    max: z.number().finite().nonnegative().nullable(),
    sourceRefs: z.array(identifier).max(100),
    confidence: confidenceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === "unknown") {
      if (value.min !== null || value.max !== null) {
        context.addIssue({
          code: "custom",
          message: "Unknown measurement cannot contain numeric bounds",
        });
      }
      return;
    }
    if (value.min === null || value.max === null) {
      context.addIssue({
        code: "custom",
        message: "Known measurement requires both bounds",
      });
      return;
    }
    if (value.min > value.max) {
      context.addIssue({
        code: "custom",
        message: "Measurement minimum cannot exceed maximum",
      });
    }
    if (value.mode === "exact" && value.min !== value.max) {
      context.addIssue({
        code: "custom",
        message: "Exact measurement requires equal bounds",
      });
    }
  });

const actorSchema = z
  .object({
    actorId: identifier,
    actorType: z.enum(["system", "administrator", "worker", "customer"]),
    displayName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const sourceSchema = z
  .object({
    sourceId: identifier,
    kind: z.enum([
      "address_anchor",
      "building_footprint",
      "orthophoto",
      "licensed_report",
      "document",
      "photo",
      "lidar",
      "fkb_line",
      "photogrammetry",
      "instrument",
      "manual",
      "legacy",
      "unknown",
    ]),
    provider: z.string().trim().min(1).max(160),
    providerObjectId: z.string().trim().min(1).max(500).optional(),
    inputSchemaVersion: z.string().trim().min(1).max(120),
    adapterVersion: z.string().trim().min(1).max(120),
    capturedAt: timestamp.optional(),
    retrievedAt: timestamp,
    rawContentHash: sha256,
    license: z
      .object({
        status: z.enum(["authorized", "restricted", "denied", "unknown"]),
        name: z.string().trim().min(1).max(300),
        attribution: z.string().trim().min(1).max(500),
        termsVersion: z.string().trim().min(1).max(160).optional(),
      })
      .strict(),
    visibility: z.enum(["internal", "customer_safe", "derived_only"]),
    quality: z
      .object({
        status: z.enum(["usable", "limited", "rejected", "unknown"]),
        score: z.number().min(0).max(1).nullable(),
        reasons: z.array(z.string().trim().min(1).max(300)).max(50),
      })
      .strict(),
  })
  .strict();

const vertexSchema = z
  .object({
    vertexId: identifier,
    xM: z.number().finite(),
    yM: z.number().finite(),
    zM: z.number().finite().optional(),
    uncertaintyM: z.number().finite().nonnegative(),
    sourceRefs: z.array(identifier).max(100),
  })
  .strict();

const contourSchema = z
  .object({
    contourId: identifier,
    kind: z.enum([
      "roof_boundary",
      "surface_boundary",
      "opening_boundary",
      "obstacle_boundary",
      "footprint",
      "unknown",
    ]),
    vertexIds: z.array(identifier).min(3).max(500),
    sourceRefs: z.array(identifier).max(100),
  })
  .strict();

const geometryQuality = z.enum([
  "verified",
  "estimated",
  "conflicted",
  "unknown",
]);
const edgeType = z.enum([
  "ridge",
  "hip",
  "valley",
  "eave",
  "rake",
  "wall",
  "step",
  "unknown",
]);

const surfaceSchema = z
  .object({
    surfaceId: identifier,
    outerContourId: identifier,
    openingIds: z.array(identifier).max(100),
    edgeIds: z.array(identifier).min(3).max(500),
    normal: z
      .tuple([z.number().finite(), z.number().finite(), z.number().finite()])
      .optional(),
    azimuthDegrees: z.number().min(0).lt(360).nullable(),
    pitch: measurementValueSchema,
    grossHorizontalArea: measurementValueSchema,
    grossSurfaceArea: measurementValueSchema,
    netSurfaceArea: measurementValueSchema,
    quality: geometryQuality,
    sourceRefs: z.array(identifier).max(100),
  })
  .strict();

const edgeSchema = z
  .object({
    edgeId: identifier,
    fromVertexId: identifier,
    toVertexId: identifier,
    adjacentSurfaceIds: z.array(identifier).min(1).max(2),
    type: edgeType,
    length2d: measurementValueSchema,
    length3d: measurementValueSchema,
    gutterCandidate: z.boolean(),
    quality: geometryQuality,
    sourceRefs: z.array(identifier).max(100),
  })
  .strict();

const openingSchema = z
  .object({
    openingId: identifier,
    surfaceId: identifier,
    contourId: identifier,
    kind: z.enum([
      "skylight",
      "roof_hatch",
      "chimney",
      "vent",
      "dormer",
      "unknown",
    ]),
    horizontalArea: measurementValueSchema,
    surfaceArea: measurementValueSchema,
    quality: geometryQuality,
    sourceRefs: z.array(identifier).max(100),
  })
  .strict();

const obstacleSchema = z
  .object({
    obstacleId: identifier,
    surfaceId: identifier.optional(),
    contourId: identifier.optional(),
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
    height: measurementValueSchema.optional(),
    quality: geometryQuality,
    sourceRefs: z.array(identifier).max(100),
  })
  .strict();

const observationSchema = z
  .object({
    observationId: identifier,
    kind: z.enum([
      "surface_exists",
      "surface_pitch",
      "surface_area",
      "edge_exists",
      "edge_type",
      "opening_exists",
      "obstacle_exists",
      "source_suitability",
      "unknown",
    ]),
    targetRef: identifier,
    value: jsonValueSchema,
    status: z.enum(["accepted", "rejected", "conflicted", "unknown"]),
    sourceRefs: z.array(identifier).min(1).max(100),
    confidence: confidenceSchema,
    reasons: z.array(z.string().trim().min(1).max(500)).max(50),
  })
  .strict();

const issueSchema = z
  .object({
    code: z.string().trim().min(1).max(120),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().trim().min(1).max(1_000),
    retryable: z.boolean(),
    sourceRef: identifier.optional(),
  })
  .strict();

const manualCorrectionSchema = z
  .object({
    correctionId: identifier,
    sequence: z.number().int().positive(),
    targetType: z.enum(["surface", "edge", "opening", "obstacle", "snapshot"]),
    targetId: identifier,
    path: z.string().trim().min(1).max(160),
    before: jsonValueSchema,
    after: jsonValueSchema,
    reason: z.string().trim().min(5).max(1_000),
    sourceRefs: z.array(identifier).min(1).max(100),
    actor: actorSchema,
    correctedAt: timestamp,
    idempotencyKey: z.string().trim().min(8).max(300),
  })
  .strict();

const auditEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    eventType: z.enum([
      "source_ingested",
      "source_normalized",
      "quality_evaluated",
      "review_completed",
      "manual_correction_applied",
      "submitted_for_review",
      "approved",
      "rejected",
      "superseded",
    ]),
    occurredAt: timestamp,
    actor: actorSchema,
    idempotencyKey: z.string().trim().min(8).max(300).optional(),
    details: z.record(z.string(), jsonValueSchema),
  })
  .strict();

const qualityCheckSchema = z
  .object({
    code: z.string().trim().min(1).max(120),
    status: z.enum(["pass", "review_required", "fail"]),
    message: z.string().trim().min(1).max(1_000),
    entityRefs: z.array(identifier).max(500),
  })
  .strict();

const totalsSchema = z
  .object({
    grossHorizontalArea: measurementValueSchema,
    grossSurfaceArea: measurementValueSchema,
    netSurfaceArea: measurementValueSchema,
    footprintPerimeter: measurementValueSchema,
    eaveLength: measurementValueSchema,
    gutterCandidateLength: measurementValueSchema,
    verifiedGutterLength: measurementValueSchema,
  })
  .strict();

const rendererPayloadSchema = z
  .object({
    schemaVersion: z.literal(ROOF_RENDERER_SCHEMA_VERSION),
    rendererVersion: z.string().trim().min(1).max(120),
    units: z
      .object({
        length: z.literal("m"),
        area: z.literal("m2"),
        angle: z.literal("deg"),
        precision: z
          .object({
            lengthDecimals: z.number().int().min(0).max(6),
            areaDecimals: z.number().int().min(0).max(6),
            angleDecimals: z.number().int().min(0).max(6),
          })
          .strict(),
      })
      .strict(),
    coordinateSystem: z
      .object({
        kind: z.enum(["local_cartesian", "wgs84", "projected_crs"]),
        reference: z.string().trim().min(1).max(200),
        axisOrder: z.enum([
          "x_east_y_north_z_up",
          "longitude_latitude",
          "easting_northing",
        ]),
        origin: z
          .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            elevationM: z.number().finite().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    displayState: z.enum([
      "draft",
      "review_required",
      "blocked",
      "approved",
      "rejected",
      "superseded",
    ]),
    measurementClass: z.enum([
      "preliminary",
      "fused_estimate",
      "verified_geometry",
      "instrument_site_verified",
    ]),
    vertices: z.array(vertexSchema),
    contours: z.array(contourSchema),
    surfaces: z.array(surfaceSchema),
    edges: z.array(edgeSchema),
    openings: z.array(openingSchema),
    obstacles: z.array(obstacleSchema),
    totals: totalsSchema,
    sources: z.array(
      z
        .object({
          sourceId: identifier,
          kind: sourceSchema.shape.kind,
          attribution: z.string().trim().min(1).max(500),
          licenseStatus: z.enum([
            "authorized",
            "restricted",
            "denied",
            "unknown",
          ]),
        })
        .strict(),
    ),
    renderHash: sha256,
  })
  .strict();

const roofSnapshotV1ObjectSchema = z
  .object({
    schemaVersion: z.literal(ROOF_SNAPSHOT_SCHEMA_VERSION),
    snapshotId: identifier,
    revision: z.number().int().positive(),
    supersedesSnapshotId: identifier.optional(),
    subject: z
      .object({
        caseId: identifier,
        propertyId: identifier.optional(),
        legacyMeasurementId: z
          .union([z.string(), z.number().int().positive()])
          .optional(),
      })
      .strict(),
    inputVersion: z.string().trim().min(1).max(120),
    engineVersion: z.string().trim().min(1).max(120),
    rendererVersion: z.string().trim().min(1).max(120),
    inputHash: sha256,
    generatedAt: timestamp,
    state: z.enum([
      "draft",
      "review_required",
      "blocked",
      "approved",
      "rejected",
      "superseded",
    ]),
    processing: z
      .object({
        status: z.enum(["complete", "partial", "error", "unknown"]),
        issues: z.array(issueSchema).max(500),
      })
      .strict(),
    units: z
      .object({
        length: z.literal("m"),
        area: z.literal("m2"),
        angle: z.literal("deg"),
        coordinates: z.literal("m"),
        precision: z
          .object({
            lengthDecimals: z.number().int().min(0).max(6),
            areaDecimals: z.number().int().min(0).max(6),
            angleDecimals: z.number().int().min(0).max(6),
          })
          .strict(),
      })
      .strict(),
    coordinateSystem: rendererPayloadSchema.shape.coordinateSystem,
    geometry: z
      .object({
        vertices: z.array(vertexSchema).max(10_000),
        contours: z.array(contourSchema).max(2_000),
        surfaces: z.array(surfaceSchema).max(1_000),
        edges: z.array(edgeSchema).max(10_000),
        openings: z.array(openingSchema).max(2_000),
        obstacles: z.array(obstacleSchema).max(2_000),
      })
      .strict(),
    totals: totalsSchema,
    provenance: z
      .object({
        sources: z.array(sourceSchema).max(1_000),
        observations: z.array(observationSchema).max(10_000),
        fusionDecision: z
          .object({
            decisionId: identifier,
            policyVersion: z.string().trim().min(1).max(120),
            acceptedObservationIds: z.array(identifier).max(10_000),
            rejectedObservationIds: z.array(identifier).max(10_000),
            conflictedObservationIds: z.array(identifier).max(10_000),
            decidedAt: timestamp,
            decidedBy: actorSchema,
            rationale: z.string().trim().min(1).max(2_000),
          })
          .strict(),
      })
      .strict(),
    measurement: z
      .object({
        method: z.enum([
          "legacy_footprint_slope_band",
          "manual_workbench",
          "provider_structured_import",
          "photogrammetry",
          "lidar_plane_fit",
          "instrument_onsite",
          "document_derived",
          "multi_source_fusion",
          "manual_area_without_geometry",
          "unknown",
        ]),
        class: z.enum([
          "preliminary",
          "fused_estimate",
          "verified_geometry",
          "instrument_site_verified",
        ]),
        confidence: confidenceSchema,
      })
      .strict(),
    manualCorrections: z.array(manualCorrectionSchema).max(10_000),
    quality: z
      .object({
        status: z.enum(["pass", "review_required", "fail"]),
        checks: z.array(qualityCheckSchema).min(1).max(500),
      })
      .strict(),
    approval: z
      .object({
        status: z.enum(["not_requested", "pending", "approved", "rejected"]),
        approvedBy: actorSchema.optional(),
        approvedAt: timestamp.optional(),
        reviewReason: z.string().trim().min(5).max(1_000).optional(),
      })
      .strict(),
    auditTrail: z.array(auditEventSchema).min(1).max(20_000),
    rendererPayload: rendererPayloadSchema,
    snapshotHash: sha256,
  })
  .strict();

export const roofSnapshotV1Schema = roofSnapshotV1ObjectSchema;
export const roofSnapshotV1SeedSchema = roofSnapshotV1ObjectSchema.omit({
  quality: true,
  rendererPayload: true,
  snapshotHash: true,
  totals: true,
});

export type RoofSnapshotV1 = z.infer<typeof roofSnapshotV1Schema>;
export type RoofSnapshotSeedV1 = z.infer<typeof roofSnapshotV1SeedSchema>;
export type RoofRendererPayloadV1 = z.infer<typeof rendererPayloadSchema>;
export type RoofMeasurementValueV1 = z.infer<typeof measurementValueSchema>;
export type RoofConfidenceV1 = z.infer<typeof confidenceSchema>;

export class UnsupportedRoofSnapshotVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`Unsupported roof snapshot version: ${String(version)}`);
    this.name = "UnsupportedRoofSnapshotVersionError";
  }
}

export class RoofSnapshotIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoofSnapshotIntegrityError";
  }
}

function digest(domain: string, value: unknown) {
  return canonicalSha256V1(value, domain);
}

function uniqueSorted(values: string[]) {
  return uniqueCanonicalStringsV1(values);
}

function canonicalRing(vertexIds: string[]) {
  const rotations = (values: string[]) =>
    values.map((_, index) => [
      ...values.slice(index),
      ...values.slice(0, index),
    ]);
  const candidates = [
    ...rotations(vertexIds),
    ...rotations([...vertexIds].reverse()),
  ];
  return candidates.sort((left, right) =>
    compareCanonicalStringsV1(left.join("\u0000"), right.join("\u0000")),
  )[0];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function canonicalRoofGeometryV1(
  geometry: RoofSnapshotV1["geometry"],
): RoofSnapshotV1["geometry"] {
  const value = clone(geometry);
  value.vertices.sort((left, right) =>
    compareCanonicalStringsV1(left.vertexId, right.vertexId),
  );
  value.contours = value.contours
    .map((contour) => ({
      ...contour,
      vertexIds: canonicalRing(contour.vertexIds),
      sourceRefs: uniqueSorted(contour.sourceRefs),
    }))
    .sort((left, right) =>
      compareCanonicalStringsV1(left.contourId, right.contourId),
    );
  value.surfaces = value.surfaces
    .map((surface) => ({
      ...surface,
      openingIds: uniqueSorted(surface.openingIds),
      edgeIds: uniqueSorted(surface.edgeIds),
      sourceRefs: uniqueSorted(surface.sourceRefs),
    }))
    .sort((left, right) =>
      compareCanonicalStringsV1(left.surfaceId, right.surfaceId),
    );
  value.edges = value.edges
    .map((edge) => ({
      ...edge,
      fromVertexId: [edge.fromVertexId, edge.toVertexId].sort(
        compareCanonicalStringsV1,
      )[0],
      toVertexId: [edge.fromVertexId, edge.toVertexId].sort(
        compareCanonicalStringsV1,
      )[1],
      adjacentSurfaceIds: uniqueSorted(edge.adjacentSurfaceIds),
      sourceRefs: uniqueSorted(edge.sourceRefs),
    }))
    .sort((left, right) =>
      compareCanonicalStringsV1(left.edgeId, right.edgeId),
    );
  value.openings.sort((left, right) =>
    compareCanonicalStringsV1(left.openingId, right.openingId),
  );
  value.obstacles.sort((left, right) =>
    compareCanonicalStringsV1(left.obstacleId, right.obstacleId),
  );
  return value;
}

function canonicalSnapshotContent(
  snapshot: Omit<RoofSnapshotV1, "snapshotHash">,
) {
  const value = clone(snapshot);
  value.geometry = canonicalRoofGeometryV1(value.geometry);
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
  value.manualCorrections.sort((left, right) => left.sequence - right.sequence);
  value.auditTrail.sort((left, right) => left.sequence - right.sequence);
  return value;
}

export function roofSnapshotHashV1(
  snapshot: Omit<RoofSnapshotV1, "snapshotHash">,
) {
  return digest(
    "takfornyelse:roof-snapshot:v1",
    canonicalSnapshotContent(snapshot),
  );
}

function unknownMeasurement(
  unit: RoofMeasurementValueV1["unit"],
  sourceRefs: string[] = [],
): RoofMeasurementValueV1 {
  return {
    mode: "unknown",
    unit,
    min: null,
    max: null,
    sourceRefs: uniqueSorted(sourceRefs),
    confidence: {
      level: "unknown",
      score: null,
      basis: "unknown",
      rationale: "No supported measurement is available",
    },
  };
}

function sumMeasurements(
  values: RoofMeasurementValueV1[],
  unit: RoofMeasurementValueV1["unit"],
): RoofMeasurementValueV1 {
  if (
    !values.length ||
    values.some(
      (value) =>
        value.mode === "unknown" || value.min === null || value.max === null,
    )
  ) {
    return unknownMeasurement(
      unit,
      values.flatMap((value) => value.sourceRefs),
    );
  }
  const roundDerived = (value: number) =>
    Math.round(value * 1_000_000_000) / 1_000_000_000;
  const min = roundDerived(
    values.reduce((sum, value) => sum + (value.min ?? 0), 0),
  );
  const max = roundDerived(
    values.reduce((sum, value) => sum + (value.max ?? 0), 0),
  );
  return {
    mode: min === max ? "exact" : "range",
    unit,
    min,
    max,
    sourceRefs: uniqueSorted(values.flatMap((value) => value.sourceRefs)),
    confidence: values.reduce((lowest, value) => {
      const rank = { unknown: 0, low: 1, medium: 2, high: 3 } as const;
      return rank[value.confidence.level] < rank[lowest.level]
        ? value.confidence
        : lowest;
    }, values[0].confidence),
  };
}

function deriveTotals(
  geometry: RoofSnapshotV1["geometry"],
): RoofSnapshotV1["totals"] {
  const boundaryEdges = geometry.edges.filter(
    (edge) => edge.adjacentSurfaceIds.length === 1,
  );
  const exactLength = (edges: RoofSnapshotV1["geometry"]["edges"]) =>
    sumMeasurements(
      edges.map((edge) => edge.length2d),
      "m",
    );
  return {
    grossHorizontalArea: sumMeasurements(
      geometry.surfaces.map((surface) => surface.grossHorizontalArea),
      "m2",
    ),
    grossSurfaceArea: sumMeasurements(
      geometry.surfaces.map((surface) => surface.grossSurfaceArea),
      "m2",
    ),
    netSurfaceArea: sumMeasurements(
      geometry.surfaces.map((surface) => surface.netSurfaceArea),
      "m2",
    ),
    footprintPerimeter: exactLength(boundaryEdges),
    eaveLength: exactLength(
      geometry.edges.filter((edge) => edge.type === "eave"),
    ),
    gutterCandidateLength: exactLength(
      geometry.edges.filter((edge) => edge.gutterCandidate),
    ),
    verifiedGutterLength: exactLength(
      geometry.edges.filter(
        (edge) => edge.gutterCandidate && edge.quality === "verified",
      ),
    ),
  };
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => (seen.has(value) ? true : !seen.add(value)));
}

function segmentsIntersect(
  a: { xM: number; yM: number },
  b: { xM: number; yM: number },
  c: { xM: number; yM: number },
  d: { xM: number; yM: number },
) {
  const orientation = (first: typeof a, second: typeof a, third: typeof a) =>
    (second.xM - first.xM) * (third.yM - first.yM) -
    (second.yM - first.yM) * (third.xM - first.xM);
  return (
    orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0
  );
}

function polygonSignedArea(points: { xM: number; yM: number }[]) {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.xM * next.yM - next.xM * point.yM;
    }, 0) / 2
  );
}

function measurementContains(
  value: RoofMeasurementValueV1,
  actual: number,
  tolerance: number,
) {
  if (value.mode === "unknown" || value.min === null || value.max === null)
    return true;
  return actual >= value.min - tolerance && actual <= value.max + tolerance;
}

function topologyFailures(seed: RoofSnapshotSeedV1) {
  const failures: string[] = [];
  const vertices = new Map(
    seed.geometry.vertices.map((vertex) => [vertex.vertexId, vertex]),
  );
  const contourIds = new Set(
    seed.geometry.contours.map((contour) => contour.contourId),
  );
  const surfaceIds = new Set(
    seed.geometry.surfaces.map((surface) => surface.surfaceId),
  );
  const edgeIds = new Set(seed.geometry.edges.map((edge) => edge.edgeId));
  const openingIds = new Set(
    seed.geometry.openings.map((opening) => opening.openingId),
  );
  const sourceIds = new Set(
    seed.provenance.sources.map((source) => source.sourceId),
  );
  const obstacleIds = new Set(
    seed.geometry.obstacles.map((obstacle) => obstacle.obstacleId),
  );
  const observationIds = new Set(
    seed.provenance.observations.map(
      (observation) => observation.observationId,
    ),
  );

  const duplicateIds = [
    ...duplicates(seed.geometry.vertices.map((item) => item.vertexId)),
    ...duplicates(seed.geometry.contours.map((item) => item.contourId)),
    ...duplicates(seed.geometry.surfaces.map((item) => item.surfaceId)),
    ...duplicates(seed.geometry.edges.map((item) => item.edgeId)),
    ...duplicates(seed.geometry.openings.map((item) => item.openingId)),
    ...duplicates(seed.geometry.obstacles.map((item) => item.obstacleId)),
    ...duplicates(seed.provenance.sources.map((item) => item.sourceId)),
    ...duplicates(
      seed.provenance.observations.map((item) => item.observationId),
    ),
  ];
  if (duplicateIds.length)
    failures.push(`duplicate_ids:${uniqueSorted(duplicateIds).join(".")}`);

  for (const contour of seed.geometry.contours) {
    if (new Set(contour.vertexIds).size < 3)
      failures.push(`contour_too_small:${contour.contourId}`);
    if (contour.vertexIds.some((id) => !vertices.has(id)))
      failures.push(`contour_vertex_missing:${contour.contourId}`);
    const points = contour.vertexIds
      .map((id) => vertices.get(id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    if (points.length === contour.vertexIds.length) {
      if (Math.abs(polygonSignedArea(points)) < 1e-9)
        failures.push(`contour_zero_area:${contour.contourId}`);
      if (
        contour.vertexIds.some(
          (vertexId, index) =>
            vertexId ===
            contour.vertexIds[(index + 1) % contour.vertexIds.length],
        )
      )
        failures.push(`contour_repeated_vertex:${contour.contourId}`);
    }
    for (let first = 0; first < points.length; first += 1) {
      const firstNext = (first + 1) % points.length;
      for (let second = first + 1; second < points.length; second += 1) {
        const secondNext = (second + 1) % points.length;
        if (first === second || firstNext === second || secondNext === first)
          continue;
        if (
          segmentsIntersect(
            points[first],
            points[firstNext],
            points[second],
            points[secondNext],
          )
        ) {
          failures.push(`contour_self_intersection:${contour.contourId}`);
        }
      }
    }
  }
  for (const surface of seed.geometry.surfaces) {
    if (!contourIds.has(surface.outerContourId))
      failures.push(`surface_contour_missing:${surface.surfaceId}`);
    if (surface.edgeIds.some((id) => !edgeIds.has(id)))
      failures.push(`surface_edge_missing:${surface.surfaceId}`);
    if (surface.openingIds.some((id) => !openingIds.has(id)))
      failures.push(`surface_opening_missing:${surface.surfaceId}`);
    for (const edgeId of surface.edgeIds) {
      const edge = seed.geometry.edges.find((item) => item.edgeId === edgeId);
      if (edge && !edge.adjacentSurfaceIds.includes(surface.surfaceId))
        failures.push(
          `surface_edge_not_reciprocal:${surface.surfaceId}:${edgeId}`,
        );
    }
    for (const openingId of surface.openingIds) {
      const opening = seed.geometry.openings.find(
        (item) => item.openingId === openingId,
      );
      if (opening && opening.surfaceId !== surface.surfaceId)
        failures.push(
          `surface_opening_not_reciprocal:${surface.surfaceId}:${openingId}`,
        );
    }
  }
  const edgePairs = new Map<string, string[]>();
  for (const edge of seed.geometry.edges) {
    if (!vertices.has(edge.fromVertexId) || !vertices.has(edge.toVertexId))
      failures.push(`edge_vertex_missing:${edge.edgeId}`);
    if (edge.fromVertexId === edge.toVertexId)
      failures.push(`edge_zero_length:${edge.edgeId}`);
    if (edge.adjacentSurfaceIds.some((id) => !surfaceIds.has(id)))
      failures.push(`edge_surface_missing:${edge.edgeId}`);
    for (const surfaceId of edge.adjacentSurfaceIds) {
      const surface = seed.geometry.surfaces.find(
        (item) => item.surfaceId === surfaceId,
      );
      if (surface && !surface.edgeIds.includes(edge.edgeId))
        failures.push(
          `edge_surface_not_reciprocal:${edge.edgeId}:${surfaceId}`,
        );
    }
    const pair = [edge.fromVertexId, edge.toVertexId]
      .sort(compareCanonicalStringsV1)
      .join("|");
    edgePairs.set(pair, [...(edgePairs.get(pair) ?? []), edge.edgeId]);
    const from = vertices.get(edge.fromVertexId);
    const to = vertices.get(edge.toVertexId);
    if (from && to) {
      const length2d = Math.hypot(to.xM - from.xM, to.yM - from.yM);
      const tolerance = Math.max(0.005, from.uncertaintyM + to.uncertaintyM);
      if (!measurementContains(edge.length2d, length2d, tolerance))
        failures.push(`edge_length2d_mismatch:${edge.edgeId}`);
      if (from.zM !== undefined && to.zM !== undefined) {
        const length3d = Math.hypot(
          to.xM - from.xM,
          to.yM - from.yM,
          to.zM - from.zM,
        );
        if (!measurementContains(edge.length3d, length3d, tolerance))
          failures.push(`edge_length3d_mismatch:${edge.edgeId}`);
      }
    }
  }
  for (const edgeIdsForPair of edgePairs.values()) {
    if (edgeIdsForPair.length > 1)
      failures.push(
        `duplicate_edge_pair:${edgeIdsForPair.sort(compareCanonicalStringsV1).join(".")}`,
      );
  }
  for (const opening of seed.geometry.openings) {
    if (!surfaceIds.has(opening.surfaceId))
      failures.push(`opening_surface_missing:${opening.openingId}`);
    if (!contourIds.has(opening.contourId))
      failures.push(`opening_contour_missing:${opening.openingId}`);
    const surface = seed.geometry.surfaces.find(
      (item) => item.surfaceId === opening.surfaceId,
    );
    if (surface && !surface.openingIds.includes(opening.openingId))
      failures.push(`opening_surface_not_reciprocal:${opening.openingId}`);
  }
  for (const obstacle of seed.geometry.obstacles) {
    if (obstacle.surfaceId && !surfaceIds.has(obstacle.surfaceId))
      failures.push(`obstacle_surface_missing:${obstacle.obstacleId}`);
    if (obstacle.contourId && !contourIds.has(obstacle.contourId))
      failures.push(`obstacle_contour_missing:${obstacle.obstacleId}`);
  }
  const allSourceRefs = [
    ...seed.geometry.vertices.flatMap((item) => item.sourceRefs),
    ...seed.geometry.contours.flatMap((item) => item.sourceRefs),
    ...seed.geometry.surfaces.flatMap((item) => [
      ...item.sourceRefs,
      ...item.pitch.sourceRefs,
      ...item.grossHorizontalArea.sourceRefs,
      ...item.grossSurfaceArea.sourceRefs,
      ...item.netSurfaceArea.sourceRefs,
    ]),
    ...seed.geometry.edges.flatMap((item) => [
      ...item.sourceRefs,
      ...item.length2d.sourceRefs,
      ...item.length3d.sourceRefs,
    ]),
    ...seed.geometry.openings.flatMap((item) => item.sourceRefs),
    ...seed.geometry.obstacles.flatMap((item) => item.sourceRefs),
    ...seed.provenance.observations.flatMap((item) => item.sourceRefs),
  ];
  if (allSourceRefs.some((id) => !sourceIds.has(id)))
    failures.push("source_reference_missing");

  const validObservationTargets = new Set([
    seed.snapshotId,
    ...surfaceIds,
    ...edgeIds,
    ...openingIds,
    ...obstacleIds,
    ...sourceIds,
  ]);
  for (const observation of seed.provenance.observations) {
    if (
      observation.kind !== "unknown" &&
      !validObservationTargets.has(observation.targetRef)
    )
      failures.push(`observation_target_missing:${observation.observationId}`);
  }
  const decision = seed.provenance.fusionDecision;
  const buckets = {
    accepted: new Set(decision.acceptedObservationIds),
    rejected: new Set(decision.rejectedObservationIds),
    conflicted: new Set(decision.conflictedObservationIds),
  };
  const decisionIds = [
    ...decision.acceptedObservationIds,
    ...decision.rejectedObservationIds,
    ...decision.conflictedObservationIds,
  ];
  if (decisionIds.some((id) => !observationIds.has(id)))
    failures.push("fusion_observation_missing");
  if (duplicates(decisionIds).length)
    failures.push("fusion_observation_bucket_overlap");
  for (const observation of seed.provenance.observations) {
    const memberships = (
      ["accepted", "rejected", "conflicted"] as const
    ).filter((status) => buckets[status].has(observation.observationId));
    if (
      (observation.status === "unknown" && memberships.length !== 0) ||
      (observation.status !== "unknown" &&
        (memberships.length !== 1 || memberships[0] !== observation.status))
    )
      failures.push(`fusion_status_mismatch:${observation.observationId}`);
  }
  return uniqueSorted(failures);
}

export function evaluateRoofSnapshotQualityV1(
  seed: RoofSnapshotSeedV1,
): RoofSnapshotV1["quality"] {
  const checks: RoofSnapshotV1["quality"]["checks"] = [];
  const add = (
    code: string,
    status: "pass" | "review_required" | "fail",
    message: string,
    entityRefs: string[] = [],
  ) =>
    checks.push({
      code,
      status,
      message,
      entityRefs: uniqueSorted(entityRefs),
    });

  if (seed.processing.status === "complete")
    add(
      "INGEST_STATUS",
      "pass",
      "All declared provider inputs were normalized",
    );
  else if (seed.processing.status === "partial")
    add(
      "INGEST_STATUS",
      "review_required",
      "Provider input is partial and requires review",
    );
  else
    add(
      "INGEST_STATUS",
      "fail",
      `Provider input state is ${seed.processing.status}`,
    );

  if (seed.geometry.surfaces.length)
    add("GEOMETRY_PRESENT", "pass", "At least one roof surface is present");
  else add("GEOMETRY_PRESENT", "fail", "No roof surface geometry is available");

  const topology = topologyFailures(seed);
  add(
    "TOPOLOGY_AND_REFERENCES",
    topology.length ? "fail" : "pass",
    topology.length
      ? topology.join("; ")
      : "Geometry and provenance references are internally consistent",
    topology,
  );

  const denied = seed.provenance.sources.filter(
    (source) =>
      source.license.status === "denied" ||
      source.quality.status === "rejected",
  );
  const uncertain = seed.provenance.sources.filter(
    (source) =>
      ["restricted", "unknown"].includes(source.license.status) ||
      ["limited", "unknown"].includes(source.quality.status),
  );
  if (denied.length)
    add(
      "SOURCE_LICENSE",
      "fail",
      "One or more sources are not authorized or usable",
      denied.map((source) => source.sourceId),
    );
  else if (uncertain.length)
    add(
      "SOURCE_LICENSE",
      "review_required",
      "One or more source licenses or suitability results require review",
      uncertain.map((source) => source.sourceId),
    );
  else
    add("SOURCE_LICENSE", "pass", "All sources have an authorized use status");

  const unknownEdges = seed.geometry.edges.filter(
    (edge) => edge.type === "unknown",
  );
  add(
    "EDGE_CLASSIFICATION",
    unknownEdges.length ? "review_required" : "pass",
    unknownEdges.length
      ? "Unknown edge types remain"
      : "All roof edges are classified",
    unknownEdges.map((edge) => edge.edgeId),
  );

  const conflicts = seed.provenance.observations.filter(
    (observation) => observation.status === "conflicted",
  );
  add(
    "EVIDENCE_CONFLICTS",
    conflicts.length ? "review_required" : "pass",
    conflicts.length
      ? "Conflicting evidence requires a decision"
      : "No unresolved evidence conflicts remain",
    conflicts.map((observation) => observation.observationId),
  );

  add(
    "MEASUREMENT_CONFIDENCE",
    seed.measurement.confidence.level === "unknown" ||
      seed.measurement.confidence.level === "low"
      ? "review_required"
      : "pass",
    `Measurement confidence is ${seed.measurement.confidence.level}`,
  );

  const status = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "review_required")
      ? "review_required"
      : "pass";
  return { status, checks };
}

function rendererHash(payload: Omit<RoofRendererPayloadV1, "renderHash">) {
  return digest("takfornyelse:roof-renderer:v1", payload);
}

function buildRendererPayload(
  seed: RoofSnapshotSeedV1,
  totals: RoofSnapshotV1["totals"],
): RoofRendererPayloadV1 {
  const payload: Omit<RoofRendererPayloadV1, "renderHash"> = {
    schemaVersion: ROOF_RENDERER_SCHEMA_VERSION,
    rendererVersion: seed.rendererVersion,
    units: {
      length: seed.units.length,
      area: seed.units.area,
      angle: seed.units.angle,
      precision: seed.units.precision,
    },
    coordinateSystem: seed.coordinateSystem,
    displayState: seed.state,
    measurementClass: seed.measurement.class,
    ...canonicalRoofGeometryV1(seed.geometry),
    totals: clone(totals),
    sources: seed.provenance.sources
      .filter((source) => source.visibility !== "internal")
      .map((source) => ({
        sourceId: source.sourceId,
        kind: source.kind,
        attribution: source.license.attribution,
        licenseStatus: source.license.status,
      }))
      .sort((left, right) =>
        compareCanonicalStringsV1(left.sourceId, right.sourceId),
      ),
  };
  return rendererPayloadSchema.parse({
    ...payload,
    renderHash: rendererHash(payload),
  });
}

function normalizeLifecycle(
  seed: RoofSnapshotSeedV1,
  quality: RoofSnapshotV1["quality"],
): RoofSnapshotSeedV1 {
  const normalized = clone(seed);
  if (
    quality.status === "fail" &&
    !["rejected", "superseded"].includes(normalized.state)
  )
    normalized.state = "blocked";
  if (
    normalized.state === "approved" &&
    normalized.approval.status !== "approved"
  ) {
    throw new TypeError(
      "Approved snapshot state requires approved approval metadata",
    );
  }
  if (
    normalized.state !== "approved" &&
    normalized.approval.status === "approved"
  ) {
    throw new TypeError(
      "Approved approval metadata requires approved snapshot state",
    );
  }
  if (normalized.state === "approved" && quality.status === "fail") {
    throw new TypeError(
      "A snapshot with failed quality gates cannot be approved",
    );
  }
  return normalized;
}

function finalizeRoofSnapshot(seedInput: RoofSnapshotSeedV1): RoofSnapshotV1 {
  const parsedSeed = roofSnapshotV1SeedSchema.parse(
    canonicalizeJsonValueV1(seedInput),
  );
  const quality = evaluateRoofSnapshotQualityV1(parsedSeed);
  const seed = normalizeLifecycle(parsedSeed, quality);
  const totals = deriveTotals(seed.geometry);
  const rendererPayload = buildRendererPayload(seed, totals);
  const withoutHash: Omit<RoofSnapshotV1, "snapshotHash"> = {
    ...seed,
    totals,
    quality,
    rendererPayload,
  };
  return roofSnapshotV1Schema.parse({
    ...withoutHash,
    snapshotHash: roofSnapshotHashV1(withoutHash),
  });
}

export function buildRoofSnapshotV1(seed: RoofSnapshotSeedV1) {
  return finalizeRoofSnapshot(seed);
}

function stripDerived(snapshot: RoofSnapshotV1): RoofSnapshotSeedV1 {
  const {
    quality: _quality,
    rendererPayload: _renderer,
    snapshotHash: _hash,
    totals: _totals,
    ...seed
  } = snapshot;
  void _quality;
  void _renderer;
  void _hash;
  void _totals;
  return seed;
}

function assertDerivedParity(snapshot: RoofSnapshotV1) {
  const rebuilt = finalizeRoofSnapshot(stripDerived(snapshot));
  if (canonicalJsonV1(rebuilt.totals) !== canonicalJsonV1(snapshot.totals)) {
    throw new RoofSnapshotIntegrityError(
      "Roof snapshot totals do not match its geometry",
    );
  }
  if (canonicalJsonV1(rebuilt.quality) !== canonicalJsonV1(snapshot.quality)) {
    throw new RoofSnapshotIntegrityError(
      "Roof snapshot quality gates do not match its content",
    );
  }
  if (
    canonicalJsonV1(rebuilt.rendererPayload) !==
    canonicalJsonV1(snapshot.rendererPayload)
  ) {
    throw new RoofSnapshotIntegrityError(
      "Roof renderer payload has drifted from the canonical snapshot",
    );
  }
}

export function parseRoofSnapshotV1(value: unknown): RoofSnapshotV1 {
  const version =
    value && typeof value === "object"
      ? (value as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (version !== ROOF_SNAPSHOT_SCHEMA_VERSION)
    throw new UnsupportedRoofSnapshotVersionError(version);
  const parsed = roofSnapshotV1Schema.parse(value);
  const { snapshotHash, ...withoutHash } = parsed;
  if (roofSnapshotHashV1(withoutHash) !== snapshotHash) {
    throw new RoofSnapshotIntegrityError("Roof snapshot content hash mismatch");
  }
  assertDerivedParity(parsed);
  return parsed;
}

export function serializeRoofSnapshotV1(value: RoofSnapshotV1) {
  return canonicalJsonV1(parseRoofSnapshotV1(value));
}

export const roofSnapshotApprovalCommandV1Schema = z
  .object({
    schemaVersion: z.literal("roof-snapshot-approval-command.v1"),
    expectedSnapshotHash: sha256,
    idempotencyKey: z.string().trim().min(8).max(300),
    actor: actorSchema,
    approvedAt: timestamp,
    reviewReason: z.string().trim().min(5).max(1_000).optional(),
  })
  .strict();
export type RoofSnapshotApprovalCommandV1 = z.infer<
  typeof roofSnapshotApprovalCommandV1Schema
>;

export function approveRoofSnapshotV1(
  snapshotInput: RoofSnapshotV1,
  commandInput: RoofSnapshotApprovalCommandV1,
) {
  const snapshot = parseRoofSnapshotV1(snapshotInput);
  const command = roofSnapshotApprovalCommandV1Schema.parse(commandInput);
  const repeated = snapshot.auditTrail.some(
    (event) =>
      event.eventType === "approved" &&
      event.idempotencyKey === command.idempotencyKey,
  );
  if (repeated) return snapshot;
  if (snapshot.state === "approved")
    throw new TypeError("Approved roof snapshots are immutable");
  if (["rejected", "superseded"].includes(snapshot.state))
    throw new TypeError(`Cannot approve a ${snapshot.state} roof snapshot`);
  if (snapshot.snapshotHash !== command.expectedSnapshotHash)
    throw new RoofSnapshotIntegrityError("Roof snapshot changed after review");
  if (snapshot.quality.status === "fail")
    throw new TypeError("Roof snapshot quality gates failed");
  if (snapshot.quality.status === "review_required" && !command.reviewReason) {
    throw new TypeError(
      "Approval of a review-required snapshot needs a review reason",
    );
  }
  const seed = stripDerived(snapshot);
  seed.state = "approved";
  seed.approval = {
    status: "approved",
    approvedBy: command.actor,
    approvedAt: command.approvedAt,
    reviewReason: command.reviewReason,
  };
  seed.auditTrail.push({
    sequence: Math.max(...seed.auditTrail.map((event) => event.sequence)) + 1,
    eventType: "approved",
    occurredAt: command.approvedAt,
    actor: command.actor,
    idempotencyKey: command.idempotencyKey,
    details: { reviewedSnapshotHash: snapshot.snapshotHash },
  });
  return finalizeRoofSnapshot(seed);
}

export const roofSnapshotCorrectionCommandV1Schema = z.discriminatedUnion(
  "correctionType",
  [
    z
      .object({
        schemaVersion: z.literal("roof-snapshot-correction-command.v1"),
        correctionType: z.literal("edge_type"),
        edgeId: identifier,
        value: edgeType,
        newSnapshotId: identifier,
        expectedSnapshotHash: sha256,
        idempotencyKey: z.string().trim().min(8).max(300),
        actor: actorSchema,
        correctedAt: timestamp,
        reason: z.string().trim().min(5).max(1_000),
        sourceRefs: z.array(identifier).min(1).max(100),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal("roof-snapshot-correction-command.v1"),
        correctionType: z.literal("edge_gutter_candidate"),
        edgeId: identifier,
        value: z.boolean(),
        newSnapshotId: identifier,
        expectedSnapshotHash: sha256,
        idempotencyKey: z.string().trim().min(8).max(300),
        actor: actorSchema,
        correctedAt: timestamp,
        reason: z.string().trim().min(5).max(1_000),
        sourceRefs: z.array(identifier).min(1).max(100),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal("roof-snapshot-correction-command.v1"),
        correctionType: z.literal("surface_pitch"),
        surfaceId: identifier,
        value: measurementValueSchema,
        newSnapshotId: identifier,
        expectedSnapshotHash: sha256,
        idempotencyKey: z.string().trim().min(8).max(300),
        actor: actorSchema,
        correctedAt: timestamp,
        reason: z.string().trim().min(5).max(1_000),
        sourceRefs: z.array(identifier).min(1).max(100),
      })
      .strict(),
  ],
);
export type RoofSnapshotCorrectionCommandV1 = z.infer<
  typeof roofSnapshotCorrectionCommandV1Schema
>;

function surfaceAreaForPitch(
  surface: RoofSnapshotV1["geometry"]["surfaces"][number],
) {
  const { grossHorizontalArea, pitch } = surface;
  if (
    grossHorizontalArea.min === null ||
    grossHorizontalArea.max === null ||
    pitch.min === null ||
    pitch.max === null
  ) {
    return unknownMeasurement("m2", [
      ...grossHorizontalArea.sourceRefs,
      ...pitch.sourceRefs,
    ]);
  }
  const lower = grossHorizontalArea.min / Math.cos((pitch.min * Math.PI) / 180);
  const upper = grossHorizontalArea.max / Math.cos((pitch.max * Math.PI) / 180);
  return {
    mode: lower === upper ? ("exact" as const) : ("range" as const),
    unit: "m2" as const,
    min: lower,
    max: upper,
    sourceRefs: uniqueSorted([
      ...grossHorizontalArea.sourceRefs,
      ...pitch.sourceRefs,
    ]),
    confidence: pitch.confidence,
  };
}

export function applyRoofSnapshotCorrectionV1(
  snapshotInput: RoofSnapshotV1,
  commandInput: RoofSnapshotCorrectionCommandV1,
) {
  const snapshot = parseRoofSnapshotV1(snapshotInput);
  const command = roofSnapshotCorrectionCommandV1Schema.parse(commandInput);
  const repeated = snapshot.manualCorrections.some(
    (correction) => correction.idempotencyKey === command.idempotencyKey,
  );
  if (repeated) return snapshot;
  if (["approved", "rejected", "superseded"].includes(snapshot.state))
    throw new TypeError(
      "Final roof snapshots are immutable; correct a new version instead",
    );
  if (snapshot.snapshotHash !== command.expectedSnapshotHash)
    throw new RoofSnapshotIntegrityError(
      "Roof snapshot changed before correction",
    );
  const sourceIds = new Set(
    snapshot.provenance.sources.map((source) => source.sourceId),
  );
  if (command.sourceRefs.some((sourceRef) => !sourceIds.has(sourceRef)))
    throw new TypeError("Manual correction references an unknown source");

  const seed = stripDerived(snapshot);
  let targetType: "surface" | "edge" = "edge";
  let targetId: string;
  let path: string;
  let before: JsonValue;
  let after: JsonValue;
  if (command.correctionType === "surface_pitch") {
    const surface = seed.geometry.surfaces.find(
      (candidate) => candidate.surfaceId === command.surfaceId,
    );
    if (!surface) throw new TypeError("Corrected roof surface was not found");
    if (command.value.unit !== "deg")
      throw new TypeError("Surface pitch correction must use degrees");
    targetType = "surface";
    targetId = surface.surfaceId;
    path = "pitch";
    before = clone(surface.pitch) as JsonValue;
    surface.pitch = command.value;
    surface.grossSurfaceArea = surfaceAreaForPitch(surface);
    const openingAreas = seed.geometry.openings
      .filter((opening) => opening.surfaceId === surface.surfaceId)
      .map((opening) => opening.surfaceArea);
    const openings = sumMeasurements(openingAreas, "m2");
    if (
      surface.grossSurfaceArea.min === null ||
      surface.grossSurfaceArea.max === null ||
      (openingAreas.length && (openings.min === null || openings.max === null))
    ) {
      surface.netSurfaceArea = unknownMeasurement("m2", [
        ...surface.grossSurfaceArea.sourceRefs,
        ...openings.sourceRefs,
      ]);
    } else {
      const minimum = Math.max(
        0,
        surface.grossSurfaceArea.min - (openings.max ?? 0),
      );
      const maximum = Math.max(
        minimum,
        surface.grossSurfaceArea.max - (openings.min ?? 0),
      );
      surface.netSurfaceArea = {
        mode: minimum === maximum ? "exact" : "range",
        unit: "m2",
        min: minimum,
        max: maximum,
        sourceRefs: uniqueSorted([
          ...surface.grossSurfaceArea.sourceRefs,
          ...openings.sourceRefs,
        ]),
        confidence: surface.grossSurfaceArea.confidence,
      };
    }
    surface.sourceRefs = uniqueSorted([
      ...surface.sourceRefs,
      ...command.sourceRefs,
    ]);
    after = clone(surface.pitch) as JsonValue;
  } else {
    const edge = seed.geometry.edges.find(
      (candidate) => candidate.edgeId === command.edgeId,
    );
    if (!edge) throw new TypeError("Corrected roof edge was not found");
    targetId = edge.edgeId;
    if (command.correctionType === "edge_type") {
      path = "type";
      before = edge.type;
      edge.type = command.value;
      after = edge.type;
    } else {
      path = "gutterCandidate";
      before = edge.gutterCandidate;
      edge.gutterCandidate = command.value;
      after = edge.gutterCandidate;
    }
    edge.sourceRefs = uniqueSorted([...edge.sourceRefs, ...command.sourceRefs]);
  }

  seed.supersedesSnapshotId = snapshot.snapshotId;
  seed.snapshotId = command.newSnapshotId;
  seed.revision = snapshot.revision + 1;
  seed.state = "review_required";
  seed.approval = { status: "pending" };
  seed.generatedAt = command.correctedAt;
  seed.manualCorrections.push({
    correctionId: `correction-${seed.revision}-${seed.manualCorrections.length + 1}`,
    sequence: seed.manualCorrections.length + 1,
    targetType,
    targetId,
    path,
    before,
    after,
    reason: command.reason,
    sourceRefs: command.sourceRefs,
    actor: command.actor,
    correctedAt: command.correctedAt,
    idempotencyKey: command.idempotencyKey,
  });
  seed.auditTrail.push({
    sequence: Math.max(...seed.auditTrail.map((event) => event.sequence)) + 1,
    eventType: "manual_correction_applied",
    occurredAt: command.correctedAt,
    actor: command.actor,
    idempotencyKey: command.idempotencyKey,
    details: {
      previousSnapshotHash: snapshot.snapshotHash,
      targetType,
      targetId,
      path,
    },
  });
  return finalizeRoofSnapshot(seed);
}

export function approvedRoofRendererPayloadV1(
  snapshotInput: RoofSnapshotV1,
  expectedSnapshotHash?: string,
) {
  const snapshot = parseRoofSnapshotV1(snapshotInput);
  if (
    snapshot.state !== "approved" ||
    snapshot.approval.status !== "approved"
  ) {
    throw new TypeError(
      "Only an approved roof snapshot can be rendered downstream",
    );
  }
  if (expectedSnapshotHash && snapshot.snapshotHash !== expectedSnapshotHash) {
    throw new RoofSnapshotIntegrityError(
      "Approved roof snapshot hash does not match the reviewed version",
    );
  }
  return {
    schemaVersion: "approved-roof-renderer-envelope.v1" as const,
    snapshotId: snapshot.snapshotId,
    snapshotRevision: snapshot.revision,
    sourceSnapshotHash: snapshot.snapshotHash,
    approval: snapshot.approval,
    payload: snapshot.rendererPayload,
  };
}
