import { describe, expect, it } from "vitest";
import {
  etrs89ToUtm33,
  type KartverketHeightSurfaceV1,
} from "@/lib/providers/kartverket-hoydedata-provider";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import { buildRoofFusionHeightSurfacePreviewV1 } from "./hoydedata-surface-preview-v1";

const address = {
  id: "0301-207-168-0-0-H3-Kalibrering-1",
  label: "H3 Kalibrering 1, 0154 OSLO",
  postalCode: "0154",
  city: "OSLO",
  latitude: 59.91137749505985,
  longitude: 10.749403964838672,
  source: "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
};

const baseCandidate: BuildingFootprintCandidate = {
  id: "way/7001-h3-calibration",
  label: "Synthetic H3 calibration roof",
  polygon: [
    { latitude: 59.91128, longitude: 10.74923 },
    { latitude: 59.91128, longitude: 10.74959 },
    { latitude: 59.91148, longitude: 10.74959 },
    { latitude: 59.91148, longitude: 10.74923 },
  ],
  horizontalAreaSquareMeters: 430,
  distanceToAddressMeters: 0,
  containsAddress: true,
  confidence: "high",
  confidenceReasoning: "Synthetic address point is inside the footprint",
  source: "OpenStreetMap building footprint via Overpass API",
  sourceUrl: "https://www.openstreetmap.org/way/7001",
  license: "Open Database License (ODbL) 1.0",
  credits: "© OpenStreetMap contributors",
};

type Point = { x: number; y: number };
type RoofHeightFn = (
  point: Point,
  center: Point,
  row: number,
  column: number,
) => number;

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function projectedPolygon(candidate: BuildingFootprintCandidate) {
  return candidate.polygon.map((point) => {
    const projected = etrs89ToUtm33(point);
    return { x: projected.eastingM, y: projected.northingM };
  });
}

function polygonBounds(polygon: Point[]) {
  return {
    minX: Math.min(...polygon.map((point) => point.x)),
    maxX: Math.max(...polygon.map((point) => point.x)),
    minY: Math.min(...polygon.map((point) => point.y)),
    maxY: Math.max(...polygon.map((point) => point.y)),
  };
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function complexCandidate() {
  return {
    ...baseCandidate,
    id: "way/7001-h3-complex",
    polygon: [
      baseCandidate.polygon[0],
      baseCandidate.polygon[1],
      { latitude: 59.91137, longitude: 10.74943 },
      baseCandidate.polygon[2],
      baseCandidate.polygon[3],
    ],
  } satisfies BuildingFootprintCandidate;
}

const complexRoofCandidate = complexCandidate();

function buildSurfaceFixture(input: {
  candidate?: BuildingFootprintCandidate;
  roofHeightAt: RoofHeightFn;
  cellSizeM?: number;
  squareGridSize?: number;
  qualityStatus?: "usable" | "limited";
  domHash?: string;
  dtmHash?: string;
  retrievedAt?: string;
}) {
  const candidate = input.candidate ?? baseCandidate;
  const polygon = projectedPolygon(candidate);
  const bounds = polygonBounds(polygon);
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const cellSizeM = input.cellSizeM ?? 1;
  const defaultWidth = Math.ceil((bounds.maxX - bounds.minX + 8) / cellSizeM);
  const defaultHeight = Math.ceil((bounds.maxY - bounds.minY + 8) / cellSizeM);
  const width = Math.max(defaultWidth, input.squareGridSize ?? 0);
  const height = Math.max(defaultHeight, input.squareGridSize ?? 0);
  const halfWidthM = (width * cellSizeM) / 2;
  const halfHeightM = (height * cellSizeM) / 2;
  const bbox = {
    minEastingM: center.x - halfWidthM,
    minNorthingM: center.y - halfHeightM,
    maxEastingM: center.x + halfWidthM,
    maxNorthingM: center.y + halfHeightM,
  };

  const totalSamples = width * height;
  const domElevationM: number[] = [];
  const dtmElevationM: number[] = [];
  const heightAboveTerrainM: number[] = [];
  for (let row = 0; row < height; row += 1) {
    const y = bbox.maxNorthingM - (row + 0.5) * cellSizeM;
    for (let column = 0; column < width; column += 1) {
      const x = bbox.minEastingM + (column + 0.5) * cellSizeM;
      const roofHeight = input.roofHeightAt({ x, y }, center, row, column);
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
      cellWidthM: cellSizeM,
      cellHeightM: cellSizeM,
      rowOrder: "north_to_south" as const,
    },
    values: { domElevationM, dtmElevationM, heightAboveTerrainM },
    quality: {
      status: input.qualityStatus ?? "usable",
      coverageRatio: 1,
      validSamples: totalSamples,
      totalSamples,
      maxHeightAboveTerrainM: Math.max(...heightAboveTerrainM),
      reasons: ["Synthetic H3 calibration fixture"],
    },
    provenance: {
      retrievedAt: input.retrievedAt ?? "2026-09-02T18:00:00.000Z",
      domCoverageId: "nhm_dom_topo_25833",
      dtmCoverageId: "nhm_dtm_topo_25833",
      domContentSha256: input.domHash ?? "1".repeat(64),
      dtmContentSha256: input.dtmHash ?? "2".repeat(64),
      resolutionM: cellSizeM,
      license: "Norsk lisens for offentlige data (NLOD) 2.0",
      attribution: "Kartverket",
    },
  } satisfies KartverketHeightSurfaceV1;
}

function expectSlopedAreaInvariant(
  horizontalAreaM2: number,
  surfaceAreaM2: number,
  pitchDegrees: number,
  toleranceM2: number,
) {
  const expectedSurfaceAreaM2 =
    horizontalAreaM2 / Math.cos((pitchDegrees * Math.PI) / 180);
  expect(surfaceAreaM2).toBeCloseTo(expectedSurfaceAreaM2, toleranceM2);
}

function ridgeEdge(
  result: ReturnType<typeof buildRoofFusionHeightSurfacePreviewV1>,
) {
  return result.calculation.trace.edges.find(
    (edge) => edge.classification === "ridge",
  );
}

describe("Roof Fusion Høydedata H3 calibration/adversarial v1", () => {
  it("pins flat and mono previews with horizontal/sloped area invariants", () => {
    const flat = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: baseCandidate,
      surface: buildSurfaceFixture({
        roofHeightAt: () => 8,
        domHash: "a".repeat(64),
        dtmHash: "b".repeat(64),
      }),
    });

    const mono = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: baseCandidate,
      surface: buildSurfaceFixture({
        roofHeightAt: (point, center) => 9 - (point.y - center.y) * 0.18,
        domHash: "c".repeat(64),
        dtmHash: "d".repeat(64),
      }),
    });

    expect(flat.segmentation?.roofType).toBe("flat");
    expect(flat.geometryInput.surfaces).toHaveLength(1);
    expect(flat.calculation.trace.surfaces[0].pitchDegrees).toBe(0);
    expect(flat.calculation.trace.surfaces[0].surfaceAreaM2).toBeCloseTo(
      flat.calculation.trace.surfaces[0].horizontalAreaM2,
      3,
    );
    expect(flat.summary).toMatchObject({
      calculationHash:
        "0513aecaa569eca7461fadcefc387f104fbfff875b2c8544419a38220ebaf7f8",
      snapshotHash:
        "398c116f55fff78dabbc701d0fa1e2753b00d12e2a98431c7b0dddaaa5a44152",
      renderHash:
        "7d4095b9dfd928f1ede0d1af35db0577bd07c78bae46ad30c24cfea6da31d240",
    });

    expect(mono.segmentation?.roofType).toBe("mono");
    expect(mono.geometryInput.surfaces).toHaveLength(1);
    expect(mono.calculation.trace.surfaces[0].pitchDegrees).toBeCloseTo(
      10.204,
      3,
    );
    expectSlopedAreaInvariant(
      mono.calculation.trace.surfaces[0].horizontalAreaM2,
      mono.calculation.trace.surfaces[0].surfaceAreaM2,
      mono.calculation.trace.surfaces[0].pitchDegrees,
      3,
    );
    expect(mono.summary).toMatchObject({
      calculationHash:
        "18847e29ac9501a5c268ef00ff37c0ca3d0d4fbd1bb5be41ecd2facc97577ee8",
      snapshotHash:
        "33d76452d25799cd364becfb63b077e8c686fafa635beb80514e83023dbb5821",
      renderHash:
        "f3ed50d845e47c3e7417bd681962b7ca282e37906be44f69dae53c60111fd183",
    });
  });

  it("pins gable variants, pitch tolerances, and ridge adjacency", () => {
    const gable = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: baseCandidate,
      surface: buildSurfaceFixture({
        roofHeightAt: (point, center) =>
          12 - Math.abs(point.x - center.x) * 0.45,
        domHash: "e".repeat(64),
        dtmHash: "f".repeat(64),
      }),
    });

    const asymmetricGable = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: baseCandidate,
      surface: buildSurfaceFixture({
        roofHeightAt: (point, center) =>
          point.x <= center.x
            ? 13 - (center.x - point.x) * 0.32
            : 13 - (point.x - center.x) * 0.58,
        domHash: "9".repeat(64),
        dtmHash: "8".repeat(64),
      }),
    });

    const noisyGable = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: baseCandidate,
      surface: buildSurfaceFixture({
        roofHeightAt: (point, center, row, column) => {
          const base = 12 - Math.abs(point.x - center.x) * 0.45;
          if (
            Math.abs(point.x - center.x) < 0.6 &&
            Math.abs(point.y - center.y) < 0.6
          ) {
            return 28;
          }
          if (
            (row + column) % 97 === 0 &&
            pointInPolygon(point, projectedPolygon(baseCandidate))
          ) {
            return 20;
          }
          return base;
        },
        domHash: "7".repeat(64),
        dtmHash: "6".repeat(64),
      }),
    });

    expect(gable.segmentation?.roofType).toBe("gable");
    expect(gable.geometryInput.surfaces).toHaveLength(2);
    expect(gable.calculation.trace.surfaces).toHaveLength(2);
    expect(
      gable.calculation.trace.surfaces.map((surface) => surface.pitchDegrees),
    ).toEqual([expect.closeTo(24.228, 3), expect.closeTo(24.228, 3)]);
    for (const surface of gable.calculation.trace.surfaces) {
      expectSlopedAreaInvariant(
        surface.horizontalAreaM2,
        surface.surfaceAreaM2,
        surface.pitchDegrees,
        3,
      );
    }
    expect(ridgeEdge(gable)).toMatchObject({
      classification: "ridge",
      length2dM: expect.closeTo(22.335, 3),
      adjacentSurfaceIds: expect.arrayContaining([
        gable.calculation.trace.surfaces[0].surfaceId,
        gable.calculation.trace.surfaces[1].surfaceId,
      ]),
    });
    expect(gable.summary).toMatchObject({
      calculationHash:
        "5cde2ca79cd8dca8f1b2b4129510295477bd051b2fd5a33e6320fbee3a0d6cfe",
      snapshotHash:
        "f99cc117a7cf0a756c347fab088bfa12a036928a564d4c95673858cc75a447e4",
      renderHash:
        "0a7dacc456ca5df74edecfe3b492b2376b8d261eb03db2cba1b786df78cdd7bf",
    });

    expect(asymmetricGable.segmentation?.roofType).toBe("gable");
    expect(asymmetricGable.calculation.trace.surfaces).toHaveLength(2);
    expect(
      asymmetricGable.calculation.trace.surfaces.map(
        (surface) => surface.pitchDegrees,
      ),
    ).toEqual([expect.closeTo(17.745, 3), expect.closeTo(30.114, 3)]);
    expect(ridgeEdge(asymmetricGable)).toMatchObject({
      classification: "ridge",
      length2dM: expect.closeTo(22.335, 3),
      adjacentSurfaceIds: expect.arrayContaining([
        asymmetricGable.calculation.trace.surfaces[0].surfaceId,
        asymmetricGable.calculation.trace.surfaces[1].surfaceId,
      ]),
    });
    expect(asymmetricGable.summary).toMatchObject({
      calculationHash:
        "893d9e89f9106deb750fc38311553fdd3158da2a3ec6b1baa35e9a3d34f3726f",
      snapshotHash:
        "496bf8c93964e3086d31fe36cb231868fa3d0cb7c60f57e1e2b2ff8f730642b4",
      renderHash:
        "f5389c26522ed51c44e66db074e1aacdc86b600968fd05f83554a5e7caa021bb",
    });

    expect(noisyGable.segmentation?.roofType).toBe("gable");
    expect(noisyGable.calculation.trace.surfaces).toHaveLength(2);
    expect(noisyGable.summary.roofCoverageRatio).toBe(1);
    expect(
      noisyGable.calculation.trace.surfaces.map(
        (surface) => surface.pitchDegrees,
      ),
    ).toEqual([expect.closeTo(24.228, 3), expect.closeTo(24.228, 3)]);
    expect(noisyGable.summary).toMatchObject({
      calculationHash:
        "856777f09fe3459e384f08fff3b53ef33dda4dc8e429cce4468454b314e01c64",
      snapshotHash:
        "96c29732d6fa271a62e454894e23c53f6cb961d9789011ae63402856f218e9b3",
      renderHash:
        "0bf618ae8982dcf927332974b607d658dc4136ab03b2442477b4e3f63d4375d4",
    });
  });

  it("fails closed for sparse roofs and falls back for limited or complex inputs", () => {
    const limited = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: baseCandidate,
      surface: buildSurfaceFixture({
        roofHeightAt: () => 8,
        qualityStatus: "limited",
        domHash: "5".repeat(64),
        dtmHash: "4".repeat(64),
      }),
    });

    expect(limited.segmentation).toBeNull();
    expect(limited.geometryInput.surfaces).toHaveLength(1);
    expect(limited.summary.blockers).toEqual([
      "ROOF_PLANES_REQUIRED",
      "ROOF_PITCH_REQUIRED",
      "ROOF_SURFACE_RENDER_REQUIRED",
    ]);
    expect(limited.summary).toMatchObject({
      calculationHash:
        "27369ec6be1ddf49148c454b717e5d2dc24e8d905c9f9406ab5c4dd809c55c82",
      snapshotHash:
        "3086461d4997b19932825935551ede6bc665667038b5c40911020e5363c285b2",
      renderHash:
        "15e54c3e926c6bd44d59ac74781c3905ea801140d6de2029efc9b270f0abeac2",
    });

    const complex = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: complexRoofCandidate,
      surface: buildSurfaceFixture({
        candidate: complexRoofCandidate,
        roofHeightAt: () => 8,
        domHash: "3".repeat(64),
        dtmHash: "0".repeat(64),
      }),
    });
    expect(complex.segmentation).toBeNull();
    expect(complex.geometryInput.surfaces).toHaveLength(1);
    expect(complex.summary).toMatchObject({
      calculationHash:
        "bd09121ffc430bd0da598bc1a55979681dfc53bcdc8b99b5f80afeac9f982c37",
      snapshotHash:
        "d2be8932b93dab064428a099f58ce4ba031b6c82fc9477492a9795d6bf4f5dea",
      renderHash:
        "509959c1c17c7d5a72f4d1186f3de88ca9f245c75ec61d52974ebdb4c9e830d3",
    });

    const sparseSurface = buildSurfaceFixture({
      roofHeightAt: (_point, _center, row, column) =>
        (row + column) % 5 === 0 ? 8 : 0.4,
      domHash: "12".repeat(32),
      dtmHash: "34".repeat(32),
    });

    expect(() =>
      buildRoofFusionHeightSurfacePreviewV1({
        address,
        candidate: baseCandidate,
        surface: sparseSurface,
      }),
    ).toThrow("continuous elevated roof surface");
  });

  it("caps a dense 256x256 preview to deterministic safe sample count and pinned hashes", () => {
    const perfStart = performance.now();
    const gated256 = buildRoofFusionHeightSurfacePreviewV1({
      address,
      candidate: baseCandidate,
      surface: buildSurfaceFixture({
        roofHeightAt: (point, center) =>
          12 - Math.abs(point.x - center.x) * 0.45,
        cellSizeM: 0.25,
        squareGridSize: 256,
        domHash: "ab".repeat(32),
        dtmHash: "cd".repeat(32),
      }),
    });
    const perfElapsedMs = performance.now() - perfStart;

    expect(gated256.segmentation?.roofType).toBe("gable");
    expect(gated256.segmentation?.sampleCount).toBe(600);
    expect(gated256.segmentation?.footprintSampleCount).toBe(7190);
    expect(gated256.surface.grid.width).toBe(256);
    expect(gated256.surface.grid.height).toBe(256);
    expect(
      gated256.calculation.trace.surfaces.map(
        (surface) => surface.pitchDegrees,
      ),
    ).toEqual([expect.closeTo(24.228, 3), expect.closeTo(24.228, 3)]);
    expect(gated256.summary).toMatchObject({
      calculationHash:
        "449aa1ca41e207dcdea55c0487f5bdac41410e1ef2d47eb922f813f4a841e732",
      snapshotHash:
        "2bd16c7905f48a5015bd11fed1a8d93fa57c0355737c71a21b8341c9bd0b96f2",
      renderHash:
        "4a8a2426000986dc14d49e9c8b70b4d4222f64c37f1d38c984057e141da3662e",
    });
    // CI runners are not benchmarking rigs; this generous ceiling catches
    // accidental removal of the 600-sample cap without creating flaky gates.
    expect(round(perfElapsedMs)).toBeLessThan(5000);
  }, 10_000);
});
