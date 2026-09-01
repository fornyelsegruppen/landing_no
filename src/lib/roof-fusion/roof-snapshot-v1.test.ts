import { describe, expect, it } from "vitest";
import approvedGoldenFixture from "./__fixtures__/gable-roof-approved-v1.golden.json";
import normalizedFixture from "./__fixtures__/gable-roof-normalized-v1.json";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import {
  approvedRoofRendererPayloadV1,
  applyRoofSnapshotCorrectionV1,
  approveRoofSnapshotV1,
  parseRoofSnapshotV1,
  RoofSnapshotIntegrityError,
  serializeRoofSnapshotV1,
  UnsupportedRoofSnapshotVersionError,
  type RoofSnapshotV1,
} from "./roof-snapshot-v1";
import {
  buildRoofSourceRequestV1,
  buildRoofSourceResultV1,
  FakeRoofSourceAdapterV1,
  ingestRoofSourceV1,
  roofSourceResultToSnapshotV1,
  RoofSourceIntegrityError,
  UnsupportedRoofSourceResultVersionError,
  type RoofSourceAdapterV1,
  type RoofSourceRequestV1,
  type RoofSourceResultV1,
} from "./source-adapter-v1";

const systemActor = {
  actorId: "roof-fusion-engine",
  actorType: "system" as const,
  displayName: "Roof Fusion Engine",
};
const reviewer = {
  actorId: "admin-17",
  actorType: "administrator" as const,
  displayName: "RF Reviewer",
};
const normalized = normalizedFixture as unknown as NonNullable<
  RoofSourceResultV1["normalized"]
>;

function request() {
  return buildRoofSourceRequestV1({
    schemaVersion: "roof-source-request.v1",
    requestId: "request-gable-001",
    caseId: "case-12",
    targetSnapshotId: "roof-case-12-r1",
    expectedInputVersion: "fake-provider-roof.v1",
    adapterId: "fake-roof-adapter",
    idempotencyKey: "roof-source:case-12:fixture-001",
    requestedAt: "2026-09-01T08:00:00.000Z",
    input: {
      providerObjectId: "fixture-gable-001",
      propertyAnchor: { latitude: 59.9139, longitude: 10.7522 },
    },
  });
}

function result(
  sourceRequest: RoofSourceRequestV1,
  status: RoofSourceResultV1["status"] = "complete",
  normalizedContent?: RoofSourceResultV1["normalized"],
) {
  const resolvedNormalized =
    normalizedContent ??
    (["complete", "partial"].includes(status) ? normalized : undefined);
  return buildRoofSourceResultV1({
    schemaVersion: "roof-source-result.v1",
    status,
    adapterId: "fake-roof-adapter",
    adapterVersion: "fake-roof-adapter.v1",
    provider: "fake-roof-provider",
    providerInputVersion: "fake-provider-roof.v1",
    providerRequestId: "fixture-gable-001",
    requestInputHash: sourceRequest.inputHash,
    idempotencyKey: sourceRequest.idempotencyKey,
    receivedAt: "2026-09-01T08:00:30.000Z",
    rawContentHash:
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    sourceRecords: normalized.provenance.sources,
    issues:
      status === "partial"
        ? [
            {
              code: "SOURCE_SECTION_MISSING",
              severity: "warning",
              message: "One optional provider section was unavailable",
              retryable: true,
              sourceRef: "src-provider",
            },
          ]
        : ["failed", "unknown_version"].includes(status)
          ? [
              {
                code:
                  status === "failed"
                    ? "SOURCE_PROVIDER_FAILED"
                    : "SOURCE_VERSION_UNSUPPORTED",
                severity: "error" as const,
                message:
                  status === "failed"
                    ? "Provider request failed"
                    : "Provider returned an unsupported input version",
                retryable: status === "failed",
                sourceRef: "src-provider",
              },
            ]
          : [],
    normalized: resolvedNormalized,
  });
}

function snapshot(
  sourceRequest = request(),
  sourceResult = result(sourceRequest),
) {
  return roofSourceResultToSnapshotV1(sourceRequest, sourceResult, {
    snapshotId: sourceRequest.targetSnapshotId,
    revision: 1,
    caseId: sourceRequest.caseId,
    propertyId: "property-12",
    legacyMeasurementId: 44,
    inputVersion: sourceRequest.expectedInputVersion,
    engineVersion: "roof-fusion-engine.v1.0.0",
    rendererVersion: "roof-renderer.v1.0.0",
    generatedAt: "2026-09-01T08:01:00.000Z",
    normalizedBy: systemActor,
  });
}

function approve(value: RoofSnapshotV1) {
  return approveRoofSnapshotV1(value, {
    schemaVersion: "roof-snapshot-approval-command.v1",
    expectedSnapshotHash: value.snapshotHash,
    idempotencyKey: "roof-approval:case-12:r1",
    actor: reviewer,
    approvedAt: "2026-09-01T08:05:00.000Z",
  });
}

describe("Roof Snapshot v1 contract", () => {
  it("keeps the owner-visible approved roof-snapshot.v1 golden fixture exact", () => {
    const parsed = parseRoofSnapshotV1(approvedGoldenFixture);
    const generated = buildApprovedGableRoofFixtureV1().approvedSnapshot;

    expect(parsed).toEqual(generated);
    expect(parsed.snapshotHash).toBe(
      "fd45e545cc5accb4b4d0f7a5e4db223d27eb36fb842fd989748da10ed40f115e",
    );
  });

  it("normalizes a deterministic provider fixture into one versioned canonical snapshot", async () => {
    const sourceRequest = request();
    const sourceResult = result(sourceRequest);
    const adapter = new FakeRoofSourceAdapterV1(
      "fake-roof-adapter",
      "fake-roof-adapter.v1",
      sourceResult,
    );

    const ingested = await ingestRoofSourceV1(adapter, sourceRequest);
    const value = snapshot(sourceRequest, ingested);

    expect(adapter.calls).toHaveLength(1);
    expect(value.schemaVersion).toBe("roof-snapshot.v1");
    expect(value.inputVersion).toBe("fake-provider-roof.v1");
    expect(value.units).toEqual({
      length: "m",
      area: "m2",
      angle: "deg",
      coordinates: "m",
      precision: {
        lengthDecimals: 3,
        areaDecimals: 3,
        angleDecimals: 2,
      },
    });
    expect(value.geometry.surfaces).toHaveLength(2);
    expect(value.geometry.edges).toHaveLength(7);
    expect(value.geometry.openings[0].kind).toBe("skylight");
    expect(value.geometry.obstacles[0].kind).toBe("chimney");
    expect(value.totals.grossHorizontalArea).toMatchObject({
      mode: "exact",
      min: 80,
      max: 80,
      unit: "m2",
    });
    expect(value.totals.netSurfaceArea.min).toBeCloseTo(90.99040242420236, 8);
    expect(value.totals.footprintPerimeter.min).toBe(36);
    expect(value.totals.eaveLength.min).toBe(20);
    expect(value.totals.gutterCandidateLength.min).toBe(20);
    expect(value.totals.verifiedGutterLength.mode).toBe("unknown");
    expect(value.quality.status).toBe("pass");
    expect(value.state).toBe("review_required");
    expect(Object.hasOwn(value, "supersedesSnapshotId")).toBe(false);
    expect(value.snapshotHash).toBe(
      "03660f8caaaabf15eab6d0974237231e29f409b8ecfed2821184fb8f1d7d5395",
    );
    expect(value.rendererPayload.renderHash).toBe(
      "0e98625f2c57632b85bfd74de49b5b6e36e569bae58790dcb43fca3ea54df739",
    );

    const serialized = serializeRoofSnapshotV1(value);
    expect(parseRoofSnapshotV1(JSON.parse(serialized))).toEqual(value);
  });

  it("fails closed for unknown snapshot versions and content drift", () => {
    expect(() =>
      parseRoofSnapshotV1({ schemaVersion: "roof-snapshot.v2" }),
    ).toThrow(UnsupportedRoofSnapshotVersionError);

    const value = snapshot();
    const tampered = structuredClone(value);
    tampered.geometry.surfaces[0].grossHorizontalArea.min = 999;
    tampered.geometry.surfaces[0].grossHorizontalArea.max = 999;
    expect(() => parseRoofSnapshotV1(tampered)).toThrow(
      RoofSnapshotIntegrityError,
    );
  });

  it("canonicalizes provider ordering, ring rotation and winding before hashing", () => {
    const sourceRequest = request();
    const reordered = structuredClone(normalized);
    reordered.geometry.vertices.reverse();
    reordered.geometry.surfaces.reverse();
    reordered.geometry.edges.reverse();
    reordered.geometry.contours[0].vertexIds = ["v3", "v2", "v1", "v4"];

    const canonical = snapshot(sourceRequest, result(sourceRequest));
    const equivalent = snapshot(
      sourceRequest,
      result(sourceRequest, "complete", reordered),
    );

    expect(equivalent.snapshotHash).toBe(canonical.snapshotHash);
    expect(equivalent.rendererPayload.renderHash).toBe(
      canonical.rendererPayload.renderHash,
    );
    expect(equivalent.geometry).toEqual(canonical.geometry);
  });

  it("approves exactly the reviewed hash and returns one payload for every channel", () => {
    const reviewed = snapshot();
    const approved = approve(reviewed);

    expect(approved.state).toBe("approved");
    expect(approved.approval).toMatchObject({
      status: "approved",
      approvedBy: reviewer,
      approvedAt: "2026-09-01T08:05:00.000Z",
    });
    expect(
      approveRoofSnapshotV1(approved, {
        schemaVersion: "roof-snapshot-approval-command.v1",
        expectedSnapshotHash: reviewed.snapshotHash,
        idempotencyKey: "roof-approval:case-12:r1",
        actor: reviewer,
        approvedAt: "2026-09-01T08:05:00.000Z",
      }),
    ).toEqual(approved);

    const channels = ["admin", "worker", "customer", "pdf"] as const;
    const payloads = channels.map(() =>
      approvedRoofRendererPayloadV1(approved, approved.snapshotHash),
    );
    expect(new Set(payloads.map((item) => item.sourceSnapshotHash)).size).toBe(
      1,
    );
    expect(new Set(payloads.map((item) => item.payload.renderHash)).size).toBe(
      1,
    );
    expect(payloads.map((item) => item.payload)).toEqual([
      payloads[0].payload,
      payloads[0].payload,
      payloads[0].payload,
      payloads[0].payload,
    ]);
    expect(
      payloads[0].payload.sources.map((source) => source.sourceId),
    ).toEqual(["src-provider"]);
    expect(
      payloads[0].payload.sources.some(
        (source) => source.sourceId === "src-manual",
      ),
    ).toBe(false);

    expect(() =>
      approveRoofSnapshotV1(reviewed, {
        schemaVersion: "roof-snapshot-approval-command.v1",
        expectedSnapshotHash:
          "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        idempotencyKey: "roof-approval:case-12:stale",
        actor: reviewer,
        approvedAt: "2026-09-01T08:06:00.000Z",
      }),
    ).toThrow(/changed after review/);
  });

  it("creates an auditable new version for a manual correction and keeps retries idempotent", () => {
    const original = snapshot();
    const command = {
      schemaVersion: "roof-snapshot-correction-command.v1" as const,
      correctionType: "edge_gutter_candidate" as const,
      edgeId: "edge-north-eave",
      value: false,
      newSnapshotId: "roof-case-12-r2",
      expectedSnapshotHash: original.snapshotHash,
      idempotencyKey: "roof-correction:case-12:r2:gutter",
      actor: reviewer,
      correctedAt: "2026-09-01T08:03:00.000Z",
      reason: "On-site inspection confirmed no gutter on the north eave",
      sourceRefs: ["src-manual"],
    };

    const corrected = applyRoofSnapshotCorrectionV1(original, command);
    expect(corrected).toMatchObject({
      snapshotId: "roof-case-12-r2",
      revision: 2,
      supersedesSnapshotId: "roof-case-12-r1",
      state: "review_required",
      approval: { status: "pending" },
    });
    expect(corrected.snapshotHash).not.toBe(original.snapshotHash);
    expect(corrected.totals.gutterCandidateLength.min).toBe(10);
    expect(corrected.manualCorrections[0]).toMatchObject({
      targetType: "edge",
      targetId: "edge-north-eave",
      path: "gutterCandidate",
      before: true,
      after: false,
      idempotencyKey: command.idempotencyKey,
    });
    expect(applyRoofSnapshotCorrectionV1(corrected, command)).toEqual(
      corrected,
    );

    const approved = approve(original);
    expect(() => applyRoofSnapshotCorrectionV1(approved, command)).toThrow(
      /immutable/,
    );
  });

  it.each([
    ["partial", "partial", "review_required"],
    ["failed", "error", "blocked"],
    ["unknown_version", "unknown", "blocked"],
  ] as const)(
    "preserves %s provider state without inventing a complete measurement",
    (providerStatus, processingStatus, expectedState) => {
      const sourceRequest = request();
      const sourceResult = result(
        sourceRequest,
        providerStatus,
        providerStatus === "partial" ? normalized : undefined,
      );
      const value = snapshot(sourceRequest, sourceResult);

      expect(value.processing.status).toBe(processingStatus);
      expect(value.state).toBe(expectedState);
      if (providerStatus !== "partial") {
        expect(value.geometry.surfaces).toEqual([]);
        expect(value.quality.status).toBe("fail");
      }
    },
  );
});

describe("Roof source adapter v1 contract", () => {
  it("rejects request/result drift and unknown adapter contract versions", async () => {
    const sourceRequest = request();
    const sourceResult = result(sourceRequest);
    const wrongRequest = structuredClone(sourceRequest);
    wrongRequest.input = { providerObjectId: "different" };
    const adapter = new FakeRoofSourceAdapterV1(
      "fake-roof-adapter",
      "fake-roof-adapter.v1",
      sourceResult,
    );

    await expect(ingestRoofSourceV1(adapter, wrongRequest)).rejects.toThrow(
      RoofSourceIntegrityError,
    );

    const unknownVersionAdapter: RoofSourceAdapterV1 = {
      adapterId: "fake-roof-adapter",
      adapterVersion: "fake-roof-adapter.v1",
      async ingest() {
        return { schemaVersion: "roof-source-result.v2" };
      },
    };
    await expect(
      ingestRoofSourceV1(unknownVersionAdapter, sourceRequest),
    ).rejects.toThrow(UnsupportedRoofSourceResultVersionError);
  });

  it("returns byte-stable logical output for an idempotent fake-provider replay", async () => {
    const sourceRequest = request();
    const sourceResult = result(sourceRequest);
    const adapter = new FakeRoofSourceAdapterV1(
      "fake-roof-adapter",
      "fake-roof-adapter.v1",
      sourceResult,
    );

    const first = await ingestRoofSourceV1(adapter, sourceRequest);
    const second = await ingestRoofSourceV1(adapter, sourceRequest);
    expect(first).toEqual(second);
    expect(first.normalizedContentHash).toBe(second.normalizedContentHash);
    expect(first.idempotencyKey).toBe(sourceRequest.idempotencyKey);
    expect(adapter.calls).toHaveLength(2);
  });
});
