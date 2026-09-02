import { describe, expect, it } from "vitest";
import {
  etrs89ToUtm33,
  type KartverketHeightSurfaceV1,
} from "@/lib/providers/kartverket-hoydedata-provider";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  segmentSimpleRoofPlanesV1,
  segmentSimpleRoofPlanesWithRidgeV1,
  SimpleRoofPlaneSegmentationError,
} from "./simple-roof-plane-segmentation-v1";

const candidate: BuildingFootprintCandidate = {
  id: "way/7001",
  label: "Synthetic simple roof",
  polygon: [
    { latitude: 59.9, longitude: 10.7 },
    { latitude: 59.9, longitude: 10.70035 },
    { latitude: 59.90018, longitude: 10.70035 },
    { latitude: 59.90018, longitude: 10.7 },
  ],
  horizontalAreaSquareMeters: 400,
  distanceToAddressMeters: 0,
  containsAddress: true,
  confidence: "high",
  confidenceReasoning: "Synthetic address point is inside the footprint",
  source: "OpenStreetMap building footprint via Overpass API",
  sourceUrl: "https://www.openstreetmap.org/way/7001",
  license: "Open Database License (ODbL) 1.0",
  credits: "© OpenStreetMap contributors",
};

function surfaceFixture(
  roof: (
    point: { x: number; y: number },
    center: { x: number; y: number },
  ) => number,
): KartverketHeightSurfaceV1 {
  const polygon = candidate.polygon.map(etrs89ToUtm33);
  const bbox = {
    minEastingM: Math.floor(
      Math.min(...polygon.map((point) => point.eastingM)) - 4,
    ),
    minNorthingM: Math.floor(
      Math.min(...polygon.map((point) => point.northingM)) - 4,
    ),
    maxEastingM: Math.ceil(
      Math.max(...polygon.map((point) => point.eastingM)) + 4,
    ),
    maxNorthingM: Math.ceil(
      Math.max(...polygon.map((point) => point.northingM)) + 4,
    ),
  };
  const center = {
    x: polygon.reduce((sum, point) => sum + point.eastingM, 0) / polygon.length,
    y:
      polygon.reduce((sum, point) => sum + point.northingM, 0) / polygon.length,
  };
  const width = bbox.maxEastingM - bbox.minEastingM;
  const height = bbox.maxNorthingM - bbox.minNorthingM;
  const domElevationM: number[] = [];
  const dtmElevationM: number[] = [];
  const heightAboveTerrainM: number[] = [];
  for (let row = 0; row < height; row += 1) {
    const y = bbox.maxNorthingM - (row + 0.5);
    for (let column = 0; column < width; column += 1) {
      const x = bbox.minEastingM + column + 0.5;
      const roofHeight = roof({ x, y }, center);
      dtmElevationM.push(100);
      domElevationM.push(100 + roofHeight);
      heightAboveTerrainM.push(roofHeight);
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
    values: { domElevationM, dtmElevationM, heightAboveTerrainM },
    quality: {
      status: "usable",
      coverageRatio: 1,
      validSamples: width * height,
      totalSamples: width * height,
      maxHeightAboveTerrainM: Math.max(...heightAboveTerrainM),
      reasons: ["Synthetic plane segmentation fixture"],
    },
    provenance: {
      retrievedAt: "2026-09-02T16:00:00.000Z",
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

describe("simple Roof Fusion plane segmentation", () => {
  it("fits two planes around an administrator-selected normalized ridge", () => {
    const surface = surfaceFixture(
      (point, center) => 12 - Math.abs(point.x - center.x) * 0.5,
    );
    const polygon = candidate.polygon.map(etrs89ToUtm33);
    const normalize = (x: number, y: number) => ({
      x:
        (x - surface.bbox.minEastingM) /
        (surface.bbox.maxEastingM - surface.bbox.minEastingM),
      y:
        (surface.bbox.maxNorthingM - y) /
        (surface.bbox.maxNorthingM - surface.bbox.minNorthingM),
    });

    const result = segmentSimpleRoofPlanesWithRidgeV1({
      candidate,
      surface,
      ridge: [
        normalize(
          (polygon[0].eastingM + polygon[1].eastingM) / 2,
          (polygon[0].northingM + polygon[1].northingM) / 2,
        ),
        normalize(
          (polygon[2].eastingM + polygon[3].eastingM) / 2,
          (polygon[2].northingM + polygon[3].northingM) / 2,
        ),
      ],
    });

    expect(result.roofType).toBe("gable");
    expect(result.planes).toHaveLength(2);
    expect(result.ridge?.lengthMeters).toBeGreaterThan(15);
    expect(result.fitRmseM).toBeLessThan(0.25);
    expect(result.assumptions).toContain(
      "An administrator selected one straight ridge in the Preview height surface",
    );
  });

  it("fails closed for manual ridge points outside the footprint or below 2 metres", () => {
    const surface = surfaceFixture(
      (point, center) => 12 - Math.abs(point.x - center.x) * 0.5,
    );
    expect(() =>
      segmentSimpleRoofPlanesWithRidgeV1({
        candidate,
        surface,
        ridge: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
    ).toThrow("inside or on the selected footprint");
    expect(() =>
      segmentSimpleRoofPlanesWithRidgeV1({
        candidate,
        surface,
        ridge: [
          { x: 0.5, y: 0.5 },
          { x: 0.50001, y: 0.50001 },
        ],
      }),
    ).toThrow("at least 2 metres long");
  });

  it("detects a deterministic two-plane gable with ridge, pitch, and sloped area", () => {
    const result = segmentSimpleRoofPlanesV1({
      candidate,
      surface: surfaceFixture(
        (point, center) => 12 - Math.abs(point.x - center.x) * 0.5,
      ),
    });

    expect(result.schemaVersion).toBe("simple-roof-plane-segmentation.v1");
    expect(result.roofType).toBe("gable");
    expect(result.planes).toHaveLength(2);
    expect(result.ridge?.lengthMeters).toBeGreaterThan(15);
    expect(result.fitRmseM).toBeLessThan(0.1);
    expect(result.planes.map((plane) => plane.pitchDegrees)).toEqual([
      expect.closeTo(26.57, 1),
      expect.closeTo(26.57, 1),
    ]);
    expect(
      result.planes.reduce(
        (sum, plane) => sum + plane.surfaceAreaSquareMeters,
        0,
      ),
    ).toBeGreaterThan(
      result.planes.reduce(
        (sum, plane) => sum + plane.horizontalAreaSquareMeters,
        0,
      ),
    );
  });

  it("detects a near-horizontal roof as one flat plane", () => {
    const result = segmentSimpleRoofPlanesV1({
      candidate,
      surface: surfaceFixture(() => 8),
    });

    expect(result.roofType).toBe("flat");
    expect(result.planes).toHaveLength(1);
    expect(result.planes[0].pitchDegrees).toBe(0);
    expect(result.ridge).toBeNull();
  });

  it("detects a reliable single sloped roof as mono", () => {
    const result = segmentSimpleRoofPlanesV1({
      candidate,
      surface: surfaceFixture(
        (point, center) => 8 - (point.y - center.y) * 0.2,
      ),
    });

    expect(result.roofType).toBe("mono");
    expect(result.planes).toHaveLength(1);
    expect(result.planes[0].pitchDegrees).toBeCloseTo(11.31, 1);
    expect(result.planes[0].azimuthDegrees).toBe(0);
    expect(result.planes[0].surfaceAreaSquareMeters).toBeGreaterThan(
      result.planes[0].horizontalAreaSquareMeters,
    );
  });

  it("fails closed when elevated cells do not cover enough of the footprint", () => {
    const surface = surfaceFixture(() => 8);
    surface.values.heightAboveTerrainM = surface.values.heightAboveTerrainM.map(
      (_, index) => (index % 4 === 0 ? 8 : 0),
    );
    surface.values.domElevationM = surface.values.domElevationM.map(
      (_, index) => (index % 4 === 0 ? 108 : 100),
    );

    expect(() => segmentSimpleRoofPlanesV1({ candidate, surface })).toThrow(
      "coverage after outlier filtering is too sparse",
    );
  });

  it("fails closed when no simple plane model is reliable", () => {
    expect(() =>
      segmentSimpleRoofPlanesV1({
        candidate,
        surface: surfaceFixture((point) =>
          (Math.floor(point.x) + Math.floor(point.y)) % 2 === 0 ? 6 : 12,
        ),
      }),
    ).toThrow(SimpleRoofPlaneSegmentationError);
  });

  it("rejects limited provider quality even when the samples look planar", () => {
    const surface = surfaceFixture(() => 8);
    surface.quality.status = "limited";

    expect(() => segmentSimpleRoofPlanesV1({ candidate, surface })).toThrow(
      "does not match the simple-roof segmentation contract",
    );
  });
});
