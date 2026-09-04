import type {
  RoofMeasurementValueV1,
  RoofSnapshotV1,
} from "./roof-snapshot-v1";

export const ROOF_FUSION_WORKBENCH_DETAILED_RESULT_VERSION =
  "roof-fusion-workbench-detailed-result.v1" as const;

function measurement(value: RoofMeasurementValueV1): RoofMeasurementValueV1 {
  return {
    ...value,
    sourceRefs: [...value.sourceRefs],
    confidence: { ...value.confidence },
  };
}

/**
 * Preview-only, lossless result detail for the workbench result card.
 *
 * It deliberately carries the snapshot's stable identities, ranges and evidence
 * instead of deriving display-only labels or silently collapsing ranges to a
 * midpoint. It is not an approval, persistence or pricing payload.
 */
export function projectRoofFusionWorkbenchDetailedResultV1(
  snapshot: RoofSnapshotV1,
) {
  return {
    schemaVersion: ROOF_FUSION_WORKBENCH_DETAILED_RESULT_VERSION,
    usage: "preview_only" as const,
    pricingReady: false as const,
    snapshot: {
      snapshotId: snapshot.snapshotId,
      revision: snapshot.revision,
      snapshotHash: snapshot.snapshotHash,
      state: snapshot.state,
      measurementMethod: snapshot.measurement.method,
      measurementClass: snapshot.measurement.class,
      confidence: { ...snapshot.measurement.confidence },
    },
    totals: {
      grossHorizontalArea: measurement(snapshot.totals.grossHorizontalArea),
      grossSurfaceArea: measurement(snapshot.totals.grossSurfaceArea),
      netSurfaceArea: measurement(snapshot.totals.netSurfaceArea),
      footprintPerimeter: measurement(snapshot.totals.footprintPerimeter),
    },
    surfaces: snapshot.geometry.surfaces.map((surface) => ({
      surfaceId: surface.surfaceId,
      outerContourId: surface.outerContourId,
      openingIds: [...surface.openingIds],
      edgeIds: [...surface.edgeIds],
      normal: surface.normal
        ? ([...surface.normal] as [number, number, number])
        : undefined,
      azimuthDegrees: surface.azimuthDegrees,
      pitch: measurement(surface.pitch),
      grossHorizontalArea: measurement(surface.grossHorizontalArea),
      grossSurfaceArea: measurement(surface.grossSurfaceArea),
      netSurfaceArea: measurement(surface.netSurfaceArea),
      quality: surface.quality,
      sourceRefs: [...surface.sourceRefs],
    })),
    edges: snapshot.geometry.edges.map((edge) => ({
      edgeId: edge.edgeId,
      fromVertexId: edge.fromVertexId,
      toVertexId: edge.toVertexId,
      adjacentSurfaceIds: [...edge.adjacentSurfaceIds],
      type: edge.type,
      length2d: measurement(edge.length2d),
      length3d: measurement(edge.length3d),
      gutterCandidate: edge.gutterCandidate,
      quality: edge.quality,
      sourceRefs: [...edge.sourceRefs],
    })),
    sources: snapshot.provenance.sources.map((source) => ({
      sourceId: source.sourceId,
      kind: source.kind,
      provider: source.provider,
      providerObjectId: source.providerObjectId,
      capturedAt: source.capturedAt,
      retrievedAt: source.retrievedAt,
      rawContentHash: source.rawContentHash,
      license: { ...source.license },
      visibility: source.visibility,
      quality: {
        ...source.quality,
        reasons: [...source.quality.reasons],
      },
    })),
    observations: snapshot.provenance.observations.map((observation) => ({
      observationId: observation.observationId,
      kind: observation.kind,
      targetRef: observation.targetRef,
      value: structuredClone(observation.value),
      status: observation.status,
      sourceRefs: [...observation.sourceRefs],
      confidence: { ...observation.confidence },
      reasons: [...observation.reasons],
    })),
  };
}

export type RoofFusionWorkbenchDetailedResultV1 = ReturnType<
  typeof projectRoofFusionWorkbenchDetailedResultV1
>;
