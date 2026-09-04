import { describe, expect, it } from "vitest";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import {
  projectRoofFusionWorkbenchDetailedResultV1,
  ROOF_FUSION_WORKBENCH_DETAILED_RESULT_VERSION,
} from "./workbench-detailed-result-v1";

describe("Roof Fusion workbench detailed result v1", () => {
  it("preserves stable surface, edge and source evidence from the exact snapshot", () => {
    const snapshot = buildApprovedGableRoofFixtureV1().approvedSnapshot;

    const result = projectRoofFusionWorkbenchDetailedResultV1(snapshot);

    expect(result).toMatchObject({
      schemaVersion: ROOF_FUSION_WORKBENCH_DETAILED_RESULT_VERSION,
      usage: "preview_only",
      pricingReady: false,
      snapshot: {
        snapshotId: snapshot.snapshotId,
        revision: snapshot.revision,
        snapshotHash: snapshot.snapshotHash,
        measurementMethod: snapshot.measurement.method,
        measurementClass: snapshot.measurement.class,
        confidence: snapshot.measurement.confidence,
      },
    });
    expect(result.surfaces.map((surface) => surface.surfaceId)).toEqual(
      snapshot.geometry.surfaces.map((surface) => surface.surfaceId),
    );
    expect(result.surfaces[0]).toMatchObject({
      surfaceId: snapshot.geometry.surfaces[0].surfaceId,
      edgeIds: snapshot.geometry.surfaces[0].edgeIds,
      sourceRefs: snapshot.geometry.surfaces[0].sourceRefs,
      pitch: snapshot.geometry.surfaces[0].pitch,
      grossHorizontalArea: snapshot.geometry.surfaces[0].grossHorizontalArea,
      grossSurfaceArea: snapshot.geometry.surfaces[0].grossSurfaceArea,
      netSurfaceArea: snapshot.geometry.surfaces[0].netSurfaceArea,
    });
    expect(result.edges).toEqual(
      snapshot.geometry.edges.map((edge) => ({
        edgeId: edge.edgeId,
        fromVertexId: edge.fromVertexId,
        toVertexId: edge.toVertexId,
        adjacentSurfaceIds: edge.adjacentSurfaceIds,
        type: edge.type,
        length2d: edge.length2d,
        length3d: edge.length3d,
        gutterCandidate: edge.gutterCandidate,
        quality: edge.quality,
        sourceRefs: edge.sourceRefs,
      })),
    );
    expect(result.sources[0]).toMatchObject({
      sourceId: snapshot.provenance.sources[0].sourceId,
      rawContentHash: snapshot.provenance.sources[0].rawContentHash,
      license: snapshot.provenance.sources[0].license,
      quality: snapshot.provenance.sources[0].quality,
    });
    expect(result.observations).toHaveLength(
      snapshot.provenance.observations.length,
    );
  });

  it("keeps measurement ranges and their distinct confidence instead of averaging them", () => {
    const snapshot = structuredClone(
      buildApprovedGableRoofFixtureV1().approvedSnapshot,
    );
    snapshot.geometry.surfaces[0].pitch = {
      mode: "range",
      unit: "deg",
      min: 24,
      max: 31,
      sourceRefs: [snapshot.provenance.sources[0].sourceId],
      confidence: {
        level: "low",
        score: 0.42,
        basis: "derived",
        rationale: "Fixture range retained for operator review",
      },
    };

    const first = projectRoofFusionWorkbenchDetailedResultV1(snapshot);
    const second = projectRoofFusionWorkbenchDetailedResultV1(snapshot);

    expect(first.surfaces[0].pitch).toEqual(
      snapshot.geometry.surfaces[0].pitch,
    );
    expect(first.surfaces[0].pitch).not.toBe(
      snapshot.geometry.surfaces[0].pitch,
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
