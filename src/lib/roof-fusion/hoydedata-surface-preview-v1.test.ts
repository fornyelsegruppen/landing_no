import { describe, expect, it } from "vitest";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import { etrs89ToUtm33 } from "@/lib/providers/kartverket-hoydedata-provider";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import { buildRoofFusionHeightSurfacePreviewV1 } from "./hoydedata-surface-preview-v1";

const address = {
  id: "0301-207-168-0-0-Karl-Johans-gate-1",
  label: "Karl Johans gate 1, 0154 OSLO",
  postalCode: "0154",
  city: "OSLO",
  latitude: 59.91137749505985,
  longitude: 10.749403964838672,
  source: "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
};

const candidate: BuildingFootprintCandidate = {
  id: "way/112089421",
  label: "Karl Johans gate 1",
  polygon: [
    { latitude: 59.9113, longitude: 10.74925 },
    { latitude: 59.9113, longitude: 10.74955 },
    { latitude: 59.9115, longitude: 10.74955 },
    { latitude: 59.9115, longitude: 10.74925 },
  ],
  horizontalAreaSquareMeters: 373.2,
  distanceToAddressMeters: 0,
  containsAddress: true,
  confidence: "high",
  confidenceReasoning: "Address point is inside the building footprint",
  source: "OpenStreetMap building footprint via Overpass API",
  sourceUrl: "https://www.openstreetmap.org/way/112089421",
  license: "Open Database License (ODbL) 1.0",
  credits: "© OpenStreetMap contributors",
};

function fixtureSurface(
  heightAboveTerrainM = 8,
  roofHeightAt?: (point: { x: number; y: number }) => number,
): KartverketHeightSurfaceV1 {
  const projected = candidate.polygon.map(etrs89ToUtm33);
  const bbox = {
    minEastingM: Math.floor(
      Math.min(...projected.map((point) => point.eastingM)) - 4,
    ),
    minNorthingM: Math.floor(
      Math.min(...projected.map((point) => point.northingM)) - 4,
    ),
    maxEastingM: Math.ceil(
      Math.max(...projected.map((point) => point.eastingM)) + 4,
    ),
    maxNorthingM: Math.ceil(
      Math.max(...projected.map((point) => point.northingM)) + 4,
    ),
  };
  const width = bbox.maxEastingM - bbox.minEastingM;
  const height = bbox.maxNorthingM - bbox.minNorthingM;
  const totalSamples = width * height;
  const domElevationM: number[] = [];
  const heightAboveTerrain: number[] = [];
  for (let row = 0; row < height; row += 1) {
    const y = bbox.maxNorthingM - (row + 0.5);
    for (let column = 0; column < width; column += 1) {
      const x = bbox.minEastingM + column + 0.5;
      const roofHeight = roofHeightAt?.({ x, y }) ?? heightAboveTerrainM;
      domElevationM.push(5 + roofHeight);
      heightAboveTerrain.push(roofHeight);
    }
  }
  return {
    schemaVersion: "kartverket-height-surface.v1",
    provider: "Kartverket Nasjonal detaljert høydemodell WCS",
    coordinateSystem: "EPSG:25833",
    bbox,
    grid: {
      width,
      height,
      cellWidthM: 1,
      cellHeightM: 1,
      rowOrder: "north_to_south",
    },
    values: {
      domElevationM,
      dtmElevationM: Array(totalSamples).fill(5),
      heightAboveTerrainM: heightAboveTerrain,
    },
    quality: {
      status: "usable",
      coverageRatio: 1,
      validSamples: totalSamples,
      totalSamples,
      maxHeightAboveTerrainM: Math.max(...heightAboveTerrain),
      reasons: ["Synthetic matching DOM and DTM fixture"],
    },
    provenance: {
      retrievedAt: "2026-09-02T13:00:00.000Z",
      domCoverageId: "nhm_dom_topo_25833",
      dtmCoverageId: "nhm_dtm_topo_25833",
      domContentSha256: "a".repeat(64),
      dtmContentSha256: "b".repeat(64),
      resolutionM: 1,
      license: "Norsk lisens for offentlige data (NLOD) 2.0",
      attribution: "Kartverket",
    },
  };
}

describe("Roof Fusion Høydedata surface Preview", () => {
  it("clips DOM minus DTM cells to the selected footprint and reuses canonical contracts", () => {
    const result = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate,
      surface: fixtureSurface(),
    });
    expect(result.summary).toMatchObject({
      schemaVersion: "roof-fusion-height-surface-preview.v1",
      contractStatus: "valid",
      reviewState: "review_required",
      qualityStatus: "review_required",
      measurementClass: "preliminary",
      pricingReady: false,
      roofHeightMedianM: 8,
      roofHeightP10M: 8,
      roofHeightP90M: 8,
      blockers: ["ROOF_SURFACE_RENDER_REQUIRED"],
    });
    expect(result.summary.roofCells).toBeGreaterThan(100);
    expect(result.summary.roofCoverageRatio).toBe(1);
    expect(
      result.geometryInput.provenance.sources.map((source) => source.kind),
    ).toEqual(["address_anchor", "building_footprint", "lidar", "lidar"]);
    expect(result.calculation.schemaVersion).toBe(
      "roof-geometry-calculation.v1",
    );
    expect(result.sourceResult.schemaVersion).toBe("roof-source-result.v1");
    expect(result.snapshot.schemaVersion).toBe("roof-snapshot.v1");
    expect(result.snapshot.rendererPayload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "lidar", attribution: "Kartverket" }),
      ]),
    );
  });

  it("fails closed when the selected building has no elevated roof cells", () => {
    expect(() =>
      buildRoofFusionHeightSurfacePreviewV1({
        address,
        candidate,
        surface: fixtureSurface(0.5),
      }),
    ).toThrow("continuous elevated roof surface");
  });

  it("is deterministic for identical provider inputs", () => {
    const left = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate,
      surface: fixtureSurface(),
    });
    const right = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate,
      surface: fixtureSurface(),
    });
    expect(left.summary.snapshotHash).toBe(right.summary.snapshotHash);
    expect(left.summary.calculationHash).toBe(right.summary.calculationHash);
  });

  it("uses a reliable Høydedata gable as canonical preliminary geometry", () => {
    const projected = candidate.polygon.map(etrs89ToUtm33);
    const centerX =
      projected.reduce((sum, point) => sum + point.eastingM, 0) /
      projected.length;
    const result = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate,
      surface: fixtureSurface(
        8,
        (point) => 12 - Math.abs(point.x - centerX) * 0.5,
      ),
    });

    expect(result.segmentation?.roofType).toBe("gable");
    expect(result.geometryInput.surfaces).toHaveLength(2);
    expect(result.calculation.trace.surfaces).toHaveLength(2);
    expect(
      result.calculation.trace.surfaces.every(
        (plane) => plane.surfaceAreaM2 > plane.horizontalAreaM2,
      ),
    ).toBe(true);
    expect(result.snapshot.geometry.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "ridge" })]),
    );
    expect(result.summary.pricingReady).toBe(false);
    expect(result.summary.reviewState).toBe("review_required");
  });

  it("re-fits a two-click ridge Preview correction without making it pricing-ready", () => {
    const projected = candidate.polygon.map(etrs89ToUtm33);
    const centerX =
      projected.reduce((sum, point) => sum + point.eastingM, 0) /
      projected.length;
    const surface = fixtureSurface(
      8,
      (point) => 12 - Math.abs(point.x - centerX) * 0.5,
    );
    const normalize = (point: { eastingM: number; northingM: number }) => ({
      x:
        (point.eastingM - surface.bbox.minEastingM) /
        (surface.bbox.maxEastingM - surface.bbox.minEastingM),
      y:
        (surface.bbox.maxNorthingM - point.northingM) /
        (surface.bbox.maxNorthingM - surface.bbox.minNorthingM),
    });
    const result = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate,
      surface,
      manualRidge: [
        normalize({
          eastingM: (projected[0].eastingM + projected[1].eastingM) / 2,
          northingM: (projected[0].northingM + projected[1].northingM) / 2,
        }),
        normalize({
          eastingM: (projected[2].eastingM + projected[3].eastingM) / 2,
          northingM: (projected[2].northingM + projected[3].northingM) / 2,
        }),
      ],
    });

    expect(result.segmentation?.roofType).toBe("gable");
    expect(result.segmentation?.ridge?.lengthMeters).toBeGreaterThan(15);
    expect(result.geometryInput.surfaces).toHaveLength(2);
    expect(result.segmentation?.ridge?.lengthMeters).toBeCloseTo(
      result.calculation.trace.edges.find(
        (edge) => edge.classification === "ridge",
      )?.length2dM ?? -1,
      3,
    );
    expect(result.summary).toMatchObject({
      reviewState: "review_required",
      pricingReady: false,
      blockers: ["ROOF_SURFACE_RENDER_REQUIRED"],
    });
  });

  it("uses the original preliminary fallback when Høydedata quality is limited", () => {
    const surface = fixtureSurface();
    surface.quality.status = "limited";
    const result = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate,
      surface,
    });

    expect(result.segmentation).toBeNull();
    expect(result.geometryInput.surfaces).toHaveLength(1);
    expect(result.summary.pricingReady).toBe(false);
    expect(result.summary.blockers).toEqual([
      "ROOF_PLANES_REQUIRED",
      "ROOF_PITCH_REQUIRED",
      "ROOF_SURFACE_RENDER_REQUIRED",
    ]);
  });

  it("uses the original preliminary fallback for a complex footprint", () => {
    const complexCandidate: BuildingFootprintCandidate = {
      ...candidate,
      polygon: [
        candidate.polygon[0],
        candidate.polygon[1],
        { latitude: 59.9114, longitude: 10.7494 },
        candidate.polygon[2],
        candidate.polygon[3],
      ],
    };
    const result = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: complexCandidate,
      surface: fixtureSurface(),
    });

    expect(result.segmentation).toBeNull();
    expect(result.summary.manualRidgeCorrectionStatus).toBe(
      "unsupported_footprint",
    );
    expect(result.geometryInput.surfaces).toHaveLength(1);
    expect(result.summary.pricingReady).toBe(false);
  });
});
