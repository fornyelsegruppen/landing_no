import type { Environment } from "@/lib/platform/features";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import { assertRoofFusionPreviewEnabledV1 } from "./preview-read-adapters-v1";
import {
  executeRoofRepositoryCommandV1,
  InMemoryRoofSnapshotRepositoryV1,
  type RoofRepositoryCommandV1,
  type RoofSnapshotAppendOnlyRepositoryV1,
  type RoofSnapshotReferenceV1,
} from "./repository-contract-v1";
import {
  buildRoofSnapshotV1,
  type RoofSnapshotSeedV1,
  type RoofSnapshotV1,
} from "./roof-snapshot-v1";

export const ROOF_FUSION_PREVIEW_UAT_GOLDEN_VERSION =
  "roof-fusion-preview-uat-golden.v1" as const;

const generatedAt = "2026-09-01T12:00:00.000Z";
const reviewedAt = "2026-09-01T12:01:00.000Z";
const approvedAt = "2026-09-01T12:02:00.000Z";
const harnessActor = {
  actorId: "roof-fusion-preview-uat",
  actorType: "administrator" as const,
  displayName: "Roof Fusion Preview UAT Harness",
};

export class RoofFusionPreviewUatConflictErrorV1 extends Error {
  readonly code = "CASE_ALREADY_HAS_CANONICAL_SNAPSHOT" as const;

  constructor(readonly caseId: string) {
    super("The case already has a different canonical Roof Fusion snapshot");
    this.name = "RoofFusionPreviewUatConflictErrorV1";
  }
}

function snapshotReference(snapshot: RoofSnapshotV1): RoofSnapshotReferenceV1 {
  return {
    snapshotId: snapshot.snapshotId,
    revision: snapshot.revision,
    snapshotHash: snapshot.snapshotHash,
    state: snapshot.state,
    measurementClass: snapshot.measurement.class,
  };
}

function baseSnapshot(leadId: number) {
  const source = buildApprovedGableRoofFixtureV1().reviewedSnapshot;
  const {
    totals: _totals,
    quality: _quality,
    rendererPayload: _rendererPayload,
    snapshotHash: _snapshotHash,
    ...seedInput
  } = structuredClone(source);
  void _totals;
  void _quality;
  void _rendererPayload;
  void _snapshotHash;
  const seed: RoofSnapshotSeedV1 = seedInput;
  const caseId = `lead:${leadId}`;
  seed.snapshotId = `rf-uat-lead-${leadId}-r1-fused`;
  seed.revision = 1;
  delete seed.supersedesSnapshotId;
  seed.subject.caseId = caseId;
  seed.subject.propertyId = `lead:${leadId}:property`;
  seed.generatedAt = generatedAt;
  seed.auditTrail = seed.auditTrail.map((event, index) => ({
    ...event,
    sequence: index + 1,
    idempotencyKey: `roof-uat:lead-${leadId}:normalize-r1`,
  }));
  return buildRoofSnapshotV1(seed);
}

export async function buildRoofFusionPreviewUatGoldenPlanV1(leadId: number) {
  if (!Number.isSafeInteger(leadId) || leadId < 1) {
    throw new Error("Preview UAT lead ID must be a positive safe integer");
  }
  const repository = new InMemoryRoofSnapshotRepositoryV1();
  const initial = baseSnapshot(leadId);
  const caseId = initial.subject.caseId;
  const calculate: Extract<
    RoofRepositoryCommandV1,
    { commandType: "calculate" }
  > = {
    schemaVersion: "roof-repository-command.v1",
    commandType: "calculate",
    caseId,
    expectedLatestRevision: null,
    expectedLatestSnapshotHash: null,
    candidateSnapshot: initial,
    idempotencyKey: `roof-uat:lead-${leadId}:calculate-r1`,
    actor: {
      actorId: "roof-fusion-preview-uat-engine",
      actorType: "system",
      displayName: "Roof Fusion Preview UAT Engine",
    },
    occurredAt: generatedAt,
  };
  await executeRoofRepositoryCommandV1(repository, calculate);
  const revision1 = (await repository.readLatestSnapshot(caseId))!;
  const review: Extract<RoofRepositoryCommandV1, { commandType: "review" }> = {
    schemaVersion: "roof-repository-command.v1",
    commandType: "review",
    caseId,
    currentSnapshotId: revision1.snapshotId,
    newSnapshotId: `rf-uat-lead-${leadId}-r2-verified`,
    expectedRevision: revision1.revision,
    expectedSnapshotHash: revision1.snapshotHash,
    targetMeasurementClass: "verified_geometry",
    reason: "Deterministic Preview UAT golden geometry review",
    sourceRefs: revision1.provenance.sources.map(({ sourceId }) => sourceId),
    idempotencyKey: `roof-uat:lead-${leadId}:review-r1`,
    actor: harnessActor,
    occurredAt: reviewedAt,
  };
  await executeRoofRepositoryCommandV1(repository, review);
  const revision2 = (await repository.readLatestSnapshot(caseId))!;
  const approve: Extract<RoofRepositoryCommandV1, { commandType: "approve" }> =
    {
      schemaVersion: "roof-repository-command.v1",
      commandType: "approve",
      caseId,
      currentSnapshotId: revision2.snapshotId,
      newSnapshotId: `rf-uat-lead-${leadId}-r3-approved`,
      expectedRevision: revision2.revision,
      approval: {
        schemaVersion: "roof-snapshot-approval-command.v1",
        expectedSnapshotHash: revision2.snapshotHash,
        idempotencyKey: `roof-uat:lead-${leadId}:approve-r2`,
        actor: harnessActor,
        approvedAt,
      },
    };
  await executeRoofRepositoryCommandV1(repository, approve);
  const finalSnapshot = (await repository.readLatestSnapshot(caseId))!;
  return {
    schemaVersion: ROOF_FUSION_PREVIEW_UAT_GOLDEN_VERSION,
    caseId,
    commands: [calculate, review, approve] as const,
    snapshots: [revision1, revision2, finalSnapshot] as const,
    finalSnapshot,
  } as const;
}

function isExpectedFinalSnapshot(
  actual: RoofSnapshotV1 | null,
  expected: RoofSnapshotV1,
) {
  return Boolean(
    actual &&
    actual.snapshotId === expected.snapshotId &&
    actual.revision === expected.revision &&
    actual.snapshotHash === expected.snapshotHash &&
    actual.state === "approved",
  );
}

function isExpectedLifecycleSnapshot(
  actual: RoofSnapshotV1,
  expected: RoofSnapshotV1,
) {
  return (
    actual.snapshotId === expected.snapshotId &&
    actual.revision === expected.revision &&
    actual.snapshotHash === expected.snapshotHash &&
    actual.state === expected.state
  );
}

export async function prepareRoofFusionPreviewUatGoldenV1(input: {
  repository: RoofSnapshotAppendOnlyRepositoryV1;
  leadId: number;
  environment?: Environment;
}) {
  assertRoofFusionPreviewEnabledV1(input.environment);
  const plan = await buildRoofFusionPreviewUatGoldenPlanV1(input.leadId);
  const existing = await input.repository.readLatestSnapshot(plan.caseId);
  if (isExpectedFinalSnapshot(existing, plan.finalSnapshot)) {
    return {
      schemaVersion: ROOF_FUSION_PREVIEW_UAT_GOLDEN_VERSION,
      status: "already_prepared",
      snapshot: snapshotReference(existing!),
    } as const;
  }
  if (
    existing &&
    !plan.snapshots.some((expected) =>
      isExpectedLifecycleSnapshot(existing, expected),
    )
  ) {
    throw new RoofFusionPreviewUatConflictErrorV1(plan.caseId);
  }

  try {
    for (const command of plan.commands) {
      await executeRoofRepositoryCommandV1(input.repository, command);
    }
  } catch (error) {
    const concurrent = await input.repository.readLatestSnapshot(plan.caseId);
    if (isExpectedFinalSnapshot(concurrent, plan.finalSnapshot)) {
      return {
        schemaVersion: ROOF_FUSION_PREVIEW_UAT_GOLDEN_VERSION,
        status: "already_prepared",
        snapshot: snapshotReference(concurrent!),
      } as const;
    }
    throw error;
  }

  const prepared = await input.repository.readLatestSnapshot(plan.caseId);
  if (!isExpectedFinalSnapshot(prepared, plan.finalSnapshot)) {
    throw new Error(
      "Preview UAT golden preparation did not reach its final snapshot",
    );
  }
  return {
    schemaVersion: ROOF_FUSION_PREVIEW_UAT_GOLDEN_VERSION,
    status: "prepared",
    snapshot: snapshotReference(prepared!),
  } as const;
}
