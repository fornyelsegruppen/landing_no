import { describe, expect, it } from "vitest";
import goldenSummary from "./__fixtures__/gable-roof-geometry-calculation-v1.golden-summary.json";
import geometryFixture from "./__fixtures__/gable-roof-geometry-input-v1.json";
import {
  calculateRoofGeometryV1,
  roofGeometryCalculationToSourceResultV1,
  roofGeometryInputV1Schema,
  RoofGeometryCalculationError,
  verifyRoofGeometryCalculationV1,
  type RoofGeometryInputV1,
} from "./geometry-calculation-v1";
import {
  buildRoofSourceRequestV1,
  roofSourceResultToSnapshotV1,
} from "./source-adapter-v1";

function inputFixture() {
  return roofGeometryInputV1Schema.parse(geometryFixture);
}

function requestFor(input: RoofGeometryInputV1) {
  const calculation = calculateRoofGeometryV1(input);
  return buildRoofSourceRequestV1({
    schemaVersion: "roof-source-request.v1",
    requestId: "request-geometry-gable-001",
    caseId: "case-geometry-12",
    targetSnapshotId: "roof-geometry-case-12-r1",
    expectedInputVersion: "roof-geometry-input.v1",
    adapterId: "deterministic-roof-geometry",
    idempotencyKey: "roof-geometry:case-12:fixture-001",
    requestedAt: "2026-09-01T09:00:00.000Z",
    input: {
      geometryInputHash: calculation.inputHash,
      calculationId: calculation.calculationId,
    },
  });
}

function foldFixture(kind: "hip" | "valley" | "unknown") {
  const base = inputFixture();
  const rightHigh = kind === "valley";
  const leftHigh = kind !== "hip";
  const vertex = (vertexId: string, xM: number, yM: number, zM: number) => ({
    vertexId,
    xM,
    yM,
    zM,
    uncertaintyM: 0.01,
    sourceRefs: ["src-provider"],
  });
  return roofGeometryInputV1Schema.parse({
    ...base,
    calculationId: `calc-fold-${kind}-001`,
    vertices: [
      vertex("fold-a", 0, 0, 2),
      vertex("fold-b", 0, 4, 4),
      vertex("fold-c", 4, 4, rightHigh ? 8 : 0),
      vertex("fold-d", 4, 0, rightHigh ? 6 : -2),
      vertex("fold-e", -4, 0, leftHigh ? 6 : -2),
      vertex("fold-f", -4, 4, leftHigh ? 8 : 0),
    ],
    surfaces: [
      {
        surfaceId: "fold-right",
        contourId: "contour-fold-right",
        vertexIds: ["fold-a", "fold-b", "fold-c", "fold-d"],
        edgeIds: [
          "edge-fold-shared",
          "edge-fold-right-north",
          "edge-fold-right-outer",
          "edge-fold-right-south",
        ],
        quality: "verified",
        sourceRefs: ["src-provider"],
      },
      {
        surfaceId: "fold-left",
        contourId: "contour-fold-left",
        vertexIds: ["fold-b", "fold-a", "fold-e", "fold-f"],
        edgeIds: [
          "edge-fold-shared",
          "edge-fold-left-south",
          "edge-fold-left-outer",
          "edge-fold-left-north",
        ],
        quality: "verified",
        sourceRefs: ["src-provider"],
      },
    ],
    openings: [],
    obstacles: [],
    provenance: {
      ...base.provenance,
      observations: [],
      fusionDecision: {
        ...base.provenance.fusionDecision,
        decisionId: `fusion-fold-${kind}`,
        acceptedObservationIds: [],
        rejectedObservationIds: [],
        conflictedObservationIds: [],
      },
    },
  });
}

describe("Roof geometry calculation v1", () => {
  it("calculates the golden 3D gable fixture with pinned hashes", () => {
    const calculation = calculateRoofGeometryV1(inputFixture());

    expect(calculation.inputHash).toBe(
      "1a5951010dc66dcf935f0e78536a71e64e8df50cecfe72670a9989dfa1bc68ec",
    );
    expect(calculation.normalizedContentHash).toBe(
      "a0e36223df6be0faf616d71e23f9f2cd787c335122819830a472e4c135bd9791",
    );
    expect(calculation.calculationHash).toBe(
      "388078cc274ad23d5d3a8ccc6ecba651acbf0d6e80f74161217a135ba6b61a9c",
    );
    expect(calculation.trace.surfaces).toEqual([
      {
        surfaceId: "surface-north",
        horizontalAreaM2: 40,
        surfaceAreaM2: 46.188021535,
        openingAreaM2: 0,
        netSurfaceAreaM2: 46.188021535,
        pitchDegrees: 30,
        azimuthDegrees: 0,
      },
      {
        surfaceId: "surface-south",
        horizontalAreaM2: 40,
        surfaceAreaM2: 46.188021535,
        openingAreaM2: 1.385640646,
        netSurfaceAreaM2: 44.802380889,
        pitchDegrees: 30,
        azimuthDegrees: 180,
      },
    ]);
    expect(
      calculation.trace.edges.find((edge) => edge.edgeId === "edge-ridge"),
    ).toMatchObject({ classification: "ridge", length3dM: 10 });
    expect(
      calculation.trace.edges.filter((edge) => edge.classification === "eave"),
    ).toHaveLength(2);
  });

  it("keeps logical hashes stable when entity arrays are reordered", () => {
    const input = inputFixture();
    const reordered = structuredClone(input);
    reordered.vertices.reverse();
    reordered.surfaces.reverse();
    reordered.openings.reverse();
    reordered.obstacles.reverse();
    reordered.provenance.sources.reverse();
    reordered.provenance.observations.reverse();

    const first = calculateRoofGeometryV1(input);
    const second = calculateRoofGeometryV1(reordered);
    expect(second.inputHash).toBe(first.inputHash);
    expect(second.normalizedContentHash).toBe(first.normalizedContentHash);
    expect(second.calculationHash).toBe(first.calculationHash);
  });

  it.each([
    ["hip", "hip"],
    ["valley", "valley"],
  ] as const)(
    "classifies a sloping shared %s edge",
    (fixtureKind, expected) => {
      const calculation = calculateRoofGeometryV1(foldFixture(fixtureKind));
      expect(
        calculation.trace.edges.find(
          (edge) => edge.edgeId === "edge-fold-shared",
        ),
      ).toMatchObject({
        classification: expected,
        length2dM: 4,
        length3dM: 4.472135955,
        adjacentSurfaceIds: ["fold-left", "fold-right"],
      });
    },
  );

  it.each(["hip", "valley"] as const)(
    "classifies a sloping %s from perpendicular plane slopes despite unequal adjacent faces",
    (kind) => {
      const input = foldFixture(kind);
      input.vertices = input.vertices
        .filter((point) =>
          ["fold-a", "fold-b", "fold-c", "fold-e"].includes(point.vertexId),
        )
        .map((point) => {
          if (point.vertexId !== "fold-c" && point.vertexId !== "fold-e")
            return point;
          const yM = point.vertexId === "fold-c" ? 100 : -96;
          return {
            ...point,
            yM,
            zM: 2 + yM * 0.5 + (kind === "valley" ? 4 : -4),
          };
        });
      input.surfaces = input.surfaces.map((surface, index) => ({
        ...surface,
        vertexIds:
          index === 0
            ? ["fold-a", "fold-b", "fold-c"]
            : ["fold-b", "fold-a", "fold-e"],
        edgeIds: [
          "edge-fold-shared",
          `triangle-${index}-1`,
          `triangle-${index}-2`,
        ],
      }));
      const result = calculateRoofGeometryV1(input);
      expect(
        result.trace.edges.find((edge) => edge.edgeId === "edge-fold-shared")
          ?.classification,
      ).toBe(kind);
    },
  );

  it("feeds one complete source result into a quality-gated roof snapshot", () => {
    const input = inputFixture();
    const calculation = calculateRoofGeometryV1(input);
    const request = requestFor(input);
    const result = roofGeometryCalculationToSourceResultV1(
      request,
      calculation,
      "2026-09-01T09:00:10.000Z",
    );
    const snapshot = roofSourceResultToSnapshotV1(request, result, {
      snapshotId: request.targetSnapshotId,
      revision: 1,
      caseId: request.caseId,
      propertyId: "property-geometry-12",
      inputVersion: request.expectedInputVersion,
      engineVersion: "roof-fusion-engine.v1.1.0",
      rendererVersion: "roof-renderer.v1.0.0",
      generatedAt: "2026-09-01T09:00:20.000Z",
      normalizedBy: {
        actorId: "roof-geometry-calculator",
        actorType: "system",
      },
    });

    expect(result.status).toBe("complete");
    expect(snapshot.quality.status).toBe("pass");
    expect(snapshot.state).toBe("review_required");
    expect(snapshot.totals.grossHorizontalArea.min).toBe(80);
    expect(snapshot.totals.grossSurfaceArea.min).toBe(92.37604307);
    expect(snapshot.totals.netSurfaceArea.min).toBe(90.990402424);
    expect(snapshot.totals.eaveLength.min).toBe(20);
    expect(snapshot.totals.gutterCandidateLength.min).toBe(20);
    expect(snapshot.totals.verifiedGutterLength.mode).toBe("unknown");
    expect(snapshot.snapshotHash).toBe(
      "0b03530e8cc91ec7efd6b744b9f3f3f7d25ee0b904bbc4eded02bb8d23e03b47",
    );
    expect(snapshot.rendererPayload.renderHash).toBe(
      "34f0af3af93b75576ce6c64843a38f3408a18f698b5491ae57cd6c75e95c88e0",
    );
    expect({
      schemaVersion: calculation.schemaVersion,
      calculatorVersion: calculation.calculatorVersion,
      calculationId: calculation.calculationId,
      inputHash: calculation.inputHash,
      normalizedContentHash: calculation.normalizedContentHash,
      calculationHash: calculation.calculationHash,
      sourceStatus: result.status,
      snapshotHash: snapshot.snapshotHash,
      rendererHash: snapshot.rendererPayload.renderHash,
      qualityStatus: snapshot.quality.status,
      totals: snapshot.totals,
      trace: calculation.trace,
    }).toEqual(goldenSummary);
  });

  it("keeps an ambiguous shared edge partial and reviewable", () => {
    const input = foldFixture("unknown");
    const calculation = calculateRoofGeometryV1(input);
    const request = requestFor(input);
    const result = roofGeometryCalculationToSourceResultV1(
      request,
      calculation,
      "2026-09-01T09:00:10.000Z",
    );
    const snapshot = roofSourceResultToSnapshotV1(request, result, {
      snapshotId: request.targetSnapshotId,
      revision: 1,
      caseId: request.caseId,
      inputVersion: request.expectedInputVersion,
      engineVersion: "roof-fusion-engine.v1.1.0",
      rendererVersion: "roof-renderer.v1.0.0",
      generatedAt: "2026-09-01T09:00:20.000Z",
      normalizedBy: {
        actorId: "roof-geometry-calculator",
        actorType: "system",
      },
    });

    expect(
      calculation.trace.edges.find((edge) => edge.edgeId === "edge-fold-shared")
        ?.classification,
    ).toBe("unknown");
    expect(result.status).toBe("partial");
    expect(result.issues).toMatchObject([
      { code: "GEOMETRY_EDGE_CLASSIFICATION_UNKNOWN", severity: "warning" },
    ]);
    expect(snapshot.processing.status).toBe("partial");
    expect(snapshot.quality.status).toBe("review_required");
    expect(snapshot.state).toBe("review_required");
  });

  it("detects calculation and request tampering", () => {
    const input = inputFixture();
    const calculation = calculateRoofGeometryV1(input);
    const contentDrift = structuredClone(calculation);
    contentDrift.normalized.geometry.vertices[0].xM += 1;
    expect(() => verifyRoofGeometryCalculationV1(contentDrift)).toThrow(
      /normalized content has changed/,
    );

    const traceDrift = structuredClone(calculation);
    traceDrift.trace.surfaces[0].surfaceAreaM2 += 1;
    expect(() => verifyRoofGeometryCalculationV1(traceDrift)).toThrow(
      /trace has changed/,
    );

    const request = requestFor(input);
    const wrongRequest = structuredClone(request);
    wrongRequest.input = {
      geometryInputHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      calculationId: calculation.calculationId,
    };
    expect(() =>
      roofGeometryCalculationToSourceResultV1(
        wrongRequest,
        calculation,
        "2026-09-01T09:00:10.000Z",
      ),
    ).toThrow(RoofGeometryCalculationError);
  });

  it.each([
    [
      "non-planar facet",
      (input: RoofGeometryInputV1) => {
        input.vertices.find((vertex) => vertex.vertexId === "v3")!.zM += 2;
      },
      "NON_PLANAR_FACET",
    ],
    [
      "missing source reference",
      (input: RoofGeometryInputV1) => {
        input.vertices[0].sourceRefs = ["source-not-declared"];
      },
      "SOURCE_REFERENCE_MISSING",
    ],
    [
      "conflicting physical edge IDs",
      (input: RoofGeometryInputV1) => {
        const north = input.surfaces.find(
          (surface) => surface.surfaceId === "surface-north",
        )!;
        north.edgeIds[0] = "edge-ridge-conflict";
      },
      "PHYSICAL_EDGE_ID_CONFLICT",
    ],
    [
      "self-intersecting surface contour",
      (input: RoofGeometryInputV1) => {
        const south = input.surfaces.find(
          (surface) => surface.surfaceId === "surface-south",
        )!;
        south.vertexIds = ["v1", "v3", "v2", "v4"];
      },
      "SELF_INTERSECTING_FACET",
    ],
    [
      "opening offset from its roof surface",
      (input: RoofGeometryInputV1) => {
        ["v7", "v8", "v9", "v10"].forEach((vertexId) => {
          input.vertices.find((item) => item.vertexId === vertexId)!.zM += 1;
        });
      },
      "OPENING_NOT_ON_SURFACE",
    ],
    [
      "opening outside its roof surface",
      (input: RoofGeometryInputV1) => {
        const values = [
          [0, 0, 0],
          [20, 0, 0],
          [20, 4, 2.309401076758503],
          [0, 4, 2.309401076758503],
        ];
        ["v7", "v8", "v9", "v10"].forEach((vertexId, index) => {
          const vertex = input.vertices.find(
            (item) => item.vertexId === vertexId,
          )!;
          [vertex.xM, vertex.yM, vertex.zM] = values[index];
        });
      },
      "OPENING_OUTSIDE_SURFACE",
    ],
    [
      "overlapping openings",
      (input: RoofGeometryInputV1) => {
        input.openings.push({
          ...structuredClone(input.openings[0]),
          openingId: "opening-skylight-overlap",
          contourId: "contour-skylight-overlap",
        });
      },
      "OPENING_OVERLAP",
    ],
    [
      "calculator-side verified-class promotion",
      (input: RoofGeometryInputV1) => {
        input.measurement.class = "verified_geometry";
      },
      "MEASUREMENT_CLASS_NOT_CALCULABLE",
    ],
  ] as const)("fails closed for %s", (_name, mutate, code) => {
    const input = inputFixture();
    mutate(input);
    try {
      calculateRoofGeometryV1(input);
      throw new Error("Expected geometry calculation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RoofGeometryCalculationError);
      expect((error as RoofGeometryCalculationError).code).toBe(code);
    }
  });
});
