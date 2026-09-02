import type { AddressCandidate } from "@/lib/providers/contracts";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  etrs89ToUtm33,
  type KartverketHeightSurfaceV1,
} from "@/lib/providers/kartverket-hoydedata-provider";
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

export const ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION =
  "roof-fusion-height-surface-preview.v1" as const;

export const ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_BLOCKERS = [
  "ROOF_PLANES_REQUIRED",
  "ROOF_PITCH_REQUIRED",
  "ROOF_SURFACE_RENDER_REQUIRED",
] as const;

export type RoofFusionHeightSurfacePreviewBlocker =
  (typeof ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_BLOCKERS)[number];

export type RoofFusionHeightSurfacePreviewSummaryV1 = {
  schemaVersion: typeof ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION;
  candidateId: string;
  contractStatus: "valid";
  reviewState: "review_required";
  qualityStatus: "review_required";
  measurementClass: "preliminary";
  pricingReady: false;
  blockers: RoofFusionHeightSurfacePreviewBlocker[];
  engineHorizontalAreaSquareMeters: number;
  footprintPerimeterMeters: number;
  roofCells: number;
  footprintCells: number;
  roofCoverageRatio: number;
  groundElevationMedianM: number;
  roofHeightP10M: number;
  roofHeightMedianM: number;
  roofHeightP90M: number;
  calculationHash: string;
  snapshotHash: string;
  renderHash: string;
};

export class RoofFusionHeightSurfacePreviewError extends Error {
  constructor(
    readonly code:
      | "SURFACE_CONTRACT_MISMATCH"
      | "FOOTPRINT_OUTSIDE_SURFACE"
      | "ROOF_SURFACE_NOT_DETECTED",
    message: string,
  ) {
    super(message);
    this.name = "RoofFusionHeightSurfacePreviewError";
  }
}

type ProjectedPoint = { x: number; y: number };

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function quantile(sorted: number[], fraction: number) {
  if (!sorted.length) {
    throw new RoofFusionHeightSurfacePreviewError(
      "ROOF_SURFACE_NOT_DETECTED",
      "No usable Høydedata cells were found inside the building footprint",
    );
  }
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return (
    sorted[lower] * (upper - position) + sorted[upper] * (position - lower)
  );
}

function onSegment(
  point: ProjectedPoint,
  from: ProjectedPoint,
  to: ProjectedPoint,
) {
  const cross =
    (point.y - from.y) * (to.x - from.x) - (point.x - from.x) * (to.y - from.y);
  if (Math.abs(cross) > 1e-6) return false;
  return (
    point.x >= Math.min(from.x, to.x) - 1e-6 &&
    point.x <= Math.max(from.x, to.x) + 1e-6 &&
    point.y >= Math.min(from.y, to.y) - 1e-6 &&
    point.y <= Math.max(from.y, to.y) + 1e-6
  );
}

function pointInPolygon(point: ProjectedPoint, polygon: ProjectedPoint[]) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (onSegment(point, previousPoint, currentPoint)) return true;
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function exactValue(value: { min: number | null; max: number | null }) {
  if (value.min === null || value.max === null || value.min !== value.max) {
    throw new RoofFusionHeightSurfacePreviewError(
      "SURFACE_CONTRACT_MISMATCH",
      "Roof Fusion Høydedata Preview expected an exact derived value",
    );
  }
  return value.min;
}

function confidenceScore(candidate: BuildingFootprintCandidate) {
  if (candidate.confidence === "high") return 0.68;
  if (candidate.confidence === "medium") return 0.56;
  return 0.5;
}

function uncertaintyFor(surface: KartverketHeightSurfaceV1) {
  return surface.quality.status === "usable" ? 1.25 : 2.5;
}

export function buildRoofFusionHeightSurfacePreviewV1(input: {
  address: AddressCandidate;
  candidate: BuildingFootprintCandidate;
  surface: KartverketHeightSurfaceV1;
}) {
  const { address, candidate, surface } = input;
  if (
    surface.schemaVersion !== "kartverket-height-surface.v1" ||
    surface.coordinateSystem !== "EPSG:25833" ||
    surface.values.domElevationM.length !== surface.quality.totalSamples ||
    surface.values.dtmElevationM.length !== surface.quality.totalSamples ||
    surface.values.heightAboveTerrainM.length !== surface.quality.totalSamples
  ) {
    throw new RoofFusionHeightSurfacePreviewError(
      "SURFACE_CONTRACT_MISMATCH",
      "Kartverket height surface does not match the Roof Fusion Preview contract",
    );
  }
  const projectedPolygon = candidate.polygon.map((point) => {
    const projected = etrs89ToUtm33(point);
    return { x: projected.eastingM, y: projected.northingM };
  });
  if (
    projectedPolygon.some(
      (point) =>
        point.x < surface.bbox.minEastingM ||
        point.x > surface.bbox.maxEastingM ||
        point.y < surface.bbox.minNorthingM ||
        point.y > surface.bbox.maxNorthingM,
    )
  ) {
    throw new RoofFusionHeightSurfacePreviewError(
      "FOOTPRINT_OUTSIDE_SURFACE",
      "The OSM building footprint extends outside the Høydedata grid",
    );
  }

  const footprintHeights: number[] = [];
  const footprintGround: number[] = [];
  for (let row = 0; row < surface.grid.height; row += 1) {
    const y =
      surface.bbox.maxNorthingM - (row + 0.5) * surface.grid.cellHeightM;
    for (let column = 0; column < surface.grid.width; column += 1) {
      const x =
        surface.bbox.minEastingM + (column + 0.5) * surface.grid.cellWidthM;
      if (!pointInPolygon({ x, y }, projectedPolygon)) continue;
      const index = row * surface.grid.width + column;
      const height = surface.values.heightAboveTerrainM[index];
      const ground = surface.values.dtmElevationM[index];
      if (height === null || ground === null) continue;
      footprintHeights.push(height);
      footprintGround.push(ground);
    }
  }
  if (footprintHeights.length < 12) {
    throw new RoofFusionHeightSurfacePreviewError(
      "ROOF_SURFACE_NOT_DETECTED",
      "Too few valid Høydedata cells fall inside the selected building",
    );
  }
  const elevated = footprintHeights
    .filter((height) => height >= 2.5 && height <= 80)
    .sort((left, right) => left - right);
  const roofCoverageRatio = elevated.length / footprintHeights.length;
  if (elevated.length < 12 || roofCoverageRatio < 0.45) {
    throw new RoofFusionHeightSurfacePreviewError(
      "ROOF_SURFACE_NOT_DETECTED",
      "Høydedata does not show a sufficiently continuous elevated roof surface",
    );
  }
  const lowerQuartile = quantile(elevated, 0.25);
  const upperQuartile = quantile(elevated, 0.75);
  const interquartileRange = upperQuartile - lowerQuartile;
  const upperFence = upperQuartile + Math.max(2, interquartileRange * 1.5);
  const roofHeights = elevated.filter((height) => height <= upperFence);
  const groundElevations = [...footprintGround].sort(
    (left, right) => left - right,
  );
  const roofHeightP10M = quantile(roofHeights, 0.1);
  const roofHeightMedianM = quantile(roofHeights, 0.5);
  const roofHeightP90M = quantile(roofHeights, 0.9);
  const groundElevationMedianM = quantile(groundElevations, 0.5);
  const fingerprint = canonicalSha256V1(
    {
      addressId: address.id,
      candidateId: candidate.id,
      polygon: candidate.polygon,
      domHash: surface.provenance.domContentSha256,
      dtmHash: surface.provenance.dtmContentSha256,
    },
    "takfornyelse:roof-fusion-height-surface-preview-identity:v1",
  ).slice(0, 20);
  const addressSourceId = `src-address-${fingerprint}`;
  const footprintSourceId = `src-footprint-${fingerprint}`;
  const domSourceId = `src-dom-${fingerprint}`;
  const dtmSourceId = `src-dtm-${fingerprint}`;
  const surfaceId = `surface-height-${fingerprint}`;
  const contourId = `contour-height-${fingerprint}`;
  const addressAnchor = etrs89ToUtm33(address);
  const uncertaintyM = uncertaintyFor(surface);
  const vertices = projectedPolygon.map((point, index) => ({
    vertexId: `v-${fingerprint}-${index + 1}`,
    xM: point.x - addressAnchor.eastingM,
    yM: point.y - addressAnchor.northingM,
    zM: roofHeightMedianM,
    uncertaintyM,
    sourceRefs: [footprintSourceId, domSourceId, dtmSourceId],
  }));
  const edgeIds = vertices.map(
    (_, index) => `edge-height-${fingerprint}-${index + 1}`,
  );
  const heightObservationId = `obs-height-${fingerprint}`;
  const footprintObservationId = `obs-footprint-${fingerprint}`;
  const score = confidenceScore(candidate);
  const sourceQuality =
    surface.quality.status === "usable" ? "usable" : "limited";
  const geometryInput: RoofGeometryInputV1 = {
    schemaVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    calculationId: `calc-height-${fingerprint}`,
    coordinateSystem: {
      kind: "local_cartesian",
      reference: "ETRS89 / UTM zone 33N offsets at Kartverket address anchor",
      axisOrder: "x_east_y_north_z_up",
      origin: {
        latitude: address.latitude,
        longitude: address.longitude,
        elevationM: groundElevationMedianM,
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
        sourceRefs: [footprintSourceId, domSourceId, dtmSourceId],
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
          adapterVersion: ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION,
          retrievedAt: surface.provenance.retrievedAt,
          rawContentHash: canonicalSha256V1(
            address,
            "takfornyelse:kartverket-height-address:v1",
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
          adapterVersion: ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION,
          retrievedAt: surface.provenance.retrievedAt,
          rawContentHash: canonicalSha256V1(
            candidate,
            "takfornyelse:osm-height-footprint:v1",
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
            reasons: [candidate.confidenceReasoning],
          },
        },
        {
          sourceId: domSourceId,
          kind: "lidar",
          provider: surface.provider,
          providerObjectId: surface.provenance.domCoverageId,
          inputSchemaVersion: surface.schemaVersion,
          adapterVersion: ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION,
          retrievedAt: surface.provenance.retrievedAt,
          rawContentHash: surface.provenance.domContentSha256,
          license: {
            status: "authorized",
            name: surface.provenance.license,
            attribution: surface.provenance.attribution,
            termsVersion: "NLOD-2.0",
          },
          visibility: "customer_safe",
          quality: {
            status: sourceQuality,
            score: surface.quality.coverageRatio,
            reasons: surface.quality.reasons,
          },
        },
        {
          sourceId: dtmSourceId,
          kind: "lidar",
          provider: surface.provider,
          providerObjectId: surface.provenance.dtmCoverageId,
          inputSchemaVersion: surface.schemaVersion,
          adapterVersion: ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION,
          retrievedAt: surface.provenance.retrievedAt,
          rawContentHash: surface.provenance.dtmContentSha256,
          license: {
            status: "authorized",
            name: surface.provenance.license,
            attribution: surface.provenance.attribution,
            termsVersion: "NLOD-2.0",
          },
          visibility: "customer_safe",
          quality: {
            status: sourceQuality,
            score: surface.quality.coverageRatio,
            reasons: surface.quality.reasons,
          },
        },
      ],
      observations: [
        {
          observationId: footprintObservationId,
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
          reasons: ["OSM footprint selected by the administrator"],
        },
        {
          observationId: heightObservationId,
          kind: "source_suitability",
          targetRef: surfaceId,
          value: {
            roofCells: roofHeights.length,
            footprintCells: footprintHeights.length,
            roofCoverageRatio: round(roofCoverageRatio, 4),
            groundElevationMedianM: round(groundElevationMedianM),
            roofHeightP10M: round(roofHeightP10M),
            roofHeightMedianM: round(roofHeightMedianM),
            roofHeightP90M: round(roofHeightP90M),
          },
          status: "accepted",
          sourceRefs: [domSourceId, dtmSourceId],
          confidence: {
            level: surface.quality.status === "usable" ? "high" : "medium",
            score: Math.min(surface.quality.coverageRatio, 0.95),
            basis: "derived",
            rationale:
              "DOM minus DTM produced a continuous elevated surface inside the selected footprint",
          },
          reasons: [
            "Height cells were clipped to the selected OSM footprint",
            "Low and extreme outliers were excluded before robust quantiles",
          ],
        },
      ],
      fusionDecision: {
        decisionId: `fusion-height-${fingerprint}`,
        policyVersion: "roof-fusion-height-surface-preview-policy.v1",
        acceptedObservationIds: [footprintObservationId, heightObservationId],
        rejectedObservationIds: [],
        conflictedObservationIds: [],
        decidedAt: surface.provenance.retrievedAt,
        decidedBy: {
          actorId: "roof-fusion-height-preview-engine",
          actorType: "system",
          displayName: "Roof Fusion Høydedata Preview Engine",
        },
        rationale:
          "Open OSM plan geometry and national DOM/DTM elevations are accepted for preliminary roof-surface analysis; plane segmentation and pitch remain review gates",
      },
    },
    measurement: {
      method: "multi_source_fusion",
      class: "preliminary",
      confidence: {
        level: "medium",
        score,
        basis: "derived",
        rationale:
          "Real height data is present, but the footprint is not yet segmented into verified roof planes",
      },
    },
  };

  const calculation = calculateRoofGeometryV1(geometryInput);
  const request = buildRoofSourceRequestV1({
    schemaVersion: "roof-source-request.v1",
    requestId: `request-height-${fingerprint}`,
    caseId: `preview-address-${fingerprint}`,
    targetSnapshotId: `rf-height-${fingerprint}-r1`,
    expectedInputVersion: ROOF_GEOMETRY_INPUT_SCHEMA_VERSION,
    adapterId: ROOF_GEOMETRY_SOURCE_ADAPTER_ID,
    idempotencyKey: `roof-height-preview:${fingerprint}`,
    requestedAt: surface.provenance.retrievedAt,
    input: {
      geometryInputHash: calculation.inputHash,
      calculationId: calculation.calculationId,
    },
  });
  const sourceResult = roofGeometryCalculationToSourceResultV1(
    request,
    calculation,
    surface.provenance.retrievedAt,
  );
  const snapshot = roofSourceResultToSnapshotV1(request, sourceResult, {
    snapshotId: request.targetSnapshotId,
    revision: 1,
    caseId: request.caseId,
    propertyId: `preview-property-${fingerprint}`,
    inputVersion: request.expectedInputVersion,
    engineVersion: "roof-fusion-engine.v1.2.0-height-surface-preview",
    rendererVersion: "roof-renderer.v1.0.0",
    generatedAt: surface.provenance.retrievedAt,
    normalizedBy: {
      actorId: "roof-fusion-height-preview-engine",
      actorType: "system",
      displayName: "Roof Fusion Høydedata Preview Engine",
    },
  });
  const summary: RoofFusionHeightSurfacePreviewSummaryV1 = {
    schemaVersion: ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION,
    candidateId: candidate.id,
    contractStatus: "valid",
    reviewState: "review_required",
    qualityStatus: "review_required",
    measurementClass: "preliminary",
    pricingReady: false,
    blockers: [...ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_BLOCKERS],
    engineHorizontalAreaSquareMeters: round(
      exactValue(snapshot.totals.grossHorizontalArea),
    ),
    footprintPerimeterMeters: round(
      exactValue(snapshot.totals.footprintPerimeter),
    ),
    roofCells: roofHeights.length,
    footprintCells: footprintHeights.length,
    roofCoverageRatio: round(roofCoverageRatio, 4),
    groundElevationMedianM: round(groundElevationMedianM),
    roofHeightP10M: round(roofHeightP10M),
    roofHeightMedianM: round(roofHeightMedianM),
    roofHeightP90M: round(roofHeightP90M),
    calculationHash: calculation.calculationHash,
    snapshotHash: snapshot.snapshotHash,
    renderHash: snapshot.rendererPayload.renderHash,
  };

  if (
    snapshot.state !== summary.reviewState ||
    snapshot.quality.status !== summary.qualityStatus ||
    snapshot.measurement.class !== summary.measurementClass
  ) {
    throw new RoofFusionHeightSurfacePreviewError(
      "SURFACE_CONTRACT_MISMATCH",
      "Høydedata Preview cannot be promoted beyond preliminary review state",
    );
  }

  return {
    schemaVersion: ROOF_FUSION_HEIGHT_SURFACE_PREVIEW_SCHEMA_VERSION,
    surface,
    geometryInput,
    calculation,
    request,
    sourceResult,
    snapshot,
    summary,
  } as const;
}
