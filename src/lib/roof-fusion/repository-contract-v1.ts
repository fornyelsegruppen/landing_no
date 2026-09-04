import { z } from "zod";
import {
  canonicalSha256V1,
  canonicalizeJsonValueV1,
  compareCanonicalStringsV1,
} from "./canonicalization-v1";
import {
  approvedRoofRendererPayloadV1,
  applyRoofSnapshotCorrectionV1,
  approveRoofSnapshotV1,
  buildRoofSnapshotV1,
  parseRoofSnapshotV1,
  roofSnapshotApprovalCommandV1Schema,
  roofSnapshotCorrectionCommandV1Schema,
  roofSnapshotV1Schema,
  type RoofSnapshotSeedV1,
  type RoofSnapshotV1,
} from "./roof-snapshot-v1";

export const ROOF_REPOSITORY_CONTRACT_VERSION =
  "roof-snapshot-repository.v1" as const;
export const ROOF_REPOSITORY_COMMAND_VERSION =
  "roof-repository-command.v1" as const;
export const ROOF_REPOSITORY_RESULT_VERSION =
  "roof-repository-command-result.v1" as const;
export const ROOF_RENDERER_READ_BINDING_VERSION =
  "roof-renderer-read-binding.v1" as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const timestamp = z.string().datetime({ offset: true });
const idempotencyKey = z.string().trim().min(8).max(300);
const actorSchema = z
  .object({
    actorId: identifier,
    actorType: z.enum(["system", "administrator", "worker", "customer"]),
    displayName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const calculateCommandSchema = z
  .object({
    schemaVersion: z.literal(ROOF_REPOSITORY_COMMAND_VERSION),
    commandType: z.literal("calculate"),
    caseId: identifier,
    expectedLatestRevision: z.number().int().positive().nullable(),
    expectedLatestSnapshotHash: sha256.nullable(),
    candidateSnapshot: roofSnapshotV1Schema,
    idempotencyKey,
    actor: actorSchema,
    occurredAt: timestamp,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.expectedLatestRevision === null) !==
      (value.expectedLatestSnapshotHash === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Expected latest revision and hash must both be null or both be present",
      });
    }
  });

const reviewCommandSchema = z
  .object({
    schemaVersion: z.literal(ROOF_REPOSITORY_COMMAND_VERSION),
    commandType: z.literal("review"),
    caseId: identifier,
    currentSnapshotId: identifier,
    newSnapshotId: identifier,
    expectedRevision: z.number().int().positive(),
    expectedSnapshotHash: sha256,
    targetMeasurementClass: z.enum([
      "verified_geometry",
      "instrument_site_verified",
    ]),
    reason: z.string().trim().min(5).max(1_000),
    sourceRefs: z.array(identifier).min(1).max(100),
    idempotencyKey,
    actor: actorSchema,
    occurredAt: timestamp,
  })
  .strict();

const correctCommandSchema = z
  .object({
    schemaVersion: z.literal(ROOF_REPOSITORY_COMMAND_VERSION),
    commandType: z.literal("correct"),
    caseId: identifier,
    currentSnapshotId: identifier,
    expectedRevision: z.number().int().positive(),
    correction: roofSnapshotCorrectionCommandV1Schema,
  })
  .strict();

const approveCommandSchema = z
  .object({
    schemaVersion: z.literal(ROOF_REPOSITORY_COMMAND_VERSION),
    commandType: z.literal("approve"),
    caseId: identifier,
    currentSnapshotId: identifier,
    newSnapshotId: identifier,
    expectedRevision: z.number().int().positive(),
    approval: roofSnapshotApprovalCommandV1Schema,
  })
  .strict();

export const roofRepositoryCommandV1Schema = z.discriminatedUnion(
  "commandType",
  [
    calculateCommandSchema,
    reviewCommandSchema,
    correctCommandSchema,
    approveCommandSchema,
  ],
);

export type RoofRepositoryCommandV1 = z.infer<
  typeof roofRepositoryCommandV1Schema
>;
export type RoofRepositoryCommandTypeV1 =
  RoofRepositoryCommandV1["commandType"];

export const roofRepositoryErrorCodesV1 = [
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
] as const;
export type RoofRepositoryErrorCodeV1 =
  (typeof roofRepositoryErrorCodesV1)[number];

const errorProperties: Record<
  RoofRepositoryErrorCodeV1,
  { retryable: boolean; suggestedHttpStatus: number }
> = {
  UNKNOWN_CONTRACT_VERSION: { retryable: false, suggestedHttpStatus: 400 },
  INVALID_COMMAND: { retryable: false, suggestedHttpStatus: 400 },
  INVALID_RENDERER_BINDING: { retryable: false, suggestedHttpStatus: 400 },
  ACTOR_NOT_ALLOWED: { retryable: false, suggestedHttpStatus: 403 },
  SNAPSHOT_NOT_FOUND: { retryable: false, suggestedHttpStatus: 404 },
  CASE_MISMATCH: { retryable: false, suggestedHttpStatus: 403 },
  EXPECTED_REVISION_MISMATCH: { retryable: true, suggestedHttpStatus: 409 },
  STALE_SNAPSHOT_HASH: { retryable: true, suggestedHttpStatus: 409 },
  CROSS_REVISION_BINDING: { retryable: true, suggestedHttpStatus: 409 },
  RENDER_HASH_MISMATCH: { retryable: true, suggestedHttpStatus: 409 },
  IDEMPOTENCY_CONFLICT: { retryable: false, suggestedHttpStatus: 409 },
  SNAPSHOT_ID_CONFLICT: { retryable: false, suggestedHttpStatus: 409 },
  INVALID_STATE: { retryable: false, suggestedHttpStatus: 422 },
  QUALITY_BLOCKED: { retryable: false, suggestedHttpStatus: 422 },
  MEASUREMENT_PROMOTION_DENIED: {
    retryable: false,
    suggestedHttpStatus: 422,
  },
  INSTRUMENT_EVIDENCE_REQUIRED: {
    retryable: false,
    suggestedHttpStatus: 422,
  },
  SOURCE_REFERENCE_MISSING: { retryable: false, suggestedHttpStatus: 422 },
  REPOSITORY_INTEGRITY: { retryable: false, suggestedHttpStatus: 500 },
};

export class RoofRepositoryCommandErrorV1 extends Error {
  readonly schemaVersion = "roof-repository-command-error.v1" as const;
  readonly retryable: boolean;
  readonly suggestedHttpStatus: number;

  constructor(
    readonly code: RoofRepositoryErrorCodeV1,
    message: string,
    readonly entityRefs: string[] = [],
  ) {
    super(message);
    this.name = "RoofRepositoryCommandErrorV1";
    this.retryable = errorProperties[code].retryable;
    this.suggestedHttpStatus = errorProperties[code].suggestedHttpStatus;
  }
}

export type RoofSnapshotReferenceV1 = {
  snapshotId: string;
  revision: number;
  snapshotHash: string;
  state: RoofSnapshotV1["state"];
  measurementClass: RoofSnapshotV1["measurement"]["class"];
};

export type RoofRepositoryCommandAuditV1 = {
  schemaVersion: "roof-repository-command-audit.v1";
  commandType: RoofRepositoryCommandTypeV1;
  commandHash: string;
  idempotencyKey: string;
  caseId: string;
  actor: RoofSnapshotV1["auditTrail"][number]["actor"];
  occurredAt: string;
  reason?: string;
  sourceRefs: string[];
  previousSnapshot?: RoofSnapshotReferenceV1;
  resultingSnapshot: RoofSnapshotReferenceV1;
};

export type RoofRepositoryCommandResultV1 = {
  schemaVersion: typeof ROOF_REPOSITORY_RESULT_VERSION;
  repositoryContractVersion: typeof ROOF_REPOSITORY_CONTRACT_VERSION;
  status: "applied" | "replayed";
  commandType: RoofRepositoryCommandTypeV1;
  commandHash: string;
  idempotencyKey: string;
  caseId: string;
  previousSnapshot?: RoofSnapshotReferenceV1;
  snapshot: RoofSnapshotReferenceV1;
  audit: RoofRepositoryCommandAuditV1;
};

export type StoredRoofRepositoryCommandV1 = {
  commandHash: string;
  result: RoofRepositoryCommandResultV1;
};

export interface RoofSnapshotAppendOnlyRepositoryV1 {
  readonly contractVersion: typeof ROOF_REPOSITORY_CONTRACT_VERSION;
  readSnapshot(snapshotId: string): Promise<RoofSnapshotV1 | null>;
  readLatestSnapshot(caseId: string): Promise<RoofSnapshotV1 | null>;
  readCommand(
    caseId: string,
    idempotencyKey: string,
  ): Promise<StoredRoofRepositoryCommandV1 | null>;
  isSnapshotInvalidated(snapshot: RoofSnapshotV1): Promise<boolean>;
  appendAtomically(input: {
    expectedLatest: RoofSnapshotReferenceV1 | null;
    snapshot: RoofSnapshotV1;
    command: StoredRoofRepositoryCommandV1;
  }): Promise<void>;
}

function digest(domain: string, value: unknown) {
  return canonicalSha256V1(value, domain);
}

function clone<T>(value: T): T {
  return structuredClone(value);
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

function snapshotSeed(snapshot: RoofSnapshotV1): RoofSnapshotSeedV1 {
  const {
    totals: _totals,
    quality: _quality,
    rendererPayload: _rendererPayload,
    snapshotHash: _snapshotHash,
    ...seed
  } = snapshot;
  void _totals;
  void _quality;
  void _rendererPayload;
  void _snapshotHash;
  return seed;
}

function commandIdempotencyKey(command: RoofRepositoryCommandV1) {
  if (command.commandType === "correct")
    return command.correction.idempotencyKey;
  if (command.commandType === "approve") return command.approval.idempotencyKey;
  return command.idempotencyKey;
}

function commandActor(command: RoofRepositoryCommandV1) {
  if (command.commandType === "correct") return command.correction.actor;
  if (command.commandType === "approve") return command.approval.actor;
  return command.actor;
}

function commandOccurredAt(command: RoofRepositoryCommandV1) {
  if (command.commandType === "correct") return command.correction.correctedAt;
  if (command.commandType === "approve") return command.approval.approvedAt;
  return command.occurredAt;
}

function commandReason(command: RoofRepositoryCommandV1) {
  if (command.commandType === "correct") return command.correction.reason;
  if (command.commandType === "approve") return command.approval.reviewReason;
  if (command.commandType === "review") return command.reason;
  return undefined;
}

function commandSourceRefs(command: RoofRepositoryCommandV1) {
  if (command.commandType === "correct") return command.correction.sourceRefs;
  if (command.commandType === "review") return command.sourceRefs;
  return [];
}

function requireActor(
  actor: ReturnType<typeof commandActor>,
  expected: "system" | "administrator",
) {
  if (actor.actorType !== expected) {
    throw new RoofRepositoryCommandErrorV1(
      "ACTOR_NOT_ALLOWED",
      `${expected} actor is required for this Roof Fusion command`,
      [actor.actorId],
    );
  }
}

async function loadExpectedCurrent(
  repository: RoofSnapshotAppendOnlyRepositoryV1,
  input: {
    caseId: string;
    currentSnapshotId: string;
    expectedRevision: number;
    expectedSnapshotHash: string;
  },
) {
  const current = await repository.readSnapshot(input.currentSnapshotId);
  if (!current) {
    throw new RoofRepositoryCommandErrorV1(
      "SNAPSHOT_NOT_FOUND",
      "The requested roof snapshot does not exist",
      [input.currentSnapshotId],
    );
  }
  if (current.subject.caseId !== input.caseId) {
    throw new RoofRepositoryCommandErrorV1(
      "CASE_MISMATCH",
      "The roof snapshot belongs to a different case",
      [input.caseId, current.subject.caseId],
    );
  }
  if (current.revision !== input.expectedRevision) {
    throw new RoofRepositoryCommandErrorV1(
      "EXPECTED_REVISION_MISMATCH",
      "The roof snapshot revision changed",
      [current.snapshotId],
    );
  }
  if (current.snapshotHash !== input.expectedSnapshotHash) {
    throw new RoofRepositoryCommandErrorV1(
      "STALE_SNAPSHOT_HASH",
      "The roof snapshot changed after it was read",
      [current.snapshotId],
    );
  }
  const latest = await repository.readLatestSnapshot(input.caseId);
  if (
    !latest ||
    latest.snapshotId !== current.snapshotId ||
    latest.snapshotHash !== current.snapshotHash
  ) {
    throw new RoofRepositoryCommandErrorV1(
      "CROSS_REVISION_BINDING",
      "The command is bound to a snapshot that is no longer the latest revision",
      [current.snapshotId, ...(latest ? [latest.snapshotId] : [])],
    );
  }
  return current;
}

function reviewSnapshot(
  snapshot: RoofSnapshotV1,
  command: z.infer<typeof reviewCommandSchema>,
) {
  requireActor(command.actor, "administrator");
  if (snapshot.state === "approved" || snapshot.state === "superseded") {
    throw new RoofRepositoryCommandErrorV1(
      "INVALID_STATE",
      "A final roof snapshot cannot be promoted",
      [snapshot.snapshotId],
    );
  }
  if (snapshot.quality.status !== "pass") {
    throw new RoofRepositoryCommandErrorV1(
      "QUALITY_BLOCKED",
      "Measurement-class promotion requires all snapshot quality gates to pass",
      [snapshot.snapshotId],
    );
  }
  const sourceIds = new Set(
    snapshot.provenance.sources.map((source) => source.sourceId),
  );
  const missingSourceRefs = command.sourceRefs.filter(
    (sourceRef) => !sourceIds.has(sourceRef),
  );
  if (missingSourceRefs.length) {
    throw new RoofRepositoryCommandErrorV1(
      "SOURCE_REFERENCE_MISSING",
      "Review references evidence sources outside the snapshot",
      missingSourceRefs,
    );
  }
  const classRank = {
    preliminary: 0,
    fused_estimate: 1,
    verified_geometry: 2,
    instrument_site_verified: 3,
  } as const;
  if (
    classRank[command.targetMeasurementClass] <=
    classRank[snapshot.measurement.class]
  ) {
    throw new RoofRepositoryCommandErrorV1(
      "MEASUREMENT_PROMOTION_DENIED",
      "Review must promote to a strictly stronger measurement class",
      [snapshot.snapshotId],
    );
  }
  if (command.targetMeasurementClass === "instrument_site_verified") {
    const authorizedInstrumentSources = new Set(
      snapshot.provenance.sources
        .filter(
          (source) =>
            source.kind === "instrument" &&
            source.license.status === "authorized" &&
            source.quality.status === "usable",
        )
        .map((source) => source.sourceId),
    );
    const acceptedObservationIds = new Set(
      snapshot.provenance.fusionDecision.acceptedObservationIds,
    );
    const hasAcceptedInstrumentEvidence =
      snapshot.provenance.observations.some(
        (observation) =>
          observation.status === "accepted" &&
          acceptedObservationIds.has(observation.observationId) &&
          observation.sourceRefs.some((sourceRef) =>
            authorizedInstrumentSources.has(sourceRef),
          ),
      ) &&
      command.sourceRefs.some((sourceRef) =>
        authorizedInstrumentSources.has(sourceRef),
      );
    if (!hasAcceptedInstrumentEvidence) {
      throw new RoofRepositoryCommandErrorV1(
        "INSTRUMENT_EVIDENCE_REQUIRED",
        "Instrument-site verification requires accepted authorized instrument evidence",
        [snapshot.snapshotId],
      );
    }
  }
  const seed = snapshotSeed(snapshot);
  seed.snapshotId = command.newSnapshotId;
  seed.revision = snapshot.revision + 1;
  seed.supersedesSnapshotId = snapshot.snapshotId;
  seed.generatedAt = command.occurredAt;
  seed.state = "review_required";
  seed.measurement.class = command.targetMeasurementClass;
  seed.approval = { status: "pending" };
  seed.auditTrail.push({
    sequence: Math.max(...seed.auditTrail.map((event) => event.sequence)) + 1,
    eventType: "review_completed",
    occurredAt: command.occurredAt,
    actor: command.actor,
    idempotencyKey: command.idempotencyKey,
    details: {
      previousSnapshotHash: snapshot.snapshotHash,
      previousMeasurementClass: snapshot.measurement.class,
      targetMeasurementClass: command.targetMeasurementClass,
      reason: command.reason,
      sourceRefs: command.sourceRefs,
    },
  });
  return buildRoofSnapshotV1(seed);
}

function approveSnapshotAsRevision(
  snapshot: RoofSnapshotV1,
  command: z.infer<typeof approveCommandSchema>,
) {
  requireActor(command.approval.actor, "administrator");
  let approved: RoofSnapshotV1;
  try {
    approved = approveRoofSnapshotV1(snapshot, command.approval);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = /quality gates failed/u.test(message)
      ? "QUALITY_BLOCKED"
      : /changed after review/u.test(message)
        ? "STALE_SNAPSHOT_HASH"
        : "INVALID_STATE";
    throw new RoofRepositoryCommandErrorV1(code, message, [
      snapshot.snapshotId,
    ]);
  }
  const seed = snapshotSeed(approved);
  seed.snapshotId = command.newSnapshotId;
  seed.revision = snapshot.revision + 1;
  seed.supersedesSnapshotId = snapshot.snapshotId;
  seed.generatedAt = command.approval.approvedAt;
  return buildRoofSnapshotV1(seed);
}

function commandHash(command: RoofRepositoryCommandV1) {
  return digest("takfornyelse:roof-repository-command:v1", command);
}

function commandContext(command: RoofRepositoryCommandV1) {
  if (command.commandType === "correct") {
    return {
      caseId: command.caseId,
      currentSnapshotId: command.currentSnapshotId,
      expectedRevision: command.expectedRevision,
      expectedSnapshotHash: command.correction.expectedSnapshotHash,
    };
  }
  if (command.commandType === "approve") {
    return {
      caseId: command.caseId,
      currentSnapshotId: command.currentSnapshotId,
      expectedRevision: command.expectedRevision,
      expectedSnapshotHash: command.approval.expectedSnapshotHash,
    };
  }
  if (command.commandType === "review") {
    return {
      caseId: command.caseId,
      currentSnapshotId: command.currentSnapshotId,
      expectedRevision: command.expectedRevision,
      expectedSnapshotHash: command.expectedSnapshotHash,
    };
  }
  return null;
}

function buildResult(
  command: RoofRepositoryCommandV1,
  hash: string,
  snapshot: RoofSnapshotV1,
  previousSnapshot: RoofSnapshotV1 | null,
  status: "applied" | "replayed",
): RoofRepositoryCommandResultV1 {
  const previous = previousSnapshot
    ? snapshotReference(previousSnapshot)
    : undefined;
  const resulting = snapshotReference(snapshot);
  const reason = commandReason(command);
  const audit: RoofRepositoryCommandAuditV1 = {
    schemaVersion: "roof-repository-command-audit.v1",
    commandType: command.commandType,
    commandHash: hash,
    idempotencyKey: commandIdempotencyKey(command),
    caseId: command.caseId,
    actor: commandActor(command),
    occurredAt: commandOccurredAt(command),
    ...(reason ? { reason } : {}),
    sourceRefs: [...commandSourceRefs(command)].sort(compareCanonicalStringsV1),
    ...(previous ? { previousSnapshot: previous } : {}),
    resultingSnapshot: resulting,
  };
  return {
    schemaVersion: ROOF_REPOSITORY_RESULT_VERSION,
    repositoryContractVersion: ROOF_REPOSITORY_CONTRACT_VERSION,
    status,
    commandType: command.commandType,
    commandHash: hash,
    idempotencyKey: commandIdempotencyKey(command),
    caseId: command.caseId,
    ...(previous ? { previousSnapshot: previous } : {}),
    snapshot: resulting,
    audit,
  };
}

export async function executeRoofRepositoryCommandV1(
  repository: RoofSnapshotAppendOnlyRepositoryV1,
  commandInput: unknown,
): Promise<RoofRepositoryCommandResultV1> {
  const version =
    commandInput && typeof commandInput === "object"
      ? (commandInput as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (version !== ROOF_REPOSITORY_COMMAND_VERSION) {
    throw new RoofRepositoryCommandErrorV1(
      "UNKNOWN_CONTRACT_VERSION",
      `Unsupported roof repository command version: ${String(version)}`,
    );
  }
  let command: RoofRepositoryCommandV1;
  try {
    command = roofRepositoryCommandV1Schema.parse(
      canonicalizeJsonValueV1(commandInput),
    );
  } catch (error) {
    throw new RoofRepositoryCommandErrorV1(
      "INVALID_COMMAND",
      error instanceof Error ? error.message : "Invalid Roof Fusion command",
    );
  }
  const hash = commandHash(command);
  const key = commandIdempotencyKey(command);
  const existing = await repository.readCommand(command.caseId, key);
  if (existing) {
    if (existing.commandHash !== hash) {
      throw new RoofRepositoryCommandErrorV1(
        "IDEMPOTENCY_CONFLICT",
        "The idempotency key was already used for a different command",
        [key],
      );
    }
    return { ...clone(existing.result), status: "replayed" };
  }

  let previous: RoofSnapshotV1 | null = null;
  let next: RoofSnapshotV1;
  if (command.commandType === "calculate") {
    requireActor(command.actor, "system");
    const candidate = parseRoofSnapshotV1(command.candidateSnapshot);
    if (candidate.subject.caseId !== command.caseId) {
      throw new RoofRepositoryCommandErrorV1(
        "CASE_MISMATCH",
        "Calculated snapshot belongs to a different case",
        [command.caseId, candidate.subject.caseId],
      );
    }
    if (
      !["preliminary", "fused_estimate"].includes(candidate.measurement.class)
    ) {
      throw new RoofRepositoryCommandErrorV1(
        "MEASUREMENT_PROMOTION_DENIED",
        "Calculate may append only preliminary or fused-estimate snapshots",
        [candidate.snapshotId],
      );
    }
    previous = await repository.readLatestSnapshot(command.caseId);
    if (!previous) {
      if (
        command.expectedLatestRevision !== null ||
        command.expectedLatestSnapshotHash !== null ||
        candidate.revision !== 1 ||
        candidate.supersedesSnapshotId
      ) {
        throw new RoofRepositoryCommandErrorV1(
          "EXPECTED_REVISION_MISMATCH",
          "Initial calculation must create revision 1 without a predecessor",
          [candidate.snapshotId],
        );
      }
    } else {
      if (command.expectedLatestRevision !== previous.revision) {
        throw new RoofRepositoryCommandErrorV1(
          "EXPECTED_REVISION_MISMATCH",
          "Latest roof snapshot revision changed before calculation append",
          [previous.snapshotId],
        );
      }
      if (command.expectedLatestSnapshotHash !== previous.snapshotHash) {
        throw new RoofRepositoryCommandErrorV1(
          "STALE_SNAPSHOT_HASH",
          "Latest roof snapshot hash changed before calculation append",
          [previous.snapshotId],
        );
      }
      if (
        candidate.revision !== previous.revision + 1 ||
        candidate.supersedesSnapshotId !== previous.snapshotId
      ) {
        throw new RoofRepositoryCommandErrorV1(
          "CROSS_REVISION_BINDING",
          "Calculated snapshot lineage does not bind to the latest revision",
          [previous.snapshotId, candidate.snapshotId],
        );
      }
    }
    next = candidate;
  } else {
    const context = commandContext(command)!;
    previous = await loadExpectedCurrent(repository, context);
    if (command.commandType === "review") {
      next = reviewSnapshot(previous, command);
    } else if (command.commandType === "correct") {
      requireActor(command.correction.actor, "administrator");
      try {
        next = applyRoofSnapshotCorrectionV1(previous, command.correction);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code = /changed before correction/u.test(message)
          ? "STALE_SNAPSHOT_HASH"
          : /unknown source/u.test(message)
            ? "SOURCE_REFERENCE_MISSING"
            : "INVALID_STATE";
        throw new RoofRepositoryCommandErrorV1(code, message, [
          previous.snapshotId,
        ]);
      }
    } else {
      next = approveSnapshotAsRevision(previous, command);
    }
  }
  if (next.subject.caseId !== command.caseId) {
    throw new RoofRepositoryCommandErrorV1(
      "CASE_MISMATCH",
      "Resulting roof snapshot belongs to a different case",
      [next.subject.caseId, command.caseId],
    );
  }
  const result = buildResult(command, hash, next, previous, "applied");
  const stored: StoredRoofRepositoryCommandV1 = {
    commandHash: hash,
    result,
  };
  await repository.appendAtomically({
    expectedLatest: previous ? snapshotReference(previous) : null,
    snapshot: next,
    command: stored,
  });
  return result;
}

export const roofRendererReadBindingV1Schema = z
  .object({
    schemaVersion: z.literal(ROOF_RENDERER_READ_BINDING_VERSION),
    caseId: identifier,
    snapshotId: identifier,
    revision: z.number().int().positive(),
    snapshotHash: sha256,
    renderHash: sha256,
  })
  .strict();
export type RoofRendererReadBindingV1 = z.infer<
  typeof roofRendererReadBindingV1Schema
>;

export async function readBoundApprovedRoofRendererV1(
  repository: RoofSnapshotAppendOnlyRepositoryV1,
  bindingInput: RoofRendererReadBindingV1,
) {
  const version =
    bindingInput && typeof bindingInput === "object"
      ? (bindingInput as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (version !== ROOF_RENDERER_READ_BINDING_VERSION) {
    throw new RoofRepositoryCommandErrorV1(
      "UNKNOWN_CONTRACT_VERSION",
      `Unsupported roof renderer binding version: ${String(version)}`,
    );
  }
  let binding: RoofRendererReadBindingV1;
  try {
    binding = roofRendererReadBindingV1Schema.parse(
      canonicalizeJsonValueV1(bindingInput),
    );
  } catch (error) {
    throw new RoofRepositoryCommandErrorV1(
      "INVALID_RENDERER_BINDING",
      error instanceof Error ? error.message : "Invalid renderer binding",
    );
  }
  const snapshot = await repository.readSnapshot(binding.snapshotId);
  if (!snapshot) {
    throw new RoofRepositoryCommandErrorV1(
      "SNAPSHOT_NOT_FOUND",
      "The renderer-bound roof snapshot does not exist",
      [binding.snapshotId],
    );
  }
  if (await repository.isSnapshotInvalidated(snapshot)) {
    throw new RoofRepositoryCommandErrorV1(
      "INVALID_STATE",
      "Roof Fusion source was invalidated by a case address correction",
      [snapshot.snapshotId],
    );
  }
  if (snapshot.subject.caseId !== binding.caseId) {
    throw new RoofRepositoryCommandErrorV1(
      "CASE_MISMATCH",
      "The renderer binding belongs to a different case",
      [binding.caseId, snapshot.subject.caseId],
    );
  }
  if (snapshot.revision !== binding.revision) {
    throw new RoofRepositoryCommandErrorV1(
      "CROSS_REVISION_BINDING",
      "The renderer binding mixes roof snapshot revisions",
      [binding.snapshotId],
    );
  }
  if (snapshot.snapshotHash !== binding.snapshotHash) {
    throw new RoofRepositoryCommandErrorV1(
      "STALE_SNAPSHOT_HASH",
      "The renderer binding snapshot hash does not match its revision",
      [binding.snapshotId],
    );
  }
  let envelope: ReturnType<typeof approvedRoofRendererPayloadV1>;
  try {
    envelope = approvedRoofRendererPayloadV1(snapshot, binding.snapshotHash);
  } catch (error) {
    throw new RoofRepositoryCommandErrorV1(
      "INVALID_STATE",
      error instanceof Error
        ? error.message
        : "Roof snapshot is not approved for downstream rendering",
      [binding.snapshotId],
    );
  }
  if (envelope.payload.renderHash !== binding.renderHash) {
    throw new RoofRepositoryCommandErrorV1(
      "RENDER_HASH_MISMATCH",
      "The renderer payload hash does not match the bound document revision",
      [binding.snapshotId],
    );
  }
  return envelope;
}

export class InMemoryRoofSnapshotRepositoryV1 implements RoofSnapshotAppendOnlyRepositoryV1 {
  readonly contractVersion = ROOF_REPOSITORY_CONTRACT_VERSION;
  private readonly snapshots = new Map<string, RoofSnapshotV1>();
  private readonly caseSnapshotIds = new Map<string, string[]>();
  private readonly commands = new Map<string, StoredRoofRepositoryCommandV1>();

  async readSnapshot(snapshotId: string) {
    const snapshot = this.snapshots.get(snapshotId);
    return snapshot ? clone(snapshot) : null;
  }

  async readLatestSnapshot(caseId: string) {
    const ids = this.caseSnapshotIds.get(caseId) ?? [];
    const snapshot = ids.length ? this.snapshots.get(ids.at(-1)!) : undefined;
    return snapshot ? clone(snapshot) : null;
  }

  async isSnapshotInvalidated() {
    return false;
  }

  async readCommand(caseId: string, key: string) {
    const command = this.commands.get(`${caseId}:${key}`);
    return command ? clone(command) : null;
  }

  async appendAtomically(input: {
    expectedLatest: RoofSnapshotReferenceV1 | null;
    snapshot: RoofSnapshotV1;
    command: StoredRoofRepositoryCommandV1;
  }) {
    const snapshot = parseRoofSnapshotV1(input.snapshot);
    const caseId = snapshot.subject.caseId;
    const latest = await this.readLatestSnapshot(caseId);
    if (
      (latest === null) !== (input.expectedLatest === null) ||
      (latest &&
        input.expectedLatest &&
        (latest.snapshotId !== input.expectedLatest.snapshotId ||
          latest.revision !== input.expectedLatest.revision ||
          latest.snapshotHash !== input.expectedLatest.snapshotHash))
    ) {
      throw new RoofRepositoryCommandErrorV1(
        "REPOSITORY_INTEGRITY",
        "Atomic append compare-and-set failed",
        [caseId],
      );
    }
    if (
      (!latest && (snapshot.revision !== 1 || snapshot.supersedesSnapshotId)) ||
      (latest &&
        (snapshot.revision !== latest.revision + 1 ||
          snapshot.supersedesSnapshotId !== latest.snapshotId))
    ) {
      throw new RoofRepositoryCommandErrorV1(
        "REPOSITORY_INTEGRITY",
        "Atomic append snapshot lineage is not consecutive",
        [snapshot.snapshotId],
      );
    }
    const resultReference = input.command.result.snapshot;
    if (
      input.command.result.caseId !== caseId ||
      resultReference.snapshotId !== snapshot.snapshotId ||
      resultReference.revision !== snapshot.revision ||
      resultReference.snapshotHash !== snapshot.snapshotHash
    ) {
      throw new RoofRepositoryCommandErrorV1(
        "REPOSITORY_INTEGRITY",
        "Atomic append command result does not reference its snapshot",
        [snapshot.snapshotId],
      );
    }
    if (this.snapshots.has(snapshot.snapshotId)) {
      throw new RoofRepositoryCommandErrorV1(
        "SNAPSHOT_ID_CONFLICT",
        "Append-only repository already contains the snapshot ID",
        [snapshot.snapshotId],
      );
    }
    const commandKey = `${caseId}:${input.command.result.idempotencyKey}`;
    if (this.commands.has(commandKey)) {
      throw new RoofRepositoryCommandErrorV1(
        "IDEMPOTENCY_CONFLICT",
        "Append-only repository already contains the command key",
        [input.command.result.idempotencyKey],
      );
    }
    this.snapshots.set(snapshot.snapshotId, clone(snapshot));
    this.caseSnapshotIds.set(caseId, [
      ...(this.caseSnapshotIds.get(caseId) ?? []),
      snapshot.snapshotId,
    ]);
    this.commands.set(commandKey, clone(input.command));
  }
}
