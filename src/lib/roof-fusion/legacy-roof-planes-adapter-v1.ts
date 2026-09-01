import { measureRoofPlanes } from "@/lib/measurements/geometry";
import { roofProposalSchema } from "@/lib/measurements/proposal";
import type { GeoPoint } from "@/lib/measurements/types";
import {
  canonicalSha256V1,
  canonicalizeJsonValueV1,
  compareCanonicalStringsV1,
} from "./canonicalization-v1";
import {
  buildRoofSourceResultV1,
  roofSourceRequestV1Schema,
  type RoofSourceRequestV1,
  type RoofSourceResultV1,
} from "./source-adapter-v1";

export const LEGACY_ROOF_PLANES_INPUT_VERSION =
  "legacy-roof-proposal.v1" as const;
export const LEGACY_ROOF_PLANES_ADAPTER_ID =
  "legacy-roof-planes-adapter" as const;
export const LEGACY_ROOF_PLANES_ADAPTER_VERSION =
  "legacy-roof-planes-adapter.v1" as const;

type NormalizedContent = NonNullable<RoofSourceResultV1["normalized"]>;
type Geometry = NormalizedContent["geometry"];

export type LegacyRoofPlanesSourceV1 = {
  sourceId: string;
  provider: string;
  providerObjectId?: string;
  capturedAt?: string;
  retrievedAt: string;
  license: {
    status: "authorized" | "restricted" | "denied" | "unknown";
    name: string;
    attribution: string;
    termsVersion?: string;
  };
  visibility: "internal" | "customer_safe" | "derived_only";
  quality: {
    status: "usable" | "limited" | "rejected" | "unknown";
    score: number | null;
    reasons: string[];
  };
};

export type LegacyRoofPlanesAdapterInputV1 = {
  proposal: unknown;
  source: LegacyRoofPlanesSourceV1;
  normalizedBy: NormalizedContent["provenance"]["fusionDecision"]["decidedBy"];
  decidedAt: string;
};

function hash(value: unknown) {
  return canonicalSha256V1(value);
}

function safeId(prefix: string, value: string) {
  const readable = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return `${prefix}-${readable || "legacy"}-${hash(value).slice(0, 10)}`;
}

function origin(points: GeoPoint[]) {
  if (!points.length) return undefined;
  return {
    latitude:
      points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude:
      points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
  };
}

function confidence(level: "high" | "medium" | "low", rationale: string) {
  return {
    level,
    score: level === "high" ? 0.9 : level === "medium" ? 0.65 : 0.35,
    basis: "provider_reported" as const,
    rationale,
  };
}

function exact(
  unit: "m" | "m2",
  value: number,
  sourceId: string,
  rationale: string,
) {
  return {
    mode: "exact" as const,
    unit,
    min: value,
    max: value,
    sourceRefs: [sourceId],
    confidence: confidence("medium", rationale),
  };
}

function unknownLength(sourceId: string) {
  return {
    mode: "unknown" as const,
    unit: "m" as const,
    min: null,
    max: null,
    sourceRefs: [sourceId],
    confidence: {
      level: "unknown" as const,
      score: null,
      basis: "unknown" as const,
      rationale:
        "Legacy footprint geometry does not prove three-dimensional edge length",
    },
  };
}

function normalizeGeometry(
  proposal: ReturnType<typeof roofProposalSchema.parse>,
  sourceId: string,
) {
  const calculated = measureRoofPlanes(proposal.roofPlanes);
  const allPoints = proposal.roofPlanes.flatMap((plane) => plane.polygon);
  const anchor = origin(allPoints);
  const longitudeMeters = anchor
    ? 111_320 * Math.max(Math.cos((anchor.latitude * Math.PI) / 180), 0.1)
    : 111_320;
  const vertexByCoordinate = new Map<string, Geometry["vertices"][number]>();
  const localVertex = (point: GeoPoint) => {
    const key = `${point.latitude.toFixed(9)}:${point.longitude.toFixed(9)}`;
    const existing = vertexByCoordinate.get(key);
    if (existing) return existing;
    const vertex = {
      vertexId: `vertex-${hash(key).slice(0, 16)}`,
      xM: anchor ? (point.longitude - anchor.longitude) * longitudeMeters : 0,
      yM: anchor ? (point.latitude - anchor.latitude) * 111_320 : 0,
      uncertaintyM: 0.75,
      sourceRefs: [sourceId],
    };
    vertexByCoordinate.set(key, vertex);
    return vertex;
  };

  const measuredById = new Map(
    calculated.planes.map((plane) => [plane.id, plane]),
  );
  const surfaceAreas = proposal.roofPlanes.map((plane) => {
    const measured = measuredById.get(plane.id);
    if (!measured)
      throw new TypeError(`Legacy calculation omitted roof plane ${plane.id}`);
    return {
      plane,
      measured,
      horizontal: measured.horizontalAreaTenths / 10,
      minimum: measured.actualAreaMinTenths / 10,
      maximum: measured.actualAreaMaxTenths / 10,
    };
  });
  const last = surfaceAreas.at(-1);
  if (last) {
    last.horizontal +=
      calculated.horizontalAreaTenths / 10 -
      surfaceAreas.reduce((sum, item) => sum + item.horizontal, 0);
    last.minimum +=
      calculated.actualAreaMinTenths / 10 -
      surfaceAreas.reduce((sum, item) => sum + item.minimum, 0);
    last.maximum +=
      calculated.actualAreaMaxTenths / 10 -
      surfaceAreas.reduce((sum, item) => sum + item.maximum, 0);
  }

  const contours: Geometry["contours"] = [];
  const surfaces: Geometry["surfaces"] = [];
  const edges = new Map<string, Geometry["edges"][number]>();
  const observations: NormalizedContent["provenance"]["observations"] = [];

  for (const item of surfaceAreas) {
    const surfaceId = safeId("surface", item.plane.id);
    const contourId = safeId("contour", item.plane.id);
    const vertexIds = item.plane.polygon.map(
      (point) => localVertex(point).vertexId,
    );
    contours.push({
      contourId,
      kind: "surface_boundary",
      vertexIds,
      sourceRefs: [sourceId],
    });
    const edgeIds: string[] = [];
    for (let index = 0; index < vertexIds.length; index += 1) {
      const fromVertexId = vertexIds[index];
      const toVertexId = vertexIds[(index + 1) % vertexIds.length];
      const edgeKey = [fromVertexId, toVertexId]
        .sort(compareCanonicalStringsV1)
        .join(":");
      const edgeId = `edge-${hash(edgeKey).slice(0, 16)}`;
      edgeIds.push(edgeId);
      const existing = edges.get(edgeKey);
      if (existing) {
        existing.adjacentSurfaceIds.push(surfaceId);
        continue;
      }
      const from = [...vertexByCoordinate.values()].find(
        (vertex) => vertex.vertexId === fromVertexId,
      );
      const to = [...vertexByCoordinate.values()].find(
        (vertex) => vertex.vertexId === toVertexId,
      );
      if (!from || !to)
        throw new TypeError("Legacy edge references an unknown vertex");
      const length2d = Math.hypot(to.xM - from.xM, to.yM - from.yM);
      edges.set(edgeKey, {
        edgeId,
        fromVertexId,
        toVertexId,
        adjacentSurfaceIds: [surfaceId],
        type: "unknown",
        length2d: exact(
          "m",
          length2d,
          sourceId,
          "Length projected from the legacy WGS84 footprint",
        ),
        length3d: unknownLength(sourceId),
        gutterCandidate: false,
        quality: "unknown",
        sourceRefs: [sourceId],
      });
    }

    const pitchMode: "exact" | "range" =
      item.plane.angleMinDegrees === item.plane.angleMaxDegrees
        ? "exact"
        : "range";
    const pitch = {
      mode: pitchMode,
      unit: "deg" as const,
      min: item.plane.angleMinDegrees,
      max: item.plane.angleMaxDegrees,
      sourceRefs: [sourceId],
      confidence: confidence(proposal.confidence, proposal.confidenceReasoning),
    };
    const areaConfidence = confidence(
      proposal.confidence,
      "Legacy area retained at the existing engine's 0.1 m² compatibility precision",
    );
    const grossHorizontalArea = {
      mode: "exact" as const,
      unit: "m2" as const,
      min: item.horizontal,
      max: item.horizontal,
      sourceRefs: [sourceId],
      confidence: areaConfidence,
    };
    const grossSurfaceArea = {
      mode:
        item.minimum === item.maximum ? ("exact" as const) : ("range" as const),
      unit: "m2" as const,
      min: item.minimum,
      max: item.maximum,
      sourceRefs: [sourceId],
      confidence: areaConfidence,
    };
    surfaces.push({
      surfaceId,
      outerContourId: contourId,
      openingIds: [],
      edgeIds,
      azimuthDegrees: null,
      pitch,
      grossHorizontalArea,
      grossSurfaceArea,
      netSurfaceArea: { ...grossSurfaceArea },
      quality: proposal.confidence === "low" ? "conflicted" : "estimated",
      sourceRefs: [sourceId],
    });
    observations.push(
      {
        observationId: safeId("observation-pitch", item.plane.id),
        kind: "surface_pitch",
        targetRef: surfaceId,
        value: {
          minimumDegrees: item.plane.angleMinDegrees,
          maximumDegrees: item.plane.angleMaxDegrees,
        },
        status: proposal.confidence === "low" ? "conflicted" : "accepted",
        sourceRefs: [sourceId],
        confidence: pitch.confidence,
        reasons: [proposal.confidenceReasoning],
      },
      {
        observationId: safeId("observation-area", item.plane.id),
        kind: "surface_area",
        targetRef: surfaceId,
        value: {
          horizontalAreaM2: item.horizontal,
          surfaceAreaMinimumM2: item.minimum,
          surfaceAreaMaximumM2: item.maximum,
        },
        status: proposal.confidence === "low" ? "conflicted" : "accepted",
        sourceRefs: [sourceId],
        confidence: areaConfidence,
        reasons: [
          "Calculated with the existing deterministic legacy geometry engine",
        ],
      },
    );
  }

  const normalized: NormalizedContent = {
    coordinateSystem: {
      kind: "local_cartesian",
      reference: "EPSG:4326 local tangent approximation (legacy compatibility)",
      axisOrder: "x_east_y_north_z_up",
      origin: anchor,
    },
    geometry: {
      vertices: [...vertexByCoordinate.values()],
      contours,
      surfaces,
      edges: [...edges.values()],
      openings: [],
      obstacles: [],
    },
    provenance: {
      sources: [],
      observations,
      fusionDecision: {
        decisionId: "placeholder",
        policyVersion: "legacy-roof-compatibility.v1",
        acceptedObservationIds: observations
          .filter((observation) => observation.status === "accepted")
          .map((observation) => observation.observationId),
        rejectedObservationIds: [],
        conflictedObservationIds: observations
          .filter((observation) => observation.status === "conflicted")
          .map((observation) => observation.observationId),
        decidedAt: "1970-01-01T00:00:00.000Z",
        decidedBy: {
          actorId: "legacy-adapter",
          actorType: "system",
        },
        rationale:
          "Legacy geometry was normalized without inventing facet or edge semantics",
      },
    },
    measurement: {
      method: "legacy_footprint_slope_band",
      class: "preliminary",
      confidence: confidence(proposal.confidence, proposal.confidenceReasoning),
    },
  };
  return { normalized, calculated };
}

export function legacyRoofPlanesToSourceResultV1(
  requestInput: RoofSourceRequestV1,
  input: LegacyRoofPlanesAdapterInputV1,
) {
  const request = roofSourceRequestV1Schema.parse(
    canonicalizeJsonValueV1(requestInput),
  );
  if (
    request.adapterId !== LEGACY_ROOF_PLANES_ADAPTER_ID ||
    request.expectedInputVersion !== LEGACY_ROOF_PLANES_INPUT_VERSION
  ) {
    throw new TypeError(
      "Legacy roof request targets an unsupported adapter contract",
    );
  }
  const proposal = roofProposalSchema.parse(input.proposal);
  const rawContentHash = hash({
    proposal,
    source: input.source,
  });
  const { normalized } = normalizeGeometry(proposal, input.source.sourceId);
  normalized.provenance.sources = [
    {
      sourceId: input.source.sourceId,
      kind: "legacy",
      provider: input.source.provider,
      providerObjectId: input.source.providerObjectId,
      inputSchemaVersion: LEGACY_ROOF_PLANES_INPUT_VERSION,
      adapterVersion: LEGACY_ROOF_PLANES_ADAPTER_VERSION,
      capturedAt: input.source.capturedAt,
      retrievedAt: input.source.retrievedAt,
      rawContentHash,
      license: input.source.license,
      visibility: input.source.visibility,
      quality: input.source.quality,
    },
  ];
  normalized.provenance.fusionDecision = {
    ...normalized.provenance.fusionDecision,
    decisionId: `fusion-${request.targetSnapshotId}`,
    decidedAt: input.decidedAt,
    decidedBy: input.normalizedBy,
  };

  return buildRoofSourceResultV1({
    schemaVersion: "roof-source-result.v1",
    status: proposal.roofPlanes.length ? "partial" : "empty",
    adapterId: LEGACY_ROOF_PLANES_ADAPTER_ID,
    adapterVersion: LEGACY_ROOF_PLANES_ADAPTER_VERSION,
    provider: input.source.provider,
    providerInputVersion: LEGACY_ROOF_PLANES_INPUT_VERSION,
    providerRequestId: input.source.providerObjectId,
    requestInputHash: request.inputHash,
    idempotencyKey: request.idempotencyKey,
    receivedAt: input.source.retrievedAt,
    rawContentHash,
    sourceRecords: normalized.provenance.sources,
    issues: proposal.roofPlanes.length
      ? [
          {
            code: "LEGACY_EDGE_SEMANTICS_UNKNOWN",
            severity: "warning",
            message:
              "Legacy roof polygons preserve area and pitch but do not prove roof edge classifications",
            retryable: false,
            sourceRef: input.source.sourceId,
          },
        ]
      : [
          {
            code: "LEGACY_ROOF_PLANES_EMPTY",
            severity: "error",
            message: "Legacy proposal contains no roof plane geometry",
            retryable: false,
            sourceRef: input.source.sourceId,
          },
        ],
    normalized: proposal.roofPlanes.length ? normalized : undefined,
  });
}
