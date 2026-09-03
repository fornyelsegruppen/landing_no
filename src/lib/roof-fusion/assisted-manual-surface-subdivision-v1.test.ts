import { describe, expect, it } from "vitest";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import {
  ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
  type AssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";
import { subdivideAssistedManualRoofSurfacesV1 } from "./assisted-manual-surface-subdivision-v1";

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

    expect(result.status).toBe("ready");
    expect(result.surfaces).toHaveLength(4);
    expect(result.edges.filter((edge) => edge.kind !== "eave")).toHaveLength(5);
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
