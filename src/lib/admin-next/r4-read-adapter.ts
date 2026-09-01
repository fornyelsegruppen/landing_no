import type { RoofSnapshotAppendOnlyRepositoryV1 } from "@/lib/roof-fusion/repository-contract-v1";
import {
  parseRoofSnapshotV1,
  type RoofMeasurementValueV1,
  type RoofSnapshotV1,
} from "@/lib/roof-fusion/roof-snapshot-v1";
import type { AdminNextCaseWorkspaceView } from "@/lib/admin-next/case-workspace-contract";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

export type AdminNextR4MeasurementView = NonNullable<
  AdminNextCaseWorkspaceView["measurementReview"]
>;
export type AdminNextR4LoadResult =
  | { status: "ready"; source: "fixture" | "canonical"; value: AdminNextR4MeasurementView }
  | { status: "not_found" };
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
    ) return { status: "not_found" };
    return { status: "ready", source: "fixture", value: measurement };
  },
};

function midpoint(value: RoofMeasurementValueV1) {
  return value.min === null || value.max === null ? 0 : (value.min + value.max) / 2;
}
function confidence(snapshot: RoofSnapshotV1) {
  return Math.round((snapshot.measurement.confidence.score || 0) * 100);
}
function perimeter(snapshot: RoofSnapshotV1, surfaceId: string) {
  return snapshot.geometry.edges
    .filter((edge) => edge.adjacentSurfaceIds.includes(surfaceId))
    .reduce((sum, edge) => sum + midpoint(edge.length3d), 0);
}

export function projectRoofSnapshotToR4(
  snapshot: RoofSnapshotV1,
  previous: RoofSnapshotV1 | null,
): AdminNextR4MeasurementView {
  const reviewedEdges = snapshot.geometry.edges.filter((edge) => edge.quality === "conflicted");
  const sources = snapshot.provenance.sources;
  const primarySlopes = snapshot.geometry.surfaces.slice(0, 4).map((surface, index) => ({
    id: (["S1", "S2", "S3", "S4"] as const)[index],
    areaSquareMeters: midpoint(surface.netSurfaceArea),
    pitchDegrees: midpoint(surface.pitch),
    perimeterMeters: perimeter(snapshot, surface.surfaceId),
  }));
  const area = midpoint(snapshot.totals.netSurfaceArea);
  return {
    reference: snapshot.snapshotId,
    state: snapshot.state === "approved" && snapshot.quality.status === "pass" ? "verified" : "review_required",
    areaSquareMeters: area,
    confidencePercent: confidence(snapshot),
    planeCount: snapshot.geometry.surfaces.length,
    provenance: {
      evidenceId: sources[0]?.sourceId || snapshot.snapshotId,
      source: sources.map((source) => source.provider).join(" + ") || "Roof Fusion",
      capturedAt: snapshot.generatedAt,
      modelVersion: snapshot.engineVersion,
      checksum: snapshot.snapshotHash,
    },
    planes: snapshot.geometry.surfaces.map((surface) => ({
      id: surface.surfaceId,
      areaSquareMeters: midpoint(surface.netSurfaceArea),
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
    primarySlopes,
    photos: sources.filter((source) => source.kind === "photo").map((source) => ({
      id: source.sourceId,
      label: source.provider,
      source: source.license.attribution,
      capturedAt: source.capturedAt || source.retrievedAt,
    })),
    deltaFromR3: {
      areaSquareMeters: area - (previous ? midpoint(previous.totals.netSurfaceArea) : area),
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

export function createAdminNextCanonicalR4Adapter(
  repository: Pick<RoofSnapshotAppendOnlyRepositoryV1, "readLatestSnapshot" | "readSnapshot">,
): AdminNextR4Adapter {
  return {
    async load(caseReference, measurementReference) {
      const latestRaw = await repository.readLatestSnapshot(caseReference);
      if (!latestRaw) return { status: "not_found" };
      const latest = parseRoofSnapshotV1(latestRaw);
      if (latest.snapshotId !== measurementReference) return { status: "not_found" };
      const previous = latest.supersedesSnapshotId
        ? await repository.readSnapshot(latest.supersedesSnapshotId)
        : null;
      return {
        status: "ready",
        source: "canonical",
        value: projectRoofSnapshotToR4(latest, previous ? parseRoofSnapshotV1(previous) : null),
      };
    },
  };
}
