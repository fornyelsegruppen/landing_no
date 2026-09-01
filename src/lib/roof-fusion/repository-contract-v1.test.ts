import { describe, expect, it } from "vitest";
import repositoryGoldenSummary from "./__fixtures__/roof-repository-lifecycle-v1.golden-summary.json";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import {
  buildRoofSnapshotV1,
  type RoofSnapshotSeedV1,
  type RoofSnapshotV1,
} from "./roof-snapshot-v1";
import {
  executeRoofRepositoryCommandV1,
  InMemoryRoofSnapshotRepositoryV1,
  readBoundApprovedRoofRendererV1,
  RoofRepositoryCommandErrorV1,
  roofRepositoryErrorCodesV1,
  type RoofRepositoryCommandV1,
} from "./repository-contract-v1";

function reviewedFixture() {
  return buildApprovedGableRoofFixtureV1().reviewedSnapshot;
}

function calculateCommand(
  snapshot = reviewedFixture(),
): Extract<RoofRepositoryCommandV1, { commandType: "calculate" }> {
  return {
    schemaVersion: "roof-repository-command.v1",
    commandType: "calculate",
    caseId: snapshot.subject.caseId,
    expectedLatestRevision: null,
    expectedLatestSnapshotHash: null,
    candidateSnapshot: snapshot,
    idempotencyKey: "roof-repository:case-12:calculate-r1",
    actor: {
      actorId: "roof-fusion-engine",
      actorType: "system",
      displayName: "Roof Fusion Engine",
    },
    occurredAt: "2026-09-01T10:00:00.000Z",
  };
}

function reviewCommand(
  current: RoofSnapshotV1,
): Extract<RoofRepositoryCommandV1, { commandType: "review" }> {
  return {
    schemaVersion: "roof-repository-command.v1",
    commandType: "review",
    caseId: current.subject.caseId,
    currentSnapshotId: current.snapshotId,
    newSnapshotId: "roof-case-12-r2-verified",
    expectedRevision: current.revision,
    expectedSnapshotHash: current.snapshotHash,
    targetMeasurementClass: "verified_geometry",
    reason: "Administrator confirmed geometry against the accepted evidence",
    sourceRefs: ["src-provider"],
    idempotencyKey: "roof-repository:case-12:review-r1",
    actor: {
      actorId: "admin-17",
      actorType: "administrator",
      displayName: "RF Reviewer",
    },
    occurredAt: "2026-09-01T10:05:00.000Z",
  };
}

function approveCommand(
  current: RoofSnapshotV1,
): Extract<RoofRepositoryCommandV1, { commandType: "approve" }> {
  return {
    schemaVersion: "roof-repository-command.v1",
    commandType: "approve",
    caseId: current.subject.caseId,
    currentSnapshotId: current.snapshotId,
    newSnapshotId: "roof-case-12-r3-approved",
    expectedRevision: current.revision,
    approval: {
      schemaVersion: "roof-snapshot-approval-command.v1",
      expectedSnapshotHash: current.snapshotHash,
      idempotencyKey: "roof-repository:case-12:approve-r2",
      actor: {
        actorId: "admin-17",
        actorType: "administrator",
        displayName: "RF Reviewer",
      },
      approvedAt: "2026-09-01T10:06:00.000Z",
    },
  };
}

async function appendInitial(
  repository: InMemoryRoofSnapshotRepositoryV1,
  snapshot = reviewedFixture(),
) {
  await executeRoofRepositoryCommandV1(repository, calculateCommand(snapshot));
  return (await repository.readLatestSnapshot(snapshot.subject.caseId))!;
}

async function expectCommandError(
  operation: Promise<unknown>,
  code: RoofRepositoryCommandErrorV1["code"],
) {
  try {
    await operation;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(RoofRepositoryCommandErrorV1);
    expect((error as RoofRepositoryCommandErrorV1).code).toBe(code);
    return error as RoofRepositoryCommandErrorV1;
  }
}

function withInstrumentEvidence(snapshot: RoofSnapshotV1) {
  const {
    totals: _totals,
    quality: _quality,
    rendererPayload: _renderer,
    snapshotHash: _hash,
    ...seed
  } = structuredClone(snapshot);
  void _totals;
  void _quality;
  void _renderer;
  void _hash;
  const typedSeed: RoofSnapshotSeedV1 = seed;
  typedSeed.provenance.sources.push({
    sourceId: "src-instrument",
    kind: "instrument",
    provider: "Synthetic calibrated inclinometer",
    providerObjectId: "instrument-reading-001",
    inputSchemaVersion: "instrument-reading.v1",
    adapterVersion: "instrument-fixture-adapter.v1",
    capturedAt: "2026-09-01T09:50:00.000Z",
    retrievedAt: "2026-09-01T09:51:00.000Z",
    rawContentHash:
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    license: {
      status: "authorized",
      name: "Customer site measurement authorization",
      attribution: "On-site calibrated instrument fixture",
      termsVersion: "fixture-2026-09-01",
    },
    visibility: "internal",
    quality: {
      status: "usable",
      score: 0.99,
      reasons: ["Synthetic calibrated reading"],
    },
  });
  typedSeed.provenance.observations.push({
    observationId: "obs-instrument-south-pitch",
    kind: "surface_pitch",
    targetRef: "surface-south",
    value: { degrees: 30 },
    status: "accepted",
    sourceRefs: ["src-instrument"],
    confidence: {
      level: "high",
      score: 0.99,
      basis: "calibrated",
      rationale: "Synthetic calibrated inclinometer reading",
    },
    reasons: ["Accepted for deterministic promotion-policy fixture"],
  });
  typedSeed.provenance.fusionDecision.acceptedObservationIds.push(
    "obs-instrument-south-pitch",
  );
  return buildRoofSnapshotV1(typedSeed);
}

function withMeasurementClass(
  snapshot: RoofSnapshotV1,
  measurementClass: RoofSnapshotV1["measurement"]["class"],
) {
  const {
    totals: _totals,
    quality: _quality,
    rendererPayload: _renderer,
    snapshotHash: _hash,
    ...seed
  } = structuredClone(snapshot);
  void _totals;
  void _quality;
  void _renderer;
  void _hash;
  seed.measurement.class = measurementClass;
  return buildRoofSnapshotV1(seed);
}

describe("Roof Snapshot append-only repository contract v1", () => {
  it("applies and replays calculate/review/approve as immutable revisions", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    const calculate = calculateCommand();
    const calculated = await executeRoofRepositoryCommandV1(
      repository,
      calculate,
    );
    const replayed = await executeRoofRepositoryCommandV1(
      repository,
      calculate,
    );
    expect(calculated.status).toBe("applied");
    expect(Object.hasOwn(calculated, "previousSnapshot")).toBe(false);
    expect(Object.hasOwn(calculated.audit, "previousSnapshot")).toBe(false);
    expect(Object.hasOwn(calculated.audit, "reason")).toBe(false);
    expect(replayed).toMatchObject({
      status: "replayed",
      commandHash: calculated.commandHash,
      snapshot: calculated.snapshot,
    });

    const revision1 = (await repository.readLatestSnapshot("case-12"))!;
    const reviewed = await executeRoofRepositoryCommandV1(
      repository,
      reviewCommand(revision1),
    );
    const revision2 = (await repository.readLatestSnapshot("case-12"))!;
    expect(reviewed).toMatchObject({
      status: "applied",
      commandType: "review",
      previousSnapshot: { revision: 1 },
      snapshot: {
        revision: 2,
        measurementClass: "verified_geometry",
        state: "review_required",
      },
    });
    expect(revision2.supersedesSnapshotId).toBe(revision1.snapshotId);
    expect(revision2.auditTrail.at(-1)).toMatchObject({
      eventType: "review_completed",
      idempotencyKey: "roof-repository:case-12:review-r1",
    });

    const approved = await executeRoofRepositoryCommandV1(
      repository,
      approveCommand(revision2),
    );
    const revision3 = (await repository.readLatestSnapshot("case-12"))!;
    expect(approved).toMatchObject({
      commandType: "approve",
      previousSnapshot: { revision: 2 },
      snapshot: {
        revision: 3,
        state: "approved",
        measurementClass: "verified_geometry",
      },
    });
    expect(revision3.supersedesSnapshotId).toBe(revision2.snapshotId);
    expect(await repository.readSnapshot(revision1.snapshotId)).toEqual(
      revision1,
    );
    expect(await repository.readSnapshot(revision2.snapshotId)).toEqual(
      revision2,
    );
    const envelope = await readBoundApprovedRoofRendererV1(repository, {
      schemaVersion: "roof-renderer-read-binding.v1",
      caseId: "case-12",
      snapshotId: revision3.snapshotId,
      revision: revision3.revision,
      snapshotHash: revision3.snapshotHash,
      renderHash: revision3.rendererPayload.renderHash,
    });
    expect({
      schemaVersion: "roof-repository-golden-summary.v1",
      calculate: calculated,
      review: reviewed,
      approve: approved,
      latest: {
        snapshotId: revision3.snapshotId,
        revision: revision3.revision,
        snapshotHash: revision3.snapshotHash,
        renderHash: revision3.rendererPayload.renderHash,
        state: revision3.state,
        measurementClass: revision3.measurement.class,
        auditEventTypes: revision3.auditTrail.map((event) => event.eventType),
      },
      rendererBinding: {
        schemaVersion: envelope.schemaVersion,
        sourceSnapshotHash: envelope.sourceSnapshotHash,
        renderHash: envelope.payload.renderHash,
      },
    }).toEqual(repositoryGoldenSummary);
  });

  it("applies a correction as a new revision with command audit", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    const current = await appendInitial(repository);
    const result = await executeRoofRepositoryCommandV1(repository, {
      schemaVersion: "roof-repository-command.v1",
      commandType: "correct",
      caseId: current.subject.caseId,
      currentSnapshotId: current.snapshotId,
      expectedRevision: current.revision,
      correction: {
        schemaVersion: "roof-snapshot-correction-command.v1",
        correctionType: "edge_gutter_candidate",
        edgeId: "edge-north-eave",
        value: false,
        newSnapshotId: "roof-case-12-r2-corrected",
        expectedSnapshotHash: current.snapshotHash,
        idempotencyKey: "roof-repository:case-12:correct-r1",
        actor: {
          actorId: "admin-17",
          actorType: "administrator",
          displayName: "RF Reviewer",
        },
        correctedAt: "2026-09-01T10:04:00.000Z",
        reason: "Confirmed that the north eave has no installed gutter",
        sourceRefs: ["src-manual"],
      },
    });
    const corrected = (await repository.readLatestSnapshot("case-12"))!;

    expect(result).toMatchObject({
      commandType: "correct",
      previousSnapshot: { revision: 1 },
      snapshot: { revision: 2 },
      audit: {
        idempotencyKey: "roof-repository:case-12:correct-r1",
        sourceRefs: ["src-manual"],
      },
    });
    expect(
      corrected.geometry.edges.find((edge) => edge.edgeId === "edge-north-eave")
        ?.gutterCandidate,
    ).toBe(false);
  });

  it("returns exact stale-revision, stale-hash and idempotency errors", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    const current = await appendInitial(repository);

    const staleRevision = reviewCommand(current);
    staleRevision.expectedRevision = 99;
    const revisionError = await expectCommandError(
      executeRoofRepositoryCommandV1(repository, staleRevision),
      "EXPECTED_REVISION_MISMATCH",
    );
    expect(revisionError).toMatchObject({
      retryable: true,
      suggestedHttpStatus: 409,
    });

    const staleHash = reviewCommand(current);
    staleHash.expectedSnapshotHash =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    await expectCommandError(
      executeRoofRepositoryCommandV1(repository, staleHash),
      "STALE_SNAPSHOT_HASH",
    );

    const reused = calculateCommand();
    reused.actor.displayName = "Different logical command";
    await expectCommandError(
      executeRoofRepositoryCommandV1(repository, reused),
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("binds downstream rendering to one exact approved revision", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    const revision1 = await appendInitial(repository);
    await executeRoofRepositoryCommandV1(repository, reviewCommand(revision1));
    const revision2 = (await repository.readLatestSnapshot("case-12"))!;
    await executeRoofRepositoryCommandV1(repository, approveCommand(revision2));
    const revision3 = (await repository.readLatestSnapshot("case-12"))!;
    const binding = {
      schemaVersion: "roof-renderer-read-binding.v1" as const,
      caseId: "case-12",
      snapshotId: revision3.snapshotId,
      revision: revision3.revision,
      snapshotHash: revision3.snapshotHash,
      renderHash: revision3.rendererPayload.renderHash,
    };

    const envelope = await readBoundApprovedRoofRendererV1(repository, binding);
    expect(envelope).toMatchObject({
      sourceSnapshotHash: revision3.snapshotHash,
      payload: { renderHash: revision3.rendererPayload.renderHash },
    });

    await expectCommandError(
      readBoundApprovedRoofRendererV1(repository, {
        ...binding,
        revision: revision2.revision,
      }),
      "CROSS_REVISION_BINDING",
    );
    await expectCommandError(
      readBoundApprovedRoofRendererV1(repository, {
        ...binding,
        renderHash:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
      "RENDER_HASH_MISMATCH",
    );
  });

  it("enforces deterministic measurement-class promotion ownership", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    const current = await appendInitial(repository);
    const systemReview = reviewCommand(current);
    systemReview.actor = {
      actorId: "roof-fusion-engine",
      actorType: "system",
    };
    await expectCommandError(
      executeRoofRepositoryCommandV1(repository, systemReview),
      "ACTOR_NOT_ALLOWED",
    );

    const illicitRepository = new InMemoryRoofSnapshotRepositoryV1();
    const illicitCandidate = withMeasurementClass(
      reviewedFixture(),
      "verified_geometry",
    );
    await expectCommandError(
      executeRoofRepositoryCommandV1(
        illicitRepository,
        calculateCommand(illicitCandidate),
      ),
      "MEASUREMENT_PROMOTION_DENIED",
    );

    const instrumentWithoutEvidence = reviewCommand(current);
    instrumentWithoutEvidence.targetMeasurementClass =
      "instrument_site_verified";
    await expectCommandError(
      executeRoofRepositoryCommandV1(repository, instrumentWithoutEvidence),
      "INSTRUMENT_EVIDENCE_REQUIRED",
    );

    const instrumentRepository = new InMemoryRoofSnapshotRepositoryV1();
    const instrumentSnapshot = withInstrumentEvidence(reviewedFixture());
    const instrumentCurrent = await appendInitial(
      instrumentRepository,
      instrumentSnapshot,
    );
    const instrumentReview = reviewCommand(instrumentCurrent);
    instrumentReview.newSnapshotId = "roof-case-12-r2-instrument-verified";
    instrumentReview.targetMeasurementClass = "instrument_site_verified";
    instrumentReview.sourceRefs = ["src-instrument"];
    instrumentReview.idempotencyKey =
      "roof-repository:case-12:instrument-review-r1";
    const result = await executeRoofRepositoryCommandV1(
      instrumentRepository,
      instrumentReview,
    );
    expect(result.snapshot.measurementClass).toBe("instrument_site_verified");
  });

  it("publishes a complete stable error taxonomy", () => {
    expect(roofRepositoryErrorCodesV1).toEqual([
      "UNKNOWN_CONTRACT_VERSION",
      "INVALID_COMMAND",
      "INVALID_RENDERER_BINDING",
      "ACTOR_NOT_ALLOWED",
      "SNAPSHOT_NOT_FOUND",
      "CASE_MISMATCH",
      "EXPECTED_REVISION_MISMATCH",
      "STALE_SNAPSHOT_HASH",
      "CROSS_REVISION_BINDING",
      "RENDER_HASH_MISMATCH",
      "IDEMPOTENCY_CONFLICT",
      "SNAPSHOT_ID_CONFLICT",
      "INVALID_STATE",
      "QUALITY_BLOCKED",
      "MEASUREMENT_PROMOTION_DENIED",
      "INSTRUMENT_EVIDENCE_REQUIRED",
      "SOURCE_REFERENCE_MISSING",
      "REPOSITORY_INTEGRITY",
    ]);
  });

  it("maps unknown versions and malformed commands into the taxonomy", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    await expectCommandError(
      executeRoofRepositoryCommandV1(repository, {
        schemaVersion: "roof-repository-command.v2",
        commandType: "calculate",
      }),
      "UNKNOWN_CONTRACT_VERSION",
    );
    const invalid = await expectCommandError(
      executeRoofRepositoryCommandV1(repository, {
        schemaVersion: "roof-repository-command.v1",
        commandType: "calculate",
      }),
      "INVALID_COMMAND",
    );
    expect(invalid).toMatchObject({
      retryable: false,
      suggestedHttpStatus: 400,
    });
  });
});
