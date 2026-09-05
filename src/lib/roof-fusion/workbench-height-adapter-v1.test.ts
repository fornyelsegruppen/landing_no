import { describe, expect, it } from "vitest";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import {
  buildRoofFusionWorkbenchDraftV1,
  parseRoofFusionWorkbenchDraftV1,
} from "./workbench-draft-contract-v1";
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

type PlanPoint = readonly [number, number];
type PlanLine = readonly ["ridge" | "valley", PlanPoint, PlanPoint];

async function complexRoofFixture(
  outline: readonly PlanPoint[],
  lines: readonly PlanLine[],
  zAt: (x: number, y: number) => number,
) {
  const reference = {
    ...geoReference,
    bounds: {
      minEastingM: 268_600.47215957,
      minNorthingM: 6_627_000.730210781,
      maxEastingM: 268_630.47215957,
      maxNorthingM: 6_627_030.730210781,
    },
    imageWidth: 1800,
    imageHeight: 1800,
  };
  const normalize = ([x, y]: PlanPoint) => ({
    x: (x + 5) / 30,
    y: 1 - (y + 5) / 30,
  });
  const draft = await buildWorkbenchDraftFromUiV1({
    caseId: "lead:13",
    actorId: "7",
    revision: 26,
    draftId: "complex-roof-r26",
    idempotencyKey: "complex-roof:r26",
    createdAt: "2026-09-05T12:00:00.000Z",
    sourceOutline: outline.map(normalize),
    approvedOutline: outline.map(normalize),
    lines: lines.map(([kind, start, end], index) => ({
      id: `line-${index + 1}`,
      kind,
      start: normalize(start),
      end: normalize(end),
    })),
    evidence: {
      sourceId: "norge-i-bilder:91",
      sourceContentHash: "a".repeat(64),
      attribution: "©norgeibilder.no",
      georeference: reference,
    },
  });
  const heights = heightSurface();
  heights.bbox = reference.bounds;
  heights.grid = {
    width: 60,
    height: 60,
    cellWidthM: 0.5,
    cellHeightM: 0.5,
    rowOrder: "north_to_south",
  };
  heights.values = {
    domElevationM: [],
    dtmElevationM: [],
    heightAboveTerrainM: [],
  };
  for (let row = 0; row < 60; row += 1) {
    for (let column = 0; column < 60; column += 1) {
      const z = zAt(-5 + (column + 0.5) * 0.5, 25 - (row + 0.5) * 0.5);
      heights.values.domElevationM.push(100 + z);
      heights.values.dtmElevationM.push(100);
      heights.values.heightAboveTerrainM.push(z);
    }
  }
  heights.quality = {
    ...heights.quality,
    validSamples: 3600,
    totalSamples: 3600,
  };
  heights.provenance.resolutionM = 0.5;
  const saved = parseRoofFusionWorkbenchDraftV1(
    JSON.parse(JSON.stringify(draft)),
  );
  return {
    draft: saved,
    calculate: () =>
      invokeWorkbenchHeightAdapterV1({
        draft: saved,
        targetSnapshotId: "complex-roof-height-r26",
        idempotencyKey: "complex-roof:height:r26",
        requestedAt: "2026-09-05T12:01:00.000Z",
        generatedAt: "2026-09-05T12:01:00.000Z",
        heightSurface: heights,
        orthophoto: {
          sourceId: "norge-i-bilder:91",
          rawContentHash: "a".repeat(64),
          capturedAt: "2026-09-05T11:59:00.000Z",
          attribution: "©norgeibilder.no",
          geoReference: reference,
        },
      }),
  };
}

const branchRidgesAndValleys: PlanLine[] = [
  ["ridge", [9, -4], [9, 12]],
  ["ridge", [0, 3], [9, 3]],
  ["valley", [6, 0], [9, 3]],
  ["valley", [6, 6], [9, 3]],
];

describe("workbench height adapter v1", () => {
  it.each([
    {
      name: "T roof with two ridges and two valleys at the same junction",
      outline: [
        [0, 0],
        [6, 0],
        [6, -4],
        [12, -4],
        [12, 12],
        [6, 12],
        [6, 6],
        [0, 6],
      ] as PlanPoint[],
      lines: branchRidgesAndValleys,
      horizontalArea: 132,
    },
    {
      name: "L roof with two ridges and two valleys at the same junction",
      outline: [
        [0, 0],
        [12, 0],
        [12, 12],
        [6, 12],
        [6, 6],
        [0, 6],
      ] as PlanPoint[],
      lines: branchRidgesAndValleys.map(
        ([kind, start, end]) =>
          [kind, start[1] === -4 ? [9, 0] : start, end] as PlanLine,
      ),
      horizontalArea: 108,
    },
  ])(
    "calculates $name through persisted image coordinates",
    async ({ outline, lines, horizontalArea }) => {
      const fixture = await complexRoofFixture(
        outline,
        lines,
        (x, y) =>
          10 -
          0.5 *
            (x < 6
              ? Math.abs(y - 3)
              : x >= 9 || y < 0 || y > 6
                ? Math.abs(x - 9)
                : Math.min(Math.abs(x - 9), Math.abs(y - 3))),
      );
      const result = fixture.calculate();

      expect(result.summary.status).toBe("review_required");
      expect(result.geometryInput?.surfaces).toHaveLength(5);
      const surfaces = result.snapshot.geometry.surfaces;
      expect(
        surfaces.reduce(
          (sum, surface) => sum + surface.grossHorizontalArea.min!,
          0,
        ),
      ).toBeCloseTo(horizontalArea, 5);
      expect(
        surfaces.reduce(
          (sum, surface) => sum + surface.grossSurfaceArea.min!,
          0,
        ),
      ).toBeCloseTo(horizontalArea * Math.sqrt(1.25), 3);
      const internalEdges = result.snapshot.geometry.edges.filter(
        (edge) => edge.adjacentSurfaceIds.length === 2,
      );
      expect(
        internalEdges.filter((edge) => edge.type === "valley"),
      ).toHaveLength(2);
      expect(
        internalEdges.filter((edge) => edge.type === "ridge"),
      ).toHaveLength(3);
    },
  );

  it("calculates a cross roof with four valleys explicitly sharing the two crossing ridges", async () => {
    const fixture = await complexRoofFixture(
      [
        [6, 0],
        [12, 0],
        [12, 6],
        [18, 6],
        [18, 12],
        [12, 12],
        [12, 18],
        [6, 18],
        [6, 12],
        [0, 12],
        [0, 6],
        [6, 6],
      ],
      [
        ["ridge", [0, 9], [18, 9]],
        ["ridge", [9, 0], [9, 18]],
        ["valley", [6, 6], [9, 9]],
        ["valley", [12, 6], [9, 9]],
        ["valley", [12, 12], [9, 9]],
        ["valley", [6, 12], [9, 9]],
      ],
      (x, y) => 10 - 0.5 * Math.min(Math.abs(x - 9), Math.abs(y - 9)),
    );
    const result = fixture.calculate();

    expect(result.summary.status).toBe("review_required");
    expect(result.geometryInput?.surfaces).toHaveLength(8);
    const surfaces = result.snapshot.geometry.surfaces;
    expect(
      surfaces.reduce(
        (sum, surface) => sum + surface.grossHorizontalArea.min!,
        0,
      ),
    ).toBeCloseTo(180, 5);
    expect(
      surfaces.reduce((sum, surface) => sum + surface.grossSurfaceArea.min!, 0),
    ).toBeCloseTo(180 * Math.sqrt(1.25), 3);
  });

  it("still blocks a genuinely disconnected valley after save and reload", async () => {
    const lines = branchRidgesAndValleys.map(
      ([kind, start, end], index) =>
        [kind, start, index === 3 ? [8.8, 3.2] : end] as PlanLine,
    );
    const fixture = await complexRoofFixture(
      [
        [0, 0],
        [6, 0],
        [6, -4],
        [12, -4],
        [12, 12],
        [6, 12],
        [6, 6],
        [0, 6],
      ],
      lines,
      () => 10,
    );
    const result = fixture.calculate();

    expect(result.summary.status).toBe("blocked");
    expect(result.geometryInput).toBeNull();
    expect(result.summary.blockers.join(" ")).toContain(
      "SKELETON_DANGLING_ENDPOINT",
    );
  });

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
