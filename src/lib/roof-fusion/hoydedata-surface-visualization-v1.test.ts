import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  etrs89ToUtm33,
  type KartverketHeightSurfaceV1,
} from "@/lib/providers/kartverket-hoydedata-provider";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import { segmentSimpleRoofPlanesV1 } from "./simple-roof-plane-segmentation-v1";
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

function segmentationSurfaceFixture(
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
      reasons: ["Synthetic visualization fixture"],
    },
    provenance: {
      retrievedAt: "2026-09-02T16:00:00.000Z",
      domCoverageId: "nhm_dom_topo_25833",
      dtmCoverageId: "nhm_dtm_topo_25833",
      domContentSha256: "c".repeat(64),
      dtmContentSha256: "d".repeat(64),
      resolutionM: 1,
      license: "Norsk lisens for offentlige data (NLOD) 2.0",
      attribution: "Kartverket",
    },
  };
}

const dataUrlPrefix = "data:image/png;base64,";

function decodeDataUrl(dataUrl: string) {
  return Buffer.from(dataUrl.slice(dataUrlPrefix.length), "base64");
}

function sha256(dataUrl: string) {
  return createHash("sha256").update(decodeDataUrl(dataUrl)).digest("hex");
}

describe("Høydedata surface visualization", () => {
  it("renders a deterministic high-resolution relief with unchanged overlay geometry", async () => {
    const first = await buildHeightSurfaceVisualizationV1({
      surface,
      candidate,
    });
    const second = await buildHeightSurfaceVisualizationV1({
      surface,
      candidate,
    });
    expect(first).toMatchObject({
      schemaVersion: "height-surface-visualization.v1",
      mimeType: "image/png",
      width: 4,
      height: 4,
      planes: null,
      ridge: null,
      minHeightAboveTerrainM: 3,
      maxHeightAboveTerrainM: 9,
      attribution:
        "Kartverket · NLOD 2.0 + OpenStreetMap contributors · ODbL 1.0",
    });
    expect(first.overlayPoints.split(" ")).toHaveLength(4);
    expect(first.overlayPoints).toBe(second.overlayPoints);
    expect(first.dataUrl).toBe(second.dataUrl);
    expect(sha256(first.dataUrl)).toBe(sha256(second.dataUrl));

    const metadata = await sharp(decodeDataUrl(first.dataUrl))
      .metadata()
      .then((details) => details);
    expect(metadata.width).toBeGreaterThan(4);
    expect(metadata.height).toBeGreaterThan(4);
    const expectedScale = Math.min(
      32,
      Math.max(
        4,
        Math.ceil(
          1024 / Math.max(surface.grid.width, surface.grid.height),
        ),
      ),
    );
    expect(metadata.width).toBe(surface.grid.width * expectedScale);
    expect(metadata.height).toBe(surface.grid.height * expectedScale);

    const rendered = await sharp(decodeDataUrl(first.dataUrl))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { data: renderedPixels, info: renderedInfo } = rendered;
    let contrastScore = 0;
    for (let row = 0; row < renderedInfo.height - 1; row += 1) {
      for (let column = 0; column < renderedInfo.width - 1; column += 1) {
        const idx = (row * renderedInfo.width + column) * 4;
        const rightIdx = idx + 4;
        const downIdx = idx + renderedInfo.width * 4;
        const luminance = Math.round(
          renderedPixels[idx] * 0.299 +
            renderedPixels[idx + 1] * 0.587 +
            renderedPixels[idx + 2] * 0.114,
        );
        const rightLuminance = Math.round(
          renderedPixels[rightIdx] * 0.299 +
            renderedPixels[rightIdx + 1] * 0.587 +
            renderedPixels[rightIdx + 2] * 0.114,
        );
        const downLuminance = Math.round(
          renderedPixels[downIdx] * 0.299 +
            renderedPixels[downIdx + 1] * 0.587 +
            renderedPixels[downIdx + 2] * 0.114,
        );
        contrastScore += Math.abs(luminance - rightLuminance);
        if (row < renderedInfo.height - 1) {
          contrastScore += Math.abs(luminance - downLuminance);
        }
      }
    }
    if (renderedInfo.height < 2 || renderedInfo.width < 2) {
      throw new Error("Rendered visualization is too small");
    }
    expect(contrastScore).toBeGreaterThan(
      renderedInfo.width * renderedInfo.height * 0.45,
    );
  });

  it("projects optional roof-plane segmentation overlays and ridge onto the same surface", async () => {
    const segmentationSurface = segmentationSurfaceFixture(
      (point, center) => 12 - Math.abs(point.x - center.x) * 0.5,
    );
    const segmentation = segmentSimpleRoofPlanesV1({
      candidate,
      surface: segmentationSurface,
    });

    const result = await buildHeightSurfaceVisualizationV1({
      surface: segmentationSurface,
      candidate,
      segmentation,
    });

    expect(result.planes).toHaveLength(2);
    expect(result.planes?.map((plane) => plane.pitchDegrees)).toEqual(
      segmentation.planes.map((plane) => plane.pitchDegrees),
    );
    expect(
      result.planes?.every((plane) => plane.overlayPoints.length > 0),
    ).toBe(true);
    expect(result.ridge?.overlayPoints.split(" ")).toHaveLength(2);
    expect(result.ridge?.lengthMeters).toBe(segmentation.ridge?.lengthMeters);
  });
});
