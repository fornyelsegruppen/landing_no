import { describe, expect, it } from "vitest";
import {
  ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
  AssistedManualRoofGeometryValidationError,
  assertAssistedManualRoofGeometryV1,
  prepareAssistedManualRoofGeometryForCalculationV1,
  validateAssistedManualRoofGeometryV1,
  type AssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";

const hash = "a".repeat(64);

function simpleGable(): AssistedManualRoofGeometryV1 {
  return {
    schemaVersion: ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
    coordinateSystem: {
      kind: "projected_crs",
      reference: "EPSG:25833",
      axisOrder: "easting_northing",
    },
    vertices: [
      { vertexId: "v-sw", xM: 500000, yM: 6640000 },
      { vertexId: "v-se", xM: 500010, yM: 6640000 },
      { vertexId: "v-ne", xM: 500010, yM: 6640008 },
      { vertexId: "v-nw", xM: 500000, yM: 6640008 },
      { vertexId: "v-ridge-s", xM: 500005, yM: 6640001 },
      { vertexId: "v-ridge-n", xM: 500005, yM: 6640007 },
      { vertexId: "v-window-sw", xM: 500001, yM: 6640002 },
      { vertexId: "v-window-se", xM: 500002, yM: 6640002 },
      { vertexId: "v-window-ne", xM: 500002, yM: 6640003 },
      { vertexId: "v-window-nw", xM: 500001, yM: 6640003 },
    ],
    sourceFootprint: {
      footprintId: "osm-way-12",
      sourceId: "src-osm",
      sourceContentHash: hash,
      points: [
        { xM: 500000, yM: 6640000 },
        { xM: 500010, yM: 6640000 },
        { xM: 500010, yM: 6640008 },
        { xM: 500000, yM: 6640008 },
      ],
    },
    roofMasses: [
      {
        massId: "mass-main",
        outlineId: "outline-main",
        approvedByActorId: "admin-1",
        approvedAt: "2026-09-03T08:00:00.000Z",
        vertexIds: ["v-sw", "v-se", "v-ne", "v-nw"],
      },
    ],
    skeletonEdges: [
      {
        edgeId: "ridge-main",
        roofMassId: "mass-main",
        fromVertexId: "v-ridge-s",
        toVertexId: "v-ridge-n",
        type: "ridge",
        provenance: "manual",
      },
      {
        edgeId: "eave-south",
        roofMassId: "mass-main",
        fromVertexId: "v-sw",
        toVertexId: "v-se",
        type: "eave",
        provenance: "automatic",
      },
    ],
    openings: [
      {
        openingId: "skylight-1",
        roofMassId: "mass-main",
        kind: "skylight",
        vertexIds: ["v-window-sw", "v-window-se", "v-window-ne", "v-window-nw"],
      },
    ],
    obstacles: [],
  };
}

describe("assisted manual roof geometry v1", () => {
  it("captures a simple gable as an immutable source footprint plus approved eaves and typed skeleton", () => {
    const geometry = assertAssistedManualRoofGeometryV1(simpleGable());
    const ready = prepareAssistedManualRoofGeometryForCalculationV1(geometry);

    expect(ready.geometryHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(ready.geometry.coordinateSystem.reference).toBe("EPSG:25833");
    expect(ready.geometry.sourceFootprint).toMatchObject({
      footprintId: "osm-way-12",
      sourceContentHash: hash,
    });
    expect(ready.geometry.roofMasses).toHaveLength(1);
    expect(ready.geometry.skeletonEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "ridge", provenance: "manual" }),
        expect.objectContaining({ type: "eave", provenance: "automatic" }),
      ]),
    );
  });

  it("supports L-shaped buildings as separate roof masses with their own structures and features", () => {
    const geometry = simpleGable();
    geometry.vertices.push(
      { vertexId: "v-annex-se", xM: 500016, yM: 6640000 },
      { vertexId: "v-annex-ne", xM: 500016, yM: 6640004 },
      { vertexId: "v-join", xM: 500010, yM: 6640004 },
      { vertexId: "v-annex-ridge-w", xM: 500011, yM: 6640002 },
      { vertexId: "v-annex-ridge-e", xM: 500015, yM: 6640002 },
      { vertexId: "v-panel-sw", xM: 500012, yM: 6640001 },
      { vertexId: "v-panel-se", xM: 500014, yM: 6640001 },
      { vertexId: "v-panel-ne", xM: 500014, yM: 6640001.5 },
      { vertexId: "v-panel-nw", xM: 500012, yM: 6640001.5 },
    );
    geometry.sourceFootprint.points = [
      { xM: 500000, yM: 6640000 },
      { xM: 500016, yM: 6640000 },
      { xM: 500016, yM: 6640004 },
      { xM: 500010, yM: 6640004 },
      { xM: 500010, yM: 6640008 },
      { xM: 500000, yM: 6640008 },
    ];
    geometry.roofMasses.push({
      massId: "mass-annex",
      outlineId: "outline-annex",
      approvedByActorId: "admin-1",
      approvedAt: "2026-09-03T08:01:00.000Z",
      vertexIds: ["v-se", "v-annex-se", "v-annex-ne", "v-join"],
    });
    geometry.skeletonEdges.push({
      edgeId: "hip-annex",
      roofMassId: "mass-annex",
      fromVertexId: "v-annex-ridge-w",
      toVertexId: "v-annex-ridge-e",
      type: "hip",
      provenance: "manual",
    });
    geometry.obstacles.push({
      obstacleId: "solar-panel-1",
      roofMassId: "mass-annex",
      kind: "solar_panel",
      vertexIds: ["v-panel-sw", "v-panel-se", "v-panel-ne", "v-panel-nw"],
    });

    const ready = prepareAssistedManualRoofGeometryForCalculationV1(geometry);
    expect(ready.geometry.roofMasses.map((mass) => mass.massId)).toEqual([
      "mass-annex",
      "mass-main",
    ]);
    expect(ready.geometry.obstacles[0]).toMatchObject({
      roofMassId: "mass-annex",
      kind: "solar_panel",
    });
  });

  it("fails closed with stable issue codes for non-finite, self-intersecting, and out-of-mass geometry", () => {
    const geometry = simpleGable();
    geometry.vertices.find((vertex) => vertex.vertexId === "v-ridge-n")!.xM = Infinity;
    geometry.roofMasses[0].vertexIds = ["v-sw", "v-ne", "v-se", "v-nw"];
    geometry.skeletonEdges[0].fromVertexId = "v-window-sw";

    const issues = validateAssistedManualRoofGeometryV1(geometry);
    expect(issues.map((item) => item.code)).toEqual([
      "NON_FINITE_COORDINATE",
      "SCHEMA_INVALID",
    ]);
    expect(() => assertAssistedManualRoofGeometryV1(geometry)).toThrow(
      AssistedManualRoofGeometryValidationError,
    );

    const finiteInvalid = simpleGable();
    finiteInvalid.roofMasses[0].vertexIds = ["v-sw", "v-ne", "v-se", "v-nw"];
    finiteInvalid.skeletonEdges[0].fromVertexId = "v-window-sw";
    expect(validateAssistedManualRoofGeometryV1(finiteInvalid).map((item) => item.code)).toEqual([
      "DEGENERATE_POLYGON",
      "SELF_INTERSECTING_POLYGON",
      "SKELETON_ENDPOINT_OUTSIDE_MASS",
    ]);
  });
});
