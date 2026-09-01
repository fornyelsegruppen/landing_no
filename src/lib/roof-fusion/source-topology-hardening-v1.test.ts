import { describe, expect, it } from "vitest";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import type { RoofSnapshotV1 } from "./roof-snapshot-v1";
import {
  buildRoofSourceResultV1,
  roofSourceResultToSnapshotV1,
  validateRoofSourceResultForRequestV1,
  type RoofSourceResultV1,
} from "./source-adapter-v1";

type Normalized = NonNullable<RoofSourceResultV1["normalized"]>;

function snapshotWith(
  mutate: (normalized: Normalized) => void,
): RoofSnapshotV1 {
  const fixture = buildApprovedGableRoofFixtureV1();
  const normalized = structuredClone(fixture.sourceResult.normalized!);
  mutate(normalized);
  const result = buildRoofSourceResultV1({
    ...fixture.sourceResult,
    normalizedContentHash: undefined,
    sourceRecords: normalized.provenance.sources,
    normalized,
  });
  return roofSourceResultToSnapshotV1(fixture.request, result, {
    snapshotId: fixture.request.targetSnapshotId,
    revision: 1,
    caseId: fixture.request.caseId,
    propertyId: "property-12",
    inputVersion: fixture.request.expectedInputVersion,
    engineVersion: "roof-fusion-engine.v1.0.0",
    rendererVersion: "roof-renderer.v1.0.0",
    generatedAt: "2026-09-01T08:01:00.000Z",
    normalizedBy: {
      actorId: "roof-fusion-engine",
      actorType: "system",
    },
  });
}

function topologyEntities(snapshot: RoofSnapshotV1) {
  return snapshot.quality.checks.find(
    (check) => check.code === "TOPOLOGY_AND_REFERENCES",
  )?.entityRefs;
}

describe("Roof source adapter hardening", () => {
  it("rejects normalized-content drift even when snapshot conversion is called directly", () => {
    const fixture = buildApprovedGableRoofFixtureV1();
    const tampered = structuredClone(fixture.sourceResult);
    tampered.normalized!.geometry.vertices[0].xM += 0.25;

    expect(() =>
      roofSourceResultToSnapshotV1(fixture.request, tampered, {
        snapshotId: fixture.request.targetSnapshotId,
        revision: 1,
        caseId: fixture.request.caseId,
        inputVersion: fixture.request.expectedInputVersion,
        engineVersion: "roof-fusion-engine.v1.0.0",
        rendererVersion: "roof-renderer.v1.0.0",
        generatedAt: "2026-09-01T08:01:00.000Z",
        normalizedBy: {
          actorId: "roof-fusion-engine",
          actorType: "system",
        },
      }),
    ).toThrow(/content hash mismatch/);
  });

  it("requires exact declared-to-normalized provenance parity", () => {
    const fixture = buildApprovedGableRoofFixtureV1();
    const changed = structuredClone(fixture.sourceResult);
    changed.sourceRecords[0].license.name = "Different licence declaration";
    expect(() =>
      validateRoofSourceResultForRequestV1(fixture.request, changed),
    ).toThrow(/provenance differ/);

    const omitted = structuredClone(fixture.sourceResult);
    omitted.sourceRecords = omitted.sourceRecords.slice(0, 1);
    expect(() =>
      validateRoofSourceResultForRequestV1(fixture.request, omitted),
    ).toThrow(/provenance differ/);

    const duplicated = structuredClone(fixture.sourceResult);
    duplicated.sourceRecords.push(structuredClone(duplicated.sourceRecords[0]));
    expect(() =>
      validateRoofSourceResultForRequestV1(fixture.request, duplicated),
    ).toThrow(/Duplicate declared roof source records/);
  });

  it("rejects provider-version, timestamp and terminal-status contradictions", () => {
    const fixture = buildApprovedGableRoofFixtureV1();
    const wrongVersion = structuredClone(fixture.sourceResult);
    wrongVersion.providerInputVersion = "fake-provider-roof.v2";
    expect(() =>
      validateRoofSourceResultForRequestV1(fixture.request, wrongVersion),
    ).toThrow(/input version/);

    const predatesRequest = structuredClone(fixture.sourceResult);
    predatesRequest.receivedAt = "2026-09-01T07:59:59.000Z";
    expect(() =>
      validateRoofSourceResultForRequestV1(fixture.request, predatesRequest),
    ).toThrow(/predates/);

    expect(() =>
      buildRoofSourceResultV1({
        ...fixture.sourceResult,
        status: "failed",
        normalized: undefined,
        normalizedContentHash: undefined,
        issues: [],
      }),
    ).toThrow(/requires an error issue/);

    expect(() =>
      buildRoofSourceResultV1({
        ...fixture.sourceResult,
        status: "failed",
        normalizedContentHash: undefined,
        issues: [
          {
            code: "PROVIDER_FAILED",
            severity: "error",
            message: "Provider failed after returning an unusable payload",
            retryable: true,
          },
        ],
      }),
    ).toThrow(/cannot claim normalized content/);
  });
});

describe("Roof topology and provenance hardening", () => {
  it("fails closed when fusion buckets omit or misclassify observations", () => {
    const omitted = snapshotWith((normalized) => {
      normalized.provenance.fusionDecision.acceptedObservationIds =
        normalized.provenance.fusionDecision.acceptedObservationIds.slice(1);
    });
    expect(omitted.quality.status).toBe("fail");
    expect(topologyEntities(omitted)).toContain(
      "fusion_status_mismatch:obs-north-pitch",
    );

    const unknown = snapshotWith((normalized) => {
      normalized.provenance.fusionDecision.acceptedObservationIds.push(
        "obs-not-present",
      );
    });
    expect(topologyEntities(unknown)).toContain("fusion_observation_missing");
  });

  it("detects missing observation targets and non-reciprocal geometry links", () => {
    const observation = snapshotWith((normalized) => {
      normalized.provenance.observations[0].targetRef = "surface-not-present";
    });
    expect(topologyEntities(observation)).toContain(
      "observation_target_missing:obs-north-pitch",
    );

    const edge = snapshotWith((normalized) => {
      const north = normalized.geometry.surfaces.find(
        (surface) => surface.surfaceId === "surface-north",
      )!;
      north.edgeIds = north.edgeIds.filter(
        (edgeId) => edgeId !== "edge-north-eave",
      );
    });
    expect(topologyEntities(edge)).toContain(
      "edge_surface_not_reciprocal:edge-north-eave:surface-north",
    );

    const opening = snapshotWith((normalized) => {
      const south = normalized.geometry.surfaces.find(
        (surface) => surface.surfaceId === "surface-south",
      )!;
      south.openingIds = [];
    });
    expect(topologyEntities(opening)).toContain(
      "opening_surface_not_reciprocal:opening-skylight",
    );
  });

  it("detects degenerate contours, duplicate physical edges and missing obstacle links", () => {
    const contour = snapshotWith((normalized) => {
      const north = normalized.geometry.contours.find(
        (item) => item.contourId === "contour-north",
      )!;
      north.vertexIds = [
        north.vertexIds[0],
        north.vertexIds[1],
        north.vertexIds[0],
      ];
    });
    expect(topologyEntities(contour)).toEqual(
      expect.arrayContaining([
        "contour_repeated_vertex:contour-north",
        "contour_too_small:contour-north",
        "contour_zero_area:contour-north",
      ]),
    );

    const duplicateEdge = snapshotWith((normalized) => {
      const original = normalized.geometry.edges.find(
        (edge) => edge.edgeId === "edge-ridge",
      )!;
      normalized.geometry.edges.push({
        ...structuredClone(original),
        edgeId: "edge-ridge-duplicate",
      });
      for (const surface of normalized.geometry.surfaces) {
        if (surface.edgeIds.includes(original.edgeId))
          surface.edgeIds.push("edge-ridge-duplicate");
      }
    });
    expect(topologyEntities(duplicateEdge)).toContain(
      "duplicate_edge_pair:edge-ridge.edge-ridge-duplicate",
    );

    const obstacle = snapshotWith((normalized) => {
      normalized.geometry.obstacles[0].surfaceId = "surface-not-present";
    });
    expect(topologyEntities(obstacle)).toContain(
      "obstacle_surface_missing:obstacle-chimney",
    );
  });

  it("blocks rejected sources and keeps limited sources in review", () => {
    const rejected = snapshotWith((normalized) => {
      const source = normalized.provenance.sources.find(
        (item) => item.sourceId === "src-provider",
      )!;
      source.quality.status = "rejected";
      source.quality.score = 0;
      source.quality.reasons = ["Fixture deliberately rejected"];
    });
    expect(rejected.quality.status).toBe("fail");
    expect(rejected.state).toBe("blocked");
    expect(
      rejected.quality.checks.find((check) => check.code === "SOURCE_LICENSE"),
    ).toMatchObject({ status: "fail", entityRefs: ["src-provider"] });

    const limited = snapshotWith((normalized) => {
      const source = normalized.provenance.sources.find(
        (item) => item.sourceId === "src-provider",
      )!;
      source.quality.status = "limited";
      source.quality.score = 0.55;
      source.quality.reasons = ["Fixture has limited source quality"];
    });
    expect(limited.quality.status).toBe("review_required");
    expect(limited.state).toBe("review_required");
  });

  it("keeps restricted licences and unresolved evidence conflicts explicit", () => {
    const restricted = snapshotWith((normalized) => {
      const source = normalized.provenance.sources.find(
        (item) => item.sourceId === "src-provider",
      )!;
      source.license.status = "restricted";
      source.license.name = "Fixture licence requiring human review";
    });
    expect(restricted.quality.status).toBe("review_required");
    expect(
      restricted.quality.checks.find(
        (check) => check.code === "SOURCE_LICENSE",
      ),
    ).toMatchObject({
      status: "review_required",
      entityRefs: ["src-provider"],
    });

    const conflicted = snapshotWith((normalized) => {
      const observation = normalized.provenance.observations.find(
        (item) => item.observationId === "obs-north-pitch",
      )!;
      observation.status = "conflicted";
      observation.reasons = ["Synthetic unresolved pitch conflict"];
      normalized.provenance.fusionDecision.acceptedObservationIds =
        normalized.provenance.fusionDecision.acceptedObservationIds.filter(
          (observationId) => observationId !== observation.observationId,
        );
      normalized.provenance.fusionDecision.conflictedObservationIds.push(
        observation.observationId,
      );
    });
    expect(conflicted.quality.status).toBe("review_required");
    expect(
      conflicted.quality.checks.find(
        (check) => check.code === "EVIDENCE_CONFLICTS",
      ),
    ).toMatchObject({
      status: "review_required",
      entityRefs: ["obs-north-pitch"],
    });
  });
});
