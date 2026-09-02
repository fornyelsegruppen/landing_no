import type { AddressCandidate } from "@/lib/providers/contracts";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import { canonicalSha256V1 } from "./canonicalization-v1";
import {
  calculateRoofGeometryV1,
  ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
  ROOF_GEOMETRY_SOURCE_ADAPTER_ID,
  roofGeometryCalculationToSourceResultV1,
  type RoofGeometryInputV1,
} from "./geometry-calculation-v1";
import {
  buildRoofSourceRequestV1,
  roofSourceResultToSnapshotV1,
} from "./source-adapter-v1";

export const ROOF_FUSION_OSM_PREVIEW_SCHEMA_VERSION =
  "roof-fusion-osm-preview.v1" as const;

export const ROOF_FUSION_OSM_PREVIEW_BLOCKERS = [
  "ROOF_PLANES_REQUIRED",
  "ROOF_PITCH_REQUIRED",
  "LICENSED_IMAGERY_REQUIRED",
] as const;

export type RoofFusionOsmPreviewBlocker =
  (typeof ROOF_FUSION_OSM_PREVIEW_BLOCKERS)[number];

export type RoofFusionOsmFootprintPreviewSummaryV1 = {
  schemaVersion: typeof ROOF_FUSION_OSM_PREVIEW_SCHEMA_VERSION;
  candidateId: string;
  contractStatus: "valid";
  reviewState: "review_required";
  qualityStatus: "review_required";
  measurementClass: "preliminary";
  pricingReady: false;
  blockers: RoofFusionOsmPreviewBlocker[];
  engineHorizontalAreaSquareMeters: number;
  providerHorizontalAreaSquareMeters: number;
  areaDeltaPercent: number;
  footprintPerimeterMeters: number;
  calculationHash: string;
  snapshotHash: string;
  renderHash: string;
};

const EARTH_RADIUS_METERS = 6_378_137;

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function samePoint(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  return left.latitude === right.latitude && left.longitude === right.longitude;
}

function normalizedPolygon(candidate: BuildingFootprintCandidate) {
  const polygon = candidate.polygon.filter(
    (point, index, points) =>
      index === 0 || !samePoint(point, points[index - 1]),
  );
  if (
    polygon.length > 1 &&
    samePoint(polygon[0], polygon[polygon.length - 1])
  ) {
    polygon.pop();
  }
  if (polygon.length < 3) {
    throw new TypeError("OSM footprint needs at least three distinct vertices");
  }
  return polygon;
}

function uncertaintyFor(candidate: BuildingFootprintCandidate) {
  if (candidate.confidence === "high") return 1.5;
  if (candidate.confidence === "medium") return 3;
  return 8;
}

function confidenceScore(candidate: BuildingFootprintCandidate) {
  if (candidate.confidence === "high") return 0.58;
  if (candidate.confidence === "medium") return 0.42;
  return 0.25;
}

function exactValue(value: { min: number | null; max: number | null }) {
  if (value.min === null || value.max === null || value.min !== value.max) {
    throw new TypeError("Roof Fusion Preview expected an exact derived value");
  }
  return value.min;
}

export function buildRoofFusionOsmFootprintPreviewV1(input: {
  address: AddressCandidate;
  candidate: BuildingFootprintCandidate;
  retrievedAt: string;
}) {
  const { address, candidate, retrievedAt } = input;
  const points = normalizedPolygon(candidate);
  const fingerprint = canonicalSha256V1(
    {
      address: {
        id: address.id,
        latitude: address.latitude,
        longitude: address.longitude,
      },
      candidate: {
        id: candidate.id,
        polygon: points,
      },
    },
    "takfornyelse:roof-fusion-osm-preview-identity:v1",
  ).slice(0, 20);
  const addressSourceId = `src-address-${fingerprint}`;
  const footprintSourceId = `src-footprint-${fingerprint}`;
  const surfaceId = `surface-footprint-${fingerprint}`;
  const contourId = `contour-footprint-${fingerprint}`;
  const observationId = `obs-footprint-${fingerprint}`;
  const calculationId = `calc-osm-footprint-${fingerprint}`;
  const uncertaintyM = uncertaintyFor(candidate);
  const cosine = Math.max(Math.cos((address.latitude * Math.PI) / 180), 0.1);
  const vertices = points.map((point, index) => ({
    vertexId: `v-${fingerprint}-${index + 1}`,
    xM:
      EARTH_RADIUS_METERS *
      (((point.longitude - address.longitude) * Math.PI) / 180) *
      cosine,
    yM:
      EARTH_RADIUS_METERS *
      (((point.latitude - address.latitude) * Math.PI) / 180),
    zM: 0,
    uncertaintyM,
    sourceRefs: [footprintSourceId],
  }));
  const edgeIds = vertices.map(
    (_, index) => `edge-footprint-${fingerprint}-${index + 1}`,
  );
  const score = confidenceScore(candidate);
  const geometryInput: RoofGeometryInputV1 = {
    schemaVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    calculationId,
    coordinateSystem: {
      kind: "local_cartesian",
      reference: "EPSG:4326 tangent plane at Kartverket address anchor",
      axisOrder: "x_east_y_north_z_up",
      origin: {
        latitude: address.latitude,
        longitude: address.longitude,
      },
    },
    vertices,
    surfaces: [
      {
        surfaceId,
        contourId,
        vertexIds: vertices.map(({ vertexId }) => vertexId),
        edgeIds,
        quality: "estimated",
        sourceRefs: [footprintSourceId],
      },
    ],
    openings: [],
    obstacles: [],
    provenance: {
      sources: [
        {
          sourceId: addressSourceId,
          kind: "address_anchor",
          provider: "Kartverket",
          providerObjectId: address.id,
          inputSchemaVersion: "kartverket-address-candidate.v1",
          adapterVersion: ROOF_FUSION_OSM_PREVIEW_SCHEMA_VERSION,
          retrievedAt,
          rawContentHash: canonicalSha256V1(
            address,
            "takfornyelse:kartverket-address-preview:v1",
          ),
          license: {
            status: "authorized",
            name: "Norsk lisens for offentlige data (NLOD) 2.0",
            attribution: "Kartverket",
            termsVersion: "NLOD-2.0",
          },
          visibility: "customer_safe",
          quality: {
            status: "usable",
            score: 0.95,
            reasons: ["Address resolved by Kartverket"],
          },
        },
        {
          sourceId: footprintSourceId,
          kind: "building_footprint",
          provider: candidate.source,
          providerObjectId: candidate.id,
          inputSchemaVersion: "osm-building-footprint.v1",
          adapterVersion: ROOF_FUSION_OSM_PREVIEW_SCHEMA_VERSION,
          retrievedAt,
          rawContentHash: canonicalSha256V1(
            candidate,
            "takfornyelse:osm-building-footprint-preview:v1",
          ),
          license: {
            status: "authorized",
            name: candidate.license,
            attribution: candidate.credits,
            termsVersion: "ODbL-1.0",
          },
          visibility: "customer_safe",
          quality: {
            status: "limited",
            score,
            reasons: [
              "Public building footprint only",
              "Roof planes, pitch and elevation are not present",
              candidate.confidenceReasoning,
            ],
          },
        },
      ],
      observations: [
        {
          observationId,
          kind: "surface_exists",
          targetRef: surfaceId,
          value: {
            geometryKind: "building_footprint",
            providerHorizontalAreaSquareMeters:
              candidate.horizontalAreaSquareMeters,
          },
          status: "accepted",
          sourceRefs: [footprintSourceId],
          confidence: {
            level: candidate.confidence,
            score,
            basis: "provider_reported",
            rationale: candidate.confidenceReasoning,
          },
          reasons: [
            "Footprint accepted for planimetric engine-contract validation only",
          ],
        },
      ],
      fusionDecision: {
        decisionId: `fusion-osm-${fingerprint}`,
        policyVersion: "roof-fusion-osm-preview-policy.v1",
        acceptedObservationIds: [observationId],
        rejectedObservationIds: [],
        conflictedObservationIds: [],
        decidedAt: retrievedAt,
        decidedBy: {
          actorId: "roof-fusion-preview-engine",
          actorType: "system",
          displayName: "Roof Fusion Preview Engine",
        },
        rationale:
          "OSM footprint accepted only as preliminary horizontal geometry; roof planes, pitch and licensed imagery remain mandatory",
      },
    },
    measurement: {
      method: "provider_structured_import",
      class: "preliminary",
      confidence: {
        level: "low",
        score: Math.min(score, 0.49),
        basis: "derived",
        rationale:
          "Only a public horizontal building footprint is available; no roof-plane elevation or pitch evidence exists",
      },
    },
  };

  const calculation = calculateRoofGeometryV1(geometryInput);
  const request = buildRoofSourceRequestV1({
    schemaVersion: "roof-source-request.v1",
    requestId: `request-osm-${fingerprint}`,
    caseId: `preview-address-${fingerprint}`,
    targetSnapshotId: `rf-osm-${fingerprint}-r1`,
    expectedInputVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    adapterId: ROOF_GEOMETRY_SOURCE_ADAPTER_ID,
    idempotencyKey: `roof-osm-preview:${fingerprint}`,
    requestedAt: retrievedAt,
    input: {
      geometryInputHash: calculation.inputHash,
      calculationId: calculation.calculationId,
    },
  });
  const sourceResult = roofGeometryCalculationToSourceResultV1(
    request,
    calculation,
    retrievedAt,
  );
  const snapshot = roofSourceResultToSnapshotV1(request, sourceResult, {
    snapshotId: request.targetSnapshotId,
    revision: 1,
    caseId: request.caseId,
    propertyId: `preview-property-${fingerprint}`,
    inputVersion: request.expectedInputVersion,
    engineVersion: "roof-fusion-engine.v1.1.0",
    rendererVersion: "roof-renderer.v1.0.0",
    generatedAt: retrievedAt,
    normalizedBy: {
      actorId: "roof-fusion-preview-engine",
      actorType: "system",
      displayName: "Roof Fusion Preview Engine",
    },
  });
  const engineHorizontalAreaSquareMeters = exactValue(
    snapshot.totals.grossHorizontalArea,
  );
  const providerHorizontalAreaSquareMeters =
    candidate.horizontalAreaSquareMeters;
  const summary: RoofFusionOsmFootprintPreviewSummaryV1 = {
    schemaVersion: ROOF_FUSION_OSM_PREVIEW_SCHEMA_VERSION,
    candidateId: candidate.id,
    contractStatus: "valid",
    reviewState: "review_required",
    qualityStatus: "review_required",
    measurementClass: "preliminary",
    pricingReady: false,
    blockers: [...ROOF_FUSION_OSM_PREVIEW_BLOCKERS],
    engineHorizontalAreaSquareMeters: round(engineHorizontalAreaSquareMeters),
    providerHorizontalAreaSquareMeters,
    areaDeltaPercent: round(
      (Math.abs(
        engineHorizontalAreaSquareMeters - providerHorizontalAreaSquareMeters,
      ) /
        providerHorizontalAreaSquareMeters) *
        100,
    ),
    footprintPerimeterMeters: round(
      exactValue(snapshot.totals.footprintPerimeter),
    ),
    calculationHash: calculation.calculationHash,
    snapshotHash: snapshot.snapshotHash,
    renderHash: snapshot.rendererPayload.renderHash,
  };

  if (
    snapshot.state !== summary.reviewState ||
    snapshot.quality.status !== summary.qualityStatus ||
    snapshot.measurement.class !== summary.measurementClass
  ) {
    throw new TypeError(
      "OSM footprint Preview cannot be promoted beyond review-required preliminary state",
    );
  }

  return {
    schemaVersion: ROOF_FUSION_OSM_PREVIEW_SCHEMA_VERSION,
    geometryInput,
    calculation,
    request,
    sourceResult,
    snapshot,
    summary,
  } as const;
}
