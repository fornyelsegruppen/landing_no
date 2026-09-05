import { describe, expect, it } from "vitest";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import {
  ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
  type AssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";
import { subdivideAssistedManualRoofSurfacesV1 } from "./assisted-manual-surface-subdivision-v1";
import lyngveienR11HeightSurfaceFixture from "./__fixtures__/lyngveien-r11-height-surface-v1.json";

type Vertex = { vertexId: string; xM: number; yM: number };

function heightSurface(
  zAt: (x: number, y: number) => number,
): KartverketHeightSurfaceV1 {
  const width = 48;
  const height = 48;
  const domElevationM: number[] = [];
  const dtmElevationM: number[] = [];
  const heightAboveTerrainM: number[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const x = -2 + (column + 0.5) * 0.5;
      const y = 20 - (row + 0.5) * 0.5;
      const z = zAt(x, y);
      domElevationM.push(z);
      dtmElevationM.push(0);
      heightAboveTerrainM.push(z);
    }
  }
  return {
    schemaVersion: "kartverket-height-surface.v1",
    provider: "Kartverket Nasjonal detaljert høydemodell WCS",
    coordinateSystem: "EPSG:25833",
    bbox: {
      minEastingM: -2,
      minNorthingM: -4,
      maxEastingM: 22,
      maxNorthingM: 20,
    },
    grid: {
      width,
      height,
      cellWidthM: 0.5,
      cellHeightM: 0.5,
      rowOrder: "north_to_south",
    },
    values: { domElevationM, dtmElevationM, heightAboveTerrainM },
    quality: {
      status: "usable",
      coverageRatio: 1,
      validSamples: width * height,
      totalSamples: width * height,
      maxHeightAboveTerrainM: 20,
      reasons: ["test"],
    },
    provenance: {
      retrievedAt: "2026-09-03T00:00:00.000Z",
      domCoverageId: "nhm_dom_topo_25833",
      dtmCoverageId: "nhm_dtm_topo_25833",
      domContentSha256: "a".repeat(64),
      dtmContentSha256: "b".repeat(64),
      resolutionM: 0.5,
      license: "Norsk lisens for offentlige data (NLOD) 2.0",
      attribution: "Kartverket",
    },
  };
}

function geometry(
  vertices: Vertex[],
  masses: Array<{ massId: string; vertexIds: string[] }>,
  skeletonEdges: AssistedManualRoofGeometryV1["skeletonEdges"] = [],
  openings: AssistedManualRoofGeometryV1["openings"] = [],
): AssistedManualRoofGeometryV1 {
  return {
    schemaVersion: ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
    coordinateSystem: {
      kind: "projected_crs",
      reference: "EPSG:25833",
      axisOrder: "easting_northing",
    },
    vertices,
    sourceFootprint: {
      footprintId: "footprint",
      sourceId: "source-footprint",
      sourceContentHash: "c".repeat(64),
      points: masses[0].vertexIds.map((id) => {
        const vertex = vertices.find((item) => item.vertexId === id)!;
        return { xM: vertex.xM, yM: vertex.yM };
      }),
    },
    roofMasses: masses.map((mass) => ({
      ...mass,
      outlineId: `outline-${mass.massId}`,
      approvedByActorId: "admin",
      approvedAt: "2026-09-03T00:00:00.000Z",
    })),
    skeletonEdges,
    openings,
    obstacles: [],
  };
}

const rectangle: Vertex[] = [
  { vertexId: "sw", xM: 0, yM: 0 },
  { vertexId: "se", xM: 10, yM: 0 },
  { vertexId: "ne", xM: 10, yM: 8 },
  { vertexId: "nw", xM: 0, yM: 8 },
];

function lyngveienR11Geometry() {
  return geometry(
    [
      {
        vertexId: "outline-v1",
        xM: 265_000.228931666,
        yM: 6_647_341.539549207,
      },
      {
        vertexId: "outline-v2",
        xM: 264_998.19608876936,
        yM: 6_647_343.098084413,
      },
      {
        vertexId: "outline-v3",
        xM: 264_991.61536772177,
        yM: 6_647_334.538394307,
      },
      {
        vertexId: "outline-v4",
        xM: 264_995.0981552443,
        yM: 6_647_331.871532905,
      },
      {
        vertexId: "outline-v5",
        xM: 264_997.0425831289,
        yM: 6_647_334.39443424,
      },
      {
        vertexId: "outline-v6",
        xM: 265_000.1833120874,
        yM: 6_647_331.994985003,
      },
      {
        vertexId: "outline-v7",
        xM: 265_005.8285141126,
        yM: 6_647_339.341153542,
      },
      {
        vertexId: "outline-v8",
        xM: 265_001.23855610105,
        yM: 6_647_342.860039433,
      },
      {
        vertexId: "ridge-from",
        xM: 264_996.3779425371,
        yM: 6_647_340.733181206,
      },
      { vertexId: "ridge-to", xM: 265_003.2220317294, yM: 6_647_335.949307015 },
    ],
    [
      {
        massId: "lyngveien",
        vertexIds: [
          "outline-v1",
          "outline-v2",
          "outline-v3",
          "outline-v4",
          "outline-v5",
          "outline-v6",
          "outline-v7",
          "outline-v8",
        ],
      },
    ],
    [
      {
        edgeId: "r11-ridge",
        roofMassId: "lyngveien",
        fromVertexId: "ridge-from",
        toVertexId: "ridge-to",
        type: "ridge",
        provenance: "manual",
      },
    ],
  );
}

describe("assisted manual surface subdivision v1", () => {
  it("creates two deterministic gable surfaces with one explicit shared ridge", () => {
    const input = geometry(
      [
        ...rectangle,
        { vertexId: "ridge-s", xM: 5, yM: 0 },
        { vertexId: "ridge-n", xM: 5, yM: 8 },
      ],
      [{ massId: "main", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "ridge",
          roofMassId: "main",
          fromVertexId: "ridge-s",
          toVertexId: "ridge-n",
          type: "ridge",
          provenance: "manual",
        },
        {
          edgeId: "eave-south",
          roofMassId: "main",
          fromVertexId: "sw",
          toVertexId: "se",
          type: "eave",
          provenance: "manual",
        },
      ],
    );
    const surface = heightSurface((x) => 10 - Math.abs(x - 5) * 0.4);
    const first = subdivideAssistedManualRoofSurfacesV1(input, surface);
    const reordered = structuredClone(input);
    reordered.vertices.reverse();
    reordered.skeletonEdges.reverse();
    reordered.roofMasses[0].vertexIds = ["ne", "nw", "sw", "se"];
    reordered.sourceFootprint.points.reverse();
    const second = subdivideAssistedManualRoofSurfacesV1(
      reordered,
      structuredClone(surface),
    );

    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    expect(first.surfaces).toHaveLength(2);
    expect(
      first.surfaces.reduce((sum, item) => sum + item.horizontalAreaM2, 0),
    ).toBe(80);
    expect(
      first.edges.find((edge) => edge.sourceSkeletonEdgeIds.includes("ridge"))
        ?.surfaceIds,
    ).toHaveLength(2);
    const ridgeElevations = first.surfaces.map(
      (item) =>
        item.vertices.find((vertex) => vertex.vertexId === "ridge-s")!.zM,
    );
    expect(new Set(ridgeElevations).size).toBe(1);
    expect(
      first.edges.filter((edge) =>
        edge.sourceSkeletonEdgeIds.includes("eave-south"),
      ),
    ).toHaveLength(2);
    expect(
      first.surfaces
        .flatMap((item) => item.edgeIds)
        .every((edgeId) => first.edges.some((edge) => edge.edgeId === edgeId)),
    ).toBe(true);
  });

  it("treats epsilon-close snapped ridge endpoints as boundary touches", () => {
    const input = geometry(
      [
        ...rectangle,
        { vertexId: "ridge-s", xM: 5, yM: -5e-10 },
        { vertexId: "ridge-n", xM: 5, yM: 8 + 5e-10 },
      ],
      [{ massId: "main", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "ridge",
          roofMassId: "main",
          fromVertexId: "ridge-s",
          toVertexId: "ridge-n",
          type: "ridge",
          provenance: "manual",
        },
      ],
    );

    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface((x) => 10 - Math.abs(x - 5) * 0.4),
    );

    expect(result.status).toBe("ready");
    expect(result.surfaces).toHaveLength(2);
    expect(result.issues).toEqual([]);
  });

  it("subdivides the valid snapped Lyngveien r9 chord after EPSG projection", () => {
    const originX = 264_990;
    const originY = 6_647_330;
    const projectedVertices = [
      ["outline-v1", 265_000.228931666, 6_647_341.539549207],
      ["outline-v2", 264_998.19608876936, 6_647_343.098084413],
      ["outline-v3", 264_991.61536772177, 6_647_334.538394307],
      ["outline-v4", 264_995.0981552443, 6_647_331.871532905],
      ["outline-v5", 264_997.0425831289, 6_647_334.39443424],
      ["outline-v6", 265_000.1833120874, 6_647_331.994985003],
      ["outline-v7", 265_005.8285141126, 6_647_339.341153542],
      ["outline-v8", 265_001.23855610105, 6_647_342.860039433],
      ["ridge-from", 264_996.3779425371, 6_647_340.733181206],
      ["ridge-to", 265_003.2220317294, 6_647_335.949307015],
    ] as const;
    const input = geometry(
      projectedVertices.map(([vertexId, xM, yM]) => ({
        vertexId,
        xM: xM - originX,
        yM: yM - originY,
      })),
      [
        {
          massId: "lyngveien",
          vertexIds: [
            "outline-v1",
            "outline-v2",
            "outline-v3",
            "outline-v4",
            "outline-v5",
            "outline-v6",
            "outline-v7",
            "outline-v8",
          ],
        },
      ],
      [
        {
          edgeId: "r9-ridge",
          roofMassId: "lyngveien",
          fromVertexId: "ridge-from",
          toVertexId: "ridge-to",
          type: "ridge",
          provenance: "manual",
        },
      ],
    );

    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface((x, y) => 10 + x * 0.01 + y * 0.02),
    );

    expect(result.status).toBe("ready");
    expect(result.surfaces).toHaveLength(2);
    expect(result.issues).toEqual([]);
  });

  it("globally constrains the exact Lyngveien r11 height planes along their shared ridge", () => {
    const input = lyngveienR11Geometry();
    const height = structuredClone(
      lyngveienR11HeightSurfaceFixture,
    ) as KartverketHeightSurfaceV1;

    expect(height.grid).toMatchObject({ width: 31, height: 29 });
    expect(height.provenance.domContentSha256).toBe(
      "664aa8a6f029bd0f3b8ca3b2caa8fe5692b202014e734625440285a171f2128f",
    );
    expect(height.provenance.dtmContentSha256).toBe(
      "0ac08fb0765b78c82198970560893816152e7568eecc257448218130d2defac8",
    );

    const first = subdivideAssistedManualRoofSurfacesV1(input, height);
    const reordered = structuredClone(input);
    reordered.vertices.reverse();
    const second = subdivideAssistedManualRoofSurfacesV1(
      reordered,
      structuredClone(height),
    );

    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    expect(first.issues).toEqual([]);
    expect(first.surfaces).toHaveLength(2);
    expect(
      first.surfaces
        .map((surface) => surface.plane.sampleCount)
        .sort((a, b) => a - b),
    ).toEqual([33, 55]);
    expect(
      first.surfaces
        .map((surface) => surface.plane.rmseM)
        .sort((a, b) => a - b),
    ).toEqual([0.483295, 0.950852]);
    const ridge = first.edges.find((edge) =>
      edge.sourceSkeletonEdgeIds.includes("r11-ridge"),
    )!;
    const ridgeSurfaces = ridge.surfaceIds.map((surfaceId) =>
      first.surfaces.find((surface) => surface.surfaceId === surfaceId)!,
    );
    for (const vertexId of ["ridge-from", "ridge-to"]) {
      const sharedElevations = first.surfaces.map(
        (surface) =>
          surface.vertices.find((vertex) => vertex.vertexId === vertexId)!.zM,
      );
      expect(new Set(sharedElevations).size).toBe(1);
      const point = input.vertices.find(
        (vertex) => vertex.vertexId === vertexId,
      )!;
      const fittedElevations = ridgeSurfaces.map(
        (surface) =>
          surface.plane.a * point.xM +
          surface.plane.b * point.yM +
          surface.plane.c,
      );
      expect(Math.abs(fittedElevations[0] - fittedElevations[1])).toBeLessThan(
        0.01,
      );
    }
  });

  it("blocks a constrained plane network when each face exceeds the RMSE limit", () => {
    const input = geometry(
      [
        ...rectangle,
        { vertexId: "ridge-s", xM: 5, yM: 0 },
        { vertexId: "ridge-n", xM: 5, yM: 8 },
      ],
      [{ massId: "main", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "ridge",
          roofMassId: "main",
          fromVertexId: "ridge-s",
          toVertexId: "ridge-n",
          type: "ridge",
          provenance: "manual",
        },
      ],
    );
    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface((x) => (x < 5 ? 10 : 20)),
    );

    expect(result.status).toBe("blocked");
    expect(result.surfaces).toEqual([]);
    expect(result.issues).toHaveLength(2);
    expect(
      result.issues.every((item) => item.code === "UNSTABLE_HEIGHT_PLANE"),
    ).toBe(true);
    expect(
      result.issues.every((item) =>
        item.message.includes("globally constrained"),
      ),
    ).toBe(true);
  });

  it("still rejects a boundary-to-boundary chord that leaves a concave mass", () => {
    const input = geometry(
      [
        { vertexId: "a", xM: 0, yM: 0 },
        { vertexId: "b", xM: 10, yM: 0 },
        { vertexId: "c", xM: 10, yM: 4 },
        { vertexId: "d", xM: 6, yM: 4 },
        { vertexId: "e", xM: 6, yM: 8 },
        { vertexId: "f", xM: 0, yM: 8 },
        { vertexId: "right", xM: 10, yM: 2 },
        { vertexId: "top", xM: 3, yM: 8 },
      ],
      [{ massId: "concave", vertexIds: ["a", "b", "c", "d", "e", "f"] }],
      [
        {
          edgeId: "invalid-ridge",
          roofMassId: "concave",
          fromVertexId: "right",
          toVertexId: "top",
          type: "ridge",
          provenance: "manual",
        },
      ],
    );

    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface(() => 10),
    );

    expect(result.status).toBe("blocked");
    expect(result.issues.map((item) => item.code)).toContain(
      "SKELETON_EDGE_OUTSIDE_MASS",
    );
    expect(result.surfaces).toEqual([]);
  });

  it("creates four hip surfaces around an explicit ridge-and-hip graph", () => {
    const input = geometry(
      [
        ...rectangle,
        { vertexId: "ridge-w", xM: 3, yM: 4 },
        { vertexId: "ridge-e", xM: 7, yM: 4 },
      ],
      [{ massId: "hip", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "ridge",
          roofMassId: "hip",
          fromVertexId: "ridge-w",
          toVertexId: "ridge-e",
          type: "ridge",
          provenance: "manual",
        },
        {
          edgeId: "hip-sw",
          roofMassId: "hip",
          fromVertexId: "sw",
          toVertexId: "ridge-w",
          type: "hip",
          provenance: "manual",
        },
        {
          edgeId: "hip-nw",
          roofMassId: "hip",
          fromVertexId: "nw",
          toVertexId: "ridge-w",
          type: "hip",
          provenance: "manual",
        },
        {
          edgeId: "hip-se",
          roofMassId: "hip",
          fromVertexId: "se",
          toVertexId: "ridge-e",
          type: "hip",
          provenance: "manual",
        },
        {
          edgeId: "hip-ne",
          roofMassId: "hip",
          fromVertexId: "ne",
          toVertexId: "ridge-e",
          type: "hip",
          provenance: "manual",
        },
      ],
    );
    const surface = heightSurface((x, y) => {
      if (y >= 4 && y - 4 >= (4 / 3) * Math.max(0, 3 - x, x - 7))
        return 10 - (y - 4) * 0.5;
      if (y <= 4 && 4 - y >= (4 / 3) * Math.max(0, 3 - x, x - 7))
        return 10 - (4 - y) * 0.5;
      if (x < 3) return 10 - ((3 - x) * 2) / 3;
      return 10 - ((x - 7) * 2) / 3;
    });
    const result = subdivideAssistedManualRoofSurfacesV1(input, surface);
    const reordered = structuredClone(input);
    reordered.vertices.reverse();
    reordered.skeletonEdges.reverse();
    const repeated = subdivideAssistedManualRoofSurfacesV1(
      reordered,
      structuredClone(surface),
    );

    expect(result).toEqual(repeated);
    expect(result.status).toBe("ready");
    expect(result.surfaces).toHaveLength(4);
    expect(result.edges.filter((edge) => edge.kind !== "eave")).toHaveLength(5);
    expect(
      result.surfaces.reduce((sum, item) => sum + item.horizontalAreaM2, 0),
    ).toBe(80);
    expect(
      result.surfaces.reduce(
        (sum, item) =>
          sum +
          item.horizontalAreaM2 * Math.hypot(1, item.plane.a, item.plane.b),
        0,
      ),
    ).toBeCloseTo(56 * Math.sqrt(1.25) + 24 * Math.sqrt(13 / 9), 5);
  });

  it("subdivides an L roof along an explicit valley without filling the concavity", () => {
    const vertices: Vertex[] = [
      { vertexId: "a", xM: 0, yM: 0 },
      { vertexId: "b", xM: 10, yM: 0 },
      { vertexId: "c", xM: 10, yM: 4 },
      { vertexId: "d", xM: 6, yM: 4 },
      { vertexId: "e", xM: 6, yM: 8 },
      { vertexId: "f", xM: 0, yM: 8 },
    ];
    const input = geometry(
      vertices,
      [{ massId: "l", vertexIds: ["a", "b", "c", "d", "e", "f"] }],
      [
        {
          edgeId: "valley",
          roofMassId: "l",
          fromVertexId: "a",
          toVertexId: "d",
          type: "valley",
          provenance: "manual",
        },
      ],
    );
    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface(
        (x, y) =>
          10 + 0.1 * x + (y > (2 * x) / 3 ? 0.15 * (y - (2 * x) / 3) : 0),
      ),
    );

    expect(result.status).toBe("ready");
    expect(result.surfaces).toHaveLength(2);
    expect(
      result.surfaces.reduce((sum, item) => sum + item.horizontalAreaM2, 0),
    ).toBe(64);
    expect(
      result.edges.find((edge) => edge.kind === "valley")?.surfaceIds,
    ).toHaveLength(2);
  });

  it("keeps connected and detached approved masses explicit without overlap", () => {
    const vertices: Vertex[] = [
      ...rectangle,
      { vertexId: "east-se", xM: 14, yM: 0 },
      { vertexId: "east-ne", xM: 14, yM: 8 },
      { vertexId: "d1", xM: 16, yM: 0 },
      { vertexId: "d2", xM: 20, yM: 0 },
      { vertexId: "d3", xM: 20, yM: 4 },
      { vertexId: "d4", xM: 16, yM: 4 },
    ];
    const input = geometry(vertices, [
      { massId: "main", vertexIds: ["sw", "se", "ne", "nw"] },
      { massId: "connected", vertexIds: ["se", "east-se", "east-ne", "ne"] },
      { massId: "detached", vertexIds: ["d1", "d2", "d3", "d4"] },
    ]);
    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface((x) => 8 + x * 0.02),
    );

    expect(result.status).toBe("ready");
    expect(result.surfaces.map((item) => item.roofMassId)).toEqual([
      "connected",
      "detached",
      "main",
    ]);
    expect(
      result.edges.find(
        (edge) =>
          edge.surfaceIds.includes("surface-main-1") &&
          edge.surfaceIds.includes("surface-connected-1"),
      ),
    ).toBeDefined();
  });

  it("assigns an opening only when it is strictly contained in one surface", () => {
    const openingVertices: Vertex[] = [
      { vertexId: "o1", xM: 1, yM: 2 },
      { vertexId: "o2", xM: 2, yM: 2 },
      { vertexId: "o3", xM: 2, yM: 3 },
      { vertexId: "o4", xM: 1, yM: 3 },
    ];
    const input = geometry(
      [
        ...rectangle,
        ...openingVertices,
        { vertexId: "ridge-s", xM: 5, yM: 0 },
        { vertexId: "ridge-n", xM: 5, yM: 8 },
      ],
      [{ massId: "main", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "ridge",
          roofMassId: "main",
          fromVertexId: "ridge-s",
          toVertexId: "ridge-n",
          type: "ridge",
          provenance: "manual",
        },
      ],
      [
        {
          openingId: "sky",
          roofMassId: "main",
          kind: "skylight",
          vertexIds: ["o1", "o2", "o3", "o4"],
        },
      ],
    );
    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface((x) => 10 - Math.abs(x - 5) * 0.4),
    );

    expect(result.status).toBe("ready");
    expect(
      result.surfaces.filter((item) => item.openingIds.includes("sky")),
    ).toHaveLength(1);
  });

  it("requests review instead of guessing when a multi-plane mass has no skeleton", () => {
    const input = geometry(rectangle, [
      { massId: "main", vertexIds: ["sw", "se", "ne", "nw"] },
    ]);
    const result = subdivideAssistedManualRoofSurfacesV1(
      input,
      heightSurface((x) => 10 - Math.abs(x - 5) * 1.2),
    );

    expect(result.status).toBe("review_required");
    expect(result.surfaces).toEqual([]);
    expect(result.issues.map((item) => item.code)).toContain(
      "MISSING_OR_AMBIGUOUS_SKELETON",
    );
  });

  it("blocks dangling skeletons, overlapping masses, and openings crossing a shared edge", () => {
    const dangling = geometry(
      [...rectangle, { vertexId: "inside", xM: 5, yM: 4 }],
      [{ massId: "main", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "bad-ridge",
          roofMassId: "main",
          fromVertexId: "sw",
          toVertexId: "inside",
          type: "ridge",
          provenance: "manual",
        },
      ],
    );
    expect(
      subdivideAssistedManualRoofSurfacesV1(
        dangling,
        heightSurface(() => 10),
      ).issues.map((item) => item.code),
    ).toContain("SKELETON_DANGLING_ENDPOINT");

    const overlapVertices = [
      ...rectangle,
      { vertexId: "x1", xM: 5, yM: 2 },
      { vertexId: "x2", xM: 12, yM: 2 },
      { vertexId: "x3", xM: 12, yM: 6 },
      { vertexId: "x4", xM: 5, yM: 6 },
    ];
    const overlap = geometry(overlapVertices, [
      { massId: "main", vertexIds: ["sw", "se", "ne", "nw"] },
      { massId: "overlap", vertexIds: ["x1", "x2", "x3", "x4"] },
    ]);
    expect(
      subdivideAssistedManualRoofSurfacesV1(
        overlap,
        heightSurface(() => 10),
      ).issues.map((item) => item.code),
    ).toContain("ROOF_MASSES_OVERLAP");

    const crossingOpeningVertices: Vertex[] = [
      { vertexId: "o1", xM: 4, yM: 2 },
      { vertexId: "o2", xM: 6, yM: 2 },
      { vertexId: "o3", xM: 6, yM: 3 },
      { vertexId: "o4", xM: 4, yM: 3 },
      { vertexId: "ridge-s", xM: 5, yM: 0 },
      { vertexId: "ridge-n", xM: 5, yM: 8 },
    ];
    const crossingOpening = geometry(
      [...rectangle, ...crossingOpeningVertices],
      [{ massId: "main", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "ridge",
          roofMassId: "main",
          fromVertexId: "ridge-s",
          toVertexId: "ridge-n",
          type: "ridge",
          provenance: "manual",
        },
      ],
      [
        {
          openingId: "crossing",
          roofMassId: "main",
          kind: "skylight",
          vertexIds: ["o1", "o2", "o3", "o4"],
        },
      ],
    );
    const crossingResult = subdivideAssistedManualRoofSurfacesV1(
      crossingOpening,
      heightSurface((x) => 10 - Math.abs(x - 5) * 0.4),
    );
    expect(crossingResult.status).toBe("blocked");
    expect(crossingResult.issues.map((item) => item.code)).toContain(
      "OPENING_NOT_CONTAINED_IN_ONE_SURFACE",
    );
  });

  it("returns explainable blockers for crossing skeleton edges and self-intersecting rings", () => {
    const crossing = geometry(
      [
        ...rectangle,
        { vertexId: "south-mid", xM: 5, yM: 0 },
        { vertexId: "north-mid", xM: 5, yM: 8 },
        { vertexId: "west-mid", xM: 0, yM: 4 },
        { vertexId: "east-mid", xM: 10, yM: 4 },
      ],
      [{ massId: "main", vertexIds: ["sw", "se", "ne", "nw"] }],
      [
        {
          edgeId: "ridge",
          roofMassId: "main",
          fromVertexId: "south-mid",
          toVertexId: "north-mid",
          type: "ridge",
          provenance: "manual",
        },
        {
          edgeId: "valley",
          roofMassId: "main",
          fromVertexId: "west-mid",
          toVertexId: "east-mid",
          type: "valley",
          provenance: "manual",
        },
      ],
    );
    const crossingResult = subdivideAssistedManualRoofSurfacesV1(
      crossing,
      heightSurface(() => 10),
    );
    expect(crossingResult.status).toBe("blocked");
    expect(crossingResult.issues.map((item) => item.code)).toContain(
      "SKELETON_EDGE_CROSSES_EDGE",
    );

    const bowTie = geometry(rectangle, [
      { massId: "main", vertexIds: ["sw", "ne", "se", "nw"] },
    ]);
    const bowTieResult = subdivideAssistedManualRoofSurfacesV1(
      bowTie,
      heightSurface(() => 10),
    );
    expect(bowTieResult.status).toBe("blocked");
    expect(bowTieResult.issues.map((item) => item.code)).toContain(
      "GEOMETRY_INVALID",
    );
  });
});
