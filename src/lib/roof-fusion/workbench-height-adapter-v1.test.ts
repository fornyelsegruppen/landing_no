import { describe, expect, it } from "vitest";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import { buildRoofFusionWorkbenchDraftV1 } from "./workbench-draft-contract-v1";
import { buildWorkbenchDraftFromUiV1 } from "./workbench-ui-client-v1";
import { invokeWorkbenchHeightAdapterV1 } from "./workbench-height-adapter-v1";

const geoReference = {
  crs: "EPSG:25833" as const,
  extentTrust: "actual-visible-extent" as const,
  bounds: {
    minEastingM: 500_000,
    minNorthingM: 6_640_000,
    maxEastingM: 500_020,
    maxNorthingM: 6_640_010,
  },
  imageWidth: 1_000,
  imageHeight: 500,
};

function heightSurface(): KartverketHeightSurfaceV1 {
  const width = 20;
  const height = 10;
  const domElevationM: number[] = [];
  const dtmElevationM: number[] = [];
  const heightAboveTerrainM: number[] = [];
  for (let row = 0; row < height; row += 1) {
    const yM = geoReference.bounds.maxNorthingM - row - 0.5;
    for (let column = 0; column < width; column += 1) {
      const roofHeightM = 9 - Math.abs(yM - 6_640_005) * 0.5;
      domElevationM.push(100 + roofHeightM);
      dtmElevationM.push(100);
      heightAboveTerrainM.push(roofHeightM);
    }
  }
  return {
    schemaVersion: "kartverket-height-surface.v1",
    provider: "Kartverket Nasjonal detaljert høydemodell WCS",
    coordinateSystem: "EPSG:25833",
    bbox: geoReference.bounds,
    grid: {
      width,
      height,
      cellWidthM: 1,
      cellHeightM: 1,
      rowOrder: "north_to_south",
    },
    values: { domElevationM, dtmElevationM, heightAboveTerrainM },
    quality: {
      status: "usable",
      coverageRatio: 1,
      validSamples: width * height,
      totalSamples: width * height,
      maxHeightAboveTerrainM: 9,
      reasons: ["Complete fixture"],
    },
    provenance: {
      retrievedAt: "2026-09-03T20:00:00.000Z",
      domCoverageId: "nhm_dom_topo_25833",
      dtmCoverageId: "nhm_dtm_topo_25833",
      domContentSha256: "b".repeat(64),
      dtmContentSha256: "c".repeat(64),
      resolutionM: 1,
      license: "Norsk lisens for offentlige data (NLOD) 2.0",
      attribution: "Kartverket",
    },
  };
}

async function workbenchDraft() {
  return buildWorkbenchDraftFromUiV1({
    caseId: "lead:13",
    actorId: "7",
    revision: 5,
    draftId: "uat-lead-13-r5-test",
    idempotencyKey: "workbench:lead:13:r5:test",
    createdAt: "2026-09-03T20:00:00.000Z",
    sourceFootprintId: "osm:way/123",
    sourceOutline: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ],
    approvedOutline: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ],
    lines: [
      {
        id: "ridge-1",
        kind: "ridge",
        start: { x: 0.1, y: 0.5 },
        end: { x: 0.9, y: 0.5 },
      },
    ],
    evidence: {
      sourceId: "norge-i-bilder:91",
      sourceContentHash: "a".repeat(64),
      attribution: "©norgeibilder.no",
      imageId: 91,
      georeference: geoReference,
    },
  });
}

function invoke(draft: Awaited<ReturnType<typeof workbenchDraft>>) {
  return invokeWorkbenchHeightAdapterV1({
    draft,
    targetSnapshotId: "uat-height-r5",
    idempotencyKey: "height-adapter:lead:13:r5",
    requestedAt: "2026-09-03T20:01:00.000Z",
    generatedAt: "2026-09-03T20:01:00.000Z",
    heightSurface: heightSurface(),
    orthophoto: {
      sourceId: "norge-i-bilder:91",
      rawContentHash: "a".repeat(64),
      capturedAt: "2026-09-03T19:59:00.000Z",
      attribution: "©norgeibilder.no",
      provider: "norgeibilder.no",
      providerObjectId: "91",
      geoReference,
    },
  });
}

describe("workbench height adapter v1", () => {
  it("keeps footprint and orthophoto identities distinct through the real bridge", async () => {
    const draft = await workbenchDraft();

    expect(draft.geometry.sourceFootprint.sourceId).toBe("osm:way/123");
    expect(draft.geometry.sourceFootprint.sourceContentHash).not.toBe(
      draft.source.sourceContentHash,
    );
    const result = invoke(draft);

    expect(result.summary.status).toBe("review_required");
    expect(result.geometryInput?.surfaces).toHaveLength(2);
    const sharedRidge = result.snapshot.geometry.edges.find(
      (edge) => edge.adjacentSurfaceIds.length === 2,
    );
    expect(sharedRidge).toMatchObject({
      type: "ridge",
      adjacentSurfaceIds: expect.arrayContaining([
        "surface-roof-mass-1-1",
        "surface-roof-mass-1-2",
      ]),
    });
    expect(sharedRidge?.type).not.toBe("eave");
    const sourceIds = result.sourceResult.sourceRecords.map(
      (source) => source.sourceId,
    );
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(sourceIds).toContain("norge-i-bilder:91");
    expect(sourceIds).toContain("osm:way/123");
  });

  it("compatibly re-identifies an already persisted aliased r5 without changing its hash", async () => {
    const current = await workbenchDraft();
    const legacy = buildRoofFusionWorkbenchDraftV1({
      ...current,
      geometry: {
        ...current.geometry,
        sourceFootprint: {
          ...current.geometry.sourceFootprint,
          sourceId: current.source.sourceId,
          sourceContentHash: current.source.sourceContentHash,
        },
      },
    });
    const storedHash = legacy.draftHash;

    const result = invoke(legacy);

    expect(legacy.draftHash).toBe(storedHash);
    const sourceIds = result.sourceResult.sourceRecords.map(
      (source) => source.sourceId,
    );
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(sourceIds).toContain("norge-i-bilder:91");
    expect(sourceIds).toContainEqual(
      expect.stringMatching(/^workbench-footprint:/),
    );
  });
});
