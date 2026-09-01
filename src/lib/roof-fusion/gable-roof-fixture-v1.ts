import normalizedFixture from "./__fixtures__/gable-roof-normalized-v1.json";
import {
  approvedRoofRendererPayloadV1,
  approveRoofSnapshotV1,
} from "./roof-snapshot-v1";
import {
  buildRoofSourceRequestV1,
  buildRoofSourceResultV1,
  roofSourceResultToSnapshotV1,
  type RoofSourceResultV1,
} from "./source-adapter-v1";
import { renderApprovedRoofSnapshotSvgV1 } from "./svg-renderer-v1";

export function buildApprovedGableRoofFixtureV1() {
  const normalized = normalizedFixture as unknown as NonNullable<
    RoofSourceResultV1["normalized"]
  >;
  const request = buildRoofSourceRequestV1({
    schemaVersion: "roof-source-request.v1",
    requestId: "request-gable-svg-001",
    caseId: "case-12",
    targetSnapshotId: "roof-case-12-r1",
    expectedInputVersion: "fake-provider-roof.v1",
    adapterId: "fake-roof-adapter",
    idempotencyKey: "roof-source:case-12:svg-fixture",
    requestedAt: "2026-09-01T08:00:00.000Z",
    input: { providerObjectId: "fixture-gable-001" },
  });
  const sourceResult = buildRoofSourceResultV1({
    schemaVersion: "roof-source-result.v1",
    status: "complete",
    adapterId: "fake-roof-adapter",
    adapterVersion: "fake-roof-adapter.v1",
    provider: "fake-roof-provider",
    providerInputVersion: "fake-provider-roof.v1",
    providerRequestId: "fixture-gable-001",
    requestInputHash: request.inputHash,
    idempotencyKey: request.idempotencyKey,
    receivedAt: "2026-09-01T08:00:30.000Z",
    rawContentHash:
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    sourceRecords: normalized.provenance.sources,
    issues: [],
    normalized,
  });
  const reviewedSnapshot = roofSourceResultToSnapshotV1(request, sourceResult, {
    snapshotId: request.targetSnapshotId,
    revision: 1,
    caseId: request.caseId,
    propertyId: "property-12",
    inputVersion: request.expectedInputVersion,
    engineVersion: "roof-fusion-engine.v1.0.0",
    rendererVersion: "roof-renderer.v1.0.0",
    generatedAt: "2026-09-01T08:01:00.000Z",
    normalizedBy: {
      actorId: "roof-fusion-engine",
      actorType: "system",
    },
  });
  const approvedSnapshot = approveRoofSnapshotV1(reviewedSnapshot, {
    schemaVersion: "roof-snapshot-approval-command.v1",
    expectedSnapshotHash: reviewedSnapshot.snapshotHash,
    idempotencyKey: "roof-approval:case-12:svg-r1",
    actor: {
      actorId: "admin-17",
      actorType: "administrator",
      displayName: "RF Reviewer",
    },
    approvedAt: "2026-09-01T08:05:00.000Z",
  });
  const rendererEnvelope = approvedRoofRendererPayloadV1(
    approvedSnapshot,
    approvedSnapshot.snapshotHash,
  );
  const svgArtifact = renderApprovedRoofSnapshotSvgV1(rendererEnvelope);
  return {
    request,
    sourceResult,
    reviewedSnapshot,
    approvedSnapshot,
    rendererEnvelope,
    svgArtifact,
  };
}
