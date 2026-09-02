import type { PayloadRequest } from "payload";
import type { AdminRoofFusionPreviewReadAdapterV1 } from "@/lib/roof-fusion/preview-read-adapters-v1";
import { roofFusionCaseIdForLeadV1 } from "@/lib/roof-fusion/preview-read-adapters-v1";
import {
  parseRoofSnapshotV1,
  type RoofMeasurementValueV1,
  type RoofSnapshotV1,
} from "@/lib/roof-fusion/roof-snapshot-v1";
import type { AdminNextCaseWorkspaceView } from "@/lib/admin-next/case-workspace-contract";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

export type AdminNextR4MeasurementView = NonNullable<
  AdminNextCaseWorkspaceView["measurementReview"]
> & {
  horizontalAreaSquareMeters?: number;
  surfaceAreaSquareMeters?: number;
};
export type AdminNextR4LoadResult =
  | { status: "ready"; source: "fixture" | "canonical"; value: AdminNextR4MeasurementView }
  | {
      status: "not_found";
      reason:
        | "canonical_snapshot_missing"
        | "case_identity_invalid"
        | "fixture_missing"
        | "measurement_mismatch";
    };
export interface AdminNextR4Adapter {
  load(caseReference: string, measurementReference: string): Promise<AdminNextR4LoadResult>;
}

export const adminNextFixtureR4Adapter: AdminNextR4Adapter = {
  async load(caseReference, measurementReference) {
    const measurement = adminNextCaseWorkspaceFixture.measurementReview;
    if (
      caseReference !== adminNextCaseWorkspaceFixture.reference ||
      !measurement ||
      measurement.reference !== measurementReference
    ) return { status: "not_found", reason: "fixture_missing" };
    return { status: "ready", source: "fixture", value: measurement };
  },
};

function midpoint(value: RoofMeasurementValueV1): number | undefined {
  return value.min === null || value.max === null ? undefined : (value.min + value.max) / 2;
}
function confidence(snapshot: RoofSnapshotV1) {
  return Math.round((snapshot.measurement.confidence.score || 0) * 100);
}
function overallPitch(snapshot: RoofSnapshotV1) {
  const weighted = snapshot.geometry.surfaces.reduce(
    (result, surface) => {
      const area = midpoint(surface.netSurfaceArea);
      const pitch = midpoint(surface.pitch);
      return area === undefined || pitch === undefined
        ? result
        : { area: result.area + area, pitchArea: result.pitchArea + pitch * area };
    },
    { area: 0, pitchArea: 0 },
  );
  return weighted.area ? weighted.pitchArea / weighted.area : undefined;
}
function perimeter(snapshot: RoofSnapshotV1, surfaceId: string) {
  return snapshot.geometry.edges
    .filter((edge) => edge.adjacentSurfaceIds.includes(surfaceId))
    .reduce((sum, edge) => sum + (midpoint(edge.length3d) ?? 0), 0);
}

export function projectRoofSnapshotToR4(
  snapshot: RoofSnapshotV1,
  previous: RoofSnapshotV1 | null,
): AdminNextR4MeasurementView {
  const reviewedEdges = snapshot.geometry.edges.filter((edge) => edge.quality === "conflicted");
  const sources = snapshot.provenance.sources;
  const rendererContours = new Map(
    snapshot.rendererPayload.contours.map((contour) => [
      contour.contourId,
      contour,
    ]),
  );
  const primarySlopes = snapshot.geometry.surfaces.slice(0, 4).map((surface, index) => ({
    id: (["S1", "S2", "S3", "S4"] as const)[index],
    areaSquareMeters: midpoint(surface.netSurfaceArea) ?? 0,
    pitchDegrees: midpoint(surface.pitch),
    perimeterMeters: perimeter(snapshot, surface.surfaceId),
  }));
  const area = midpoint(snapshot.totals.netSurfaceArea) ?? 0;
  return {
    reference: snapshot.snapshotId,
    state: snapshot.state === "approved" && snapshot.quality.status === "pass" ? "verified" : "review_required",
    areaSquareMeters: area,
    horizontalAreaSquareMeters: midpoint(snapshot.totals.grossHorizontalArea),
    surfaceAreaSquareMeters: midpoint(snapshot.totals.grossSurfaceArea),
    overallPitchDegrees: overallPitch(snapshot),
    perimeterMeters: midpoint(snapshot.totals.footprintPerimeter),
    confidencePercent: confidence(snapshot),
    planeCount: snapshot.geometry.surfaces.length,
    comparedToReference: previous?.snapshotId,
    provenance: {
      evidenceId: sources[0]?.sourceId || snapshot.snapshotId,
      source: sources.map((source) => source.provider).join(" + ") || "Roof Fusion",
      capturedAt: snapshot.generatedAt,
      modelVersion: snapshot.engineVersion,
      checksum: snapshot.snapshotHash,
    },
    planes: snapshot.geometry.surfaces.map((surface) => ({
      id: surface.surfaceId,
      areaSquareMeters: midpoint(surface.netSurfaceArea) ?? 0,
      pitchDegrees: midpoint(surface.pitch),
      state: surface.quality === "verified" ? "verified" : "review",
    })),
    reviewEdges: reviewedEdges.map((edge) => ({
      id: edge.edgeId,
      between: edge.adjacentSurfaceIds.join(" / "),
      reason: "Roof Fusion geometry conflict",
      varianceMeters: Math.max(
        ...snapshot.geometry.vertices
          .filter((vertex) => vertex.vertexId === edge.fromVertexId || vertex.vertexId === edge.toVertexId)
          .map((vertex) => vertex.uncertaintyM),
        0,
      ),
    })),
    diagram: {
      vertices: snapshot.rendererPayload.vertices.map((vertex) => ({
        id: vertex.vertexId,
        xMeters: vertex.xM,
        yMeters: vertex.yM,
      })),
      surfaces: snapshot.rendererPayload.surfaces.map((surface) => ({
        id: surface.surfaceId,
        vertexIds:
          rendererContours.get(surface.outerContourId)?.vertexIds || [],
      })),
      edges: snapshot.rendererPayload.edges.map((edge) => ({
        id: edge.edgeId,
        fromVertexId: edge.fromVertexId,
        toVertexId: edge.toVertexId,
        state: edge.quality === "conflicted" ? "review" : "verified",
      })),
    },
    primarySlopes,
    photos: sources.filter((source) => source.kind === "photo").map((source) => ({
      id: source.sourceId,
      label: source.provider,
      source: source.license.attribution,
      capturedAt: source.capturedAt || source.retrievedAt,
    })),
    sources: sources.map((source) => ({
      id: source.sourceId,
      kind: source.kind,
      label: source.provider,
      attribution: source.license.attribution,
      capturedAt: source.capturedAt || source.retrievedAt,
      licenseState: source.license.status,
      qualityState: source.quality.status,
    })),
    deltaFromR3: {
      areaSquareMeters: area - (previous ? (midpoint(previous.totals.netSurfaceArea) ?? area) : area),
      confidencePoints: confidence(snapshot) - (previous ? confidence(previous) : confidence(snapshot)),
      planeCount: snapshot.geometry.surfaces.length - (previous?.geometry.surfaces.length || snapshot.geometry.surfaces.length),
    },
    verificationGates: [
      { id: "source_identity", state: sources.length ? "verified" : "review_required", detail: `${sources.length} bound source(s)` },
      { id: "plane_sum", state: snapshot.quality.status === "pass" ? "verified" : "review_required", detail: snapshot.quality.status },
      { id: "review_edges", state: reviewedEdges.length ? "review_required" : "verified", detail: `${reviewedEdges.length} conflict edge(s)` },
      { id: "approval", state: snapshot.approval.status === "approved" ? "verified" : "locked", detail: snapshot.approval.status },
    ],
    nextAction: snapshot.approval.status === "approved" ? "Ready for approved rendering" : "Complete Roof Fusion review and approval",
    fallbackHref: "/admin-v2/cases",
  };
}

export type AdminNextR4CaseIdentityV1 = {
  caseReference: string;
  leadId: number;
  roofFusionCaseId: string;
};

export function parseAdminNextR4CaseIdentityV1(
  caseReference: string,
): AdminNextR4CaseIdentityV1 | null {
  const match = /^TF-([1-9]\d*)$/u.exec(caseReference);
  if (!match) return null;
  const leadId = Number(match[1]);
  if (!Number.isSafeInteger(leadId)) return null;
  return {
    caseReference,
    leadId,
    roofFusionCaseId: roofFusionCaseIdForLeadV1(leadId),
  };
}

export function createAdminNextRoofFusionR4Adapter(
  reader: Pick<
    AdminRoofFusionPreviewReadAdapterV1,
    "readLatestSnapshot" | "readSnapshot"
  >,
  user: PayloadRequest["user"],
): AdminNextR4Adapter {
  return {
    async load(caseReference, measurementReference) {
      const identity = parseAdminNextR4CaseIdentityV1(caseReference);
      if (!identity)
        return { status: "not_found", reason: "case_identity_invalid" };
      const latestRaw = await reader.readLatestSnapshot(
        identity.roofFusionCaseId,
        user,
      );
      if (!latestRaw)
        return { status: "not_found", reason: "canonical_snapshot_missing" };
      const latest = parseRoofSnapshotV1(latestRaw);
      if (latest.snapshotId !== measurementReference)
        return { status: "not_found", reason: "measurement_mismatch" };
      const previous = latest.supersedesSnapshotId
        ? await reader.readSnapshot(
            identity.roofFusionCaseId,
            latest.supersedesSnapshotId,
            user,
          )
        : null;
      return {
        status: "ready",
        source: "canonical",
        value: projectRoofSnapshotToR4(latest, previous ? parseRoofSnapshotV1(previous) : null),
      };
    },
  };
}

export async function loadAdminNextR4WithMissingCanonicalFallback(input: {
  canonical: AdminNextR4Adapter;
  fixture: AdminNextR4Adapter;
  caseReference: string;
  measurementReference: string;
}) {
  const canonical = await input.canonical.load(
    input.caseReference,
    input.measurementReference,
  );
  if (
    canonical.status !== "not_found" ||
    canonical.reason !== "canonical_snapshot_missing"
  ) {
    return canonical;
  }
  return input.fixture.load(input.caseReference, input.measurementReference);
}
