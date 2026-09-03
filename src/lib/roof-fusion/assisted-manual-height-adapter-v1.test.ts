import { describe, expect, it } from "vitest";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import type { NorgeIBilderGeoReference } from "@/lib/providers/norge-i-bilder-capture-provider";
import {
  adaptAssistedManualRoofGeometryToSnapshotV1,
  ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION,
  type AssistedManualHeightAdapterInputV1,
} from "./assisted-manual-height-adapter-v1";
import {
  ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
  type AssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";

const hash = "a".repeat(64);

function makeHeightSurface(): KartverketHeightSurfaceV1 {
  const width = 45;
  const height = 40;
  const domElevationM: Array<number | null> = [];
  const dtmElevationM: Array<number | null> = [];
  const heightAboveTerrainM: Array<number | null> = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const xM = 100 + column + 0.5;
      const yM = 140 - row - 0.5;
      let roofHeightM = 0;
      if (xM >= 108 && xM <= 132 && yM >= 108 && yM <= 132) {
        roofHeightM = 5 + (xM - 120) * 0.08;
      }
      if (xM >= 132 && xM <= 144 && yM >= 108 && yM <= 122) {
        roofHeightM = 4.5 + (yM - 115) * 0.06;
      }
      if (xM >= 110 && xM <= 126 && yM >= 88 && yM <= 102) {
        roofHeightM = 6 + (xM - 118) * 0.07;
      }
      dtmElevationM.push(100);
      heightAboveTerrainM.push(roofHeightM > 0 ? roofHeightM : 0);
      domElevationM.push(100 + roofHeightM);
    }
  }
  return {
    schemaVersion: "kartverket-height-surface.v1",
    provider: "Kartverket Nasjonal detaljert høydemodell WCS",
    coordinateSystem: "EPSG:25833",
    bbox: {
      minEastingM: 100,
      minNorthingM: 100,
      maxEastingM: 145,
      maxNorthingM: 140,
    },
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
      maxHeightAboveTerrainM: 8,
      reasons: ["Fixture height grid"],
    },
    provenance: {
      retrievedAt: "2026-09-03T08:00:00.000Z",
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

function makeGeoReference(): NorgeIBilderGeoReference {
  return {
    crs: "EPSG:25833",
    extentTrust: "actual-visible-extent",
    bounds: {
      minEastingM: 100,
      minNorthingM: 100,
      maxEastingM: 145,
      maxNorthingM: 140,
    },
    imageWidth: 1600,
    imageHeight: 1200,
  };
}

function baseGeometry(): AssistedManualRoofGeometryV1 {
  return {
    schemaVersion: ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
    coordinateSystem: {
      kind: "projected_crs",
      reference: "EPSG:25833",
      axisOrder: "easting_northing",
    },
    vertices: [
      { vertexId: "a", xM: 108, yM: 108 },
      { vertexId: "b", xM: 132, yM: 108 },
      { vertexId: "c", xM: 132, yM: 132 },
      { vertexId: "d", xM: 108, yM: 132 },
      { vertexId: "ridge-s", xM: 120, yM: 110 },
      { vertexId: "ridge-n", xM: 120, yM: 130 },
      { vertexId: "o1", xM: 112, yM: 112 },
      { vertexId: "o2", xM: 116, yM: 112 },
      { vertexId: "o3", xM: 116, yM: 116 },
      { vertexId: "o4", xM: 112, yM: 116 },
    ],
    sourceFootprint: {
      footprintId: "fp-1",
      sourceId: "src-osm-fp",
      sourceContentHash: hash,
      points: [
        { xM: 108, yM: 108 },
        { xM: 132, yM: 108 },
        { xM: 132, yM: 132 },
        { xM: 108, yM: 132 },
      ],
    },
    roofMasses: [
      {
        massId: "main",
        outlineId: "outline-main",
        approvedByActorId: "admin-1",
        approvedAt: "2026-09-03T08:05:00.000Z",
        vertexIds: ["a", "b", "c", "d"],
      },
    ],
    skeletonEdges: [],
    openings: [],
    obstacles: [],
  };
}

function baseInput(): AssistedManualHeightAdapterInputV1 {
  return {
    schemaVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION,
    requestId: "req-1",
    caseId: "case-1",
    targetSnapshotId: "snap-1",
    idempotencyKey: "idempotency-1",
    requestedAt: "2026-09-03T08:10:00.000Z",
    generatedAt: "2026-09-03T08:10:01.000Z",
    geometry: baseGeometry(),
    heightSurface: makeHeightSurface(),
    orthophoto: {
      sourceId: "src-ortho",
      rawContentHash: "d".repeat(64),
      capturedAt: "2026-09-03T08:09:00.000Z",
      attribution: "©norgeibilder.no",
      provider: "norgeibilder.no",
      geoReference: makeGeoReference(),
    },
    actor: {
      actorId: "admin-1",
      actorType: "administrator",
      displayName: "Admin",
    },
  };
}

describe("assisted manual height adapter v1", () => {
  it("adapts one approved roof mass into a calculable preliminary snapshot", () => {
    const result = adaptAssistedManualRoofGeometryToSnapshotV1(baseInput());

    expect(result.summary.blockers).toEqual([]);
    expect(result.geometryInput).not.toBeNull();
    expect(result.sourceResult.status).toBe("complete");
    expect(result.snapshot.state).toBe("review_required");
    expect(result.snapshot.measurement.class).toBe("preliminary");
    expect(result.snapshot.geometry.surfaces).toHaveLength(1);
    expect(
      result.snapshot.geometry.surfaces[0].grossSurfaceArea.min,
    ).toBeGreaterThan(
      result.snapshot.geometry.surfaces[0].grossHorizontalArea.min ?? 0,
    );
    expect(result.summary.pricingReady).toBe(false);
  });

  it("fits a preliminary plane at real EPSG:25833 coordinate magnitudes", () => {
    const input = baseInput();
    const eastingOffset = 500_000;
    const northingOffset = 6_640_000;
    input.geometry.vertices = input.geometry.vertices.map((vertex) => ({
      ...vertex,
      xM: vertex.xM + eastingOffset,
      yM: vertex.yM + northingOffset,
    }));
    input.geometry.sourceFootprint.points =
      input.geometry.sourceFootprint.points.map((point) => ({
        xM: point.xM + eastingOffset,
        yM: point.yM + northingOffset,
      }));
    input.heightSurface.bbox = {
      minEastingM: 100 + eastingOffset,
      minNorthingM: 100 + northingOffset,
      maxEastingM: 145 + eastingOffset,
      maxNorthingM: 140 + northingOffset,
    };
    input.orthophoto.geoReference.bounds = {
      minEastingM: 100 + eastingOffset,
      minNorthingM: 100 + northingOffset,
      maxEastingM: 145 + eastingOffset,
      maxNorthingM: 140 + northingOffset,
    };

    const result = adaptAssistedManualRoofGeometryToSnapshotV1(input);

    expect(result.summary.blockers).toEqual([]);
    expect(result.geometryInput).not.toBeNull();
    expect(result.summary.status).toBe("review_required");
  });

  it("supports L-shaped and multiple roof masses as separate calculable surfaces", () => {
    const input = baseInput();
    input.geometry.vertices.push(
      { vertexId: "e", xM: 144, yM: 108 },
      { vertexId: "f", xM: 144, yM: 122 },
      { vertexId: "g", xM: 132, yM: 122 },
      { vertexId: "h", xM: 110, yM: 100 },
      { vertexId: "i", xM: 126, yM: 100 },
      { vertexId: "j", xM: 126, yM: 102 },
      { vertexId: "k", xM: 110, yM: 102 },
    );
    input.geometry.roofMasses.push(
      {
        massId: "annex-east",
        outlineId: "outline-east",
        approvedByActorId: "admin-1",
        approvedAt: "2026-09-03T08:06:00.000Z",
        vertexIds: ["b", "e", "f", "g"],
      },
      {
        massId: "annex-north",
        outlineId: "outline-north",
        approvedByActorId: "admin-1",
        approvedAt: "2026-09-03T08:07:00.000Z",
        vertexIds: ["h", "i", "j", "k"],
      },
    );

    const result = adaptAssistedManualRoofGeometryToSnapshotV1(input);

    expect(result.sourceResult.status).toBe("complete");
    expect(
      result.snapshot.geometry.surfaces.map((surface) => surface.surfaceId),
    ).toEqual(["surface-annex-east", "surface-annex-north", "surface-main"]);
  });

  it("subtracts openings from the fitted roof surface area", () => {
    const input = baseInput();
    input.geometry.openings.push({
      openingId: "skylight-1",
      roofMassId: "main",
      kind: "skylight",
      vertexIds: ["o1", "o2", "o3", "o4"],
    });

    const result = adaptAssistedManualRoofGeometryToSnapshotV1(input);
    const [surface] = result.snapshot.geometry.surfaces;

    expect(result.snapshot.geometry.openings).toHaveLength(1);
    expect(surface.netSurfaceArea.min ?? 0).toBeLessThan(
      surface.grossSurfaceArea.min ?? 0,
    );
  });

  it("fails closed with a stable topology reason for an incomplete skeleton", () => {
    const input = baseInput();
    input.geometry.skeletonEdges.push(
      {
        edgeId: "ridge-main",
        roofMassId: "main",
        fromVertexId: "ridge-s",
        toVertexId: "ridge-n",
        type: "ridge",
        provenance: "manual",
      },
      {
        edgeId: "valley-main",
        roofMassId: "main",
        fromVertexId: "o1",
        toVertexId: "o3",
        type: "valley",
        provenance: "automatic",
      },
    );

    const result = adaptAssistedManualRoofGeometryToSnapshotV1(input);

    expect(result.sourceResult.status).toBe("failed");
    expect(result.snapshot.state).toBe("blocked");
    expect(result.summary.blockers.join(" ")).toMatch(
      /\[(SKELETON_DANGLING_ENDPOINT|SKELETON_EDGE_CROSSES_EDGE|SKELETON_DOES_NOT_SUBDIVIDE)\]/,
    );
  });

  it("uses a boundary-to-boundary ridge to fit two reviewable surfaces", () => {
    const input = baseInput();
    input.geometry.vertices.push(
      { vertexId: "ridge-west", xM: 108, yM: 120 },
      { vertexId: "ridge-east", xM: 132, yM: 120 },
    );
    input.geometry.skeletonEdges.push({
      edgeId: "ridge-main",
      roofMassId: "main",
      fromVertexId: "ridge-west",
      toVertexId: "ridge-east",
      type: "ridge",
      provenance: "manual",
    });

    const result = adaptAssistedManualRoofGeometryToSnapshotV1(input);

    expect(result.sourceResult.status).toBe("partial");
    expect(result.snapshot.state).toBe("review_required");
    expect(result.geometryInput?.surfaces).toHaveLength(2);
    expect(result.sourceResult.issues.map((issue) => issue.code)).toContain(
      "ASSISTED_SKELETON_REVIEW_REQUIRED",
    );
    expect(result.summary.blockers[0]).toContain("ridge");
    expect(
      result.geometryInput?.provenance.observations.some(
        (observation) =>
          (observation.value as { edgeId?: string }).edgeId === "ridge-main" &&
          (observation.value as { surfaceIds?: string[] }).surfaceIds
            ?.length === 2,
      ),
    ).toBe(true);
  });

  it("fails closed when the orthophoto georegistration is not trustworthy", () => {
    const input = baseInput();
    input.orthophoto.geoReference = {
      ...input.orthophoto.geoReference,
      extentTrust: "actual-visible-extent",
      bounds: {
        minEastingM: 108,
        minNorthingM: 108,
        maxEastingM: 120,
        maxNorthingM: 120,
      },
    };

    const result = adaptAssistedManualRoofGeometryToSnapshotV1(input);

    expect(result.geometryInput).toBeNull();
    expect(result.sourceResult.status).toBe("failed");
    expect(result.snapshot.state).toBe("blocked");
    expect(result.summary.status).toBe("blocked");
    expect(result.summary.blockers[0]).toContain("orthophoto");
  });
});
