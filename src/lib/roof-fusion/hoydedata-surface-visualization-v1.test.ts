import { describe, expect, it } from "vitest";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import { buildHeightSurfaceVisualizationV1 } from "./hoydedata-surface-visualization-v1";

const candidate: BuildingFootprintCandidate = {
  id: "way/1",
  label: "Test roof",
  polygon: [
    { latitude: 59.9, longitude: 10.7 },
    { latitude: 59.9, longitude: 10.7001 },
    { latitude: 59.9001, longitude: 10.7001 },
    { latitude: 59.9001, longitude: 10.7 },
  ],
  horizontalAreaSquareMeters: 62,
  distanceToAddressMeters: 0,
  containsAddress: true,
  confidence: "high",
  confidenceReasoning: "fixture",
  source: "OpenStreetMap building footprint via Overpass API",
  sourceUrl: "https://www.openstreetmap.org/way/1",
  license: "Open Database License (ODbL) 1.0",
  credits: "© OpenStreetMap contributors",
};

const surface: KartverketHeightSurfaceV1 = {
  schemaVersion: "kartverket-height-surface.v1",
  provider: "Kartverket Nasjonal detaljert høydemodell WCS",
  coordinateSystem: "EPSG:25833",
  bbox: {
    minEastingM: 259_000,
    minNorthingM: 6_647_000,
    maxEastingM: 260_000,
    maxNorthingM: 6_648_000,
  },
  grid: {
    width: 4,
    height: 4,
    cellWidthM: 250,
    cellHeightM: 250,
    rowOrder: "north_to_south",
  },
  values: {
    domElevationM: [
      10, 10, 11, 12, 10, 12, 14, 13, 9, 11, 13, 12, 8, 9, 10, 10,
    ],
    dtmElevationM: Array(16).fill(5),
    heightAboveTerrainM: [5, 5, 6, 7, 5, 7, 9, 8, 4, 6, 8, 7, 3, 4, 5, 5],
  },
  quality: {
    status: "usable",
    coverageRatio: 1,
    validSamples: 16,
    totalSamples: 16,
    maxHeightAboveTerrainM: 9,
    reasons: ["fixture"],
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

describe("Høydedata surface visualization", () => {
  it("renders deterministic shaded relief and a co-registered footprint", async () => {
    const result = await buildHeightSurfaceVisualizationV1({
      surface,
      candidate,
    });
    expect(result).toMatchObject({
      schemaVersion: "height-surface-visualization.v1",
      mimeType: "image/png",
      width: 4,
      height: 4,
      minHeightAboveTerrainM: 3,
      maxHeightAboveTerrainM: 9,
      attribution:
        "Kartverket · NLOD 2.0 + OpenStreetMap contributors · ODbL 1.0",
    });
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/u);
    expect(result.overlayPoints.split(" ")).toHaveLength(4);
  });
});
