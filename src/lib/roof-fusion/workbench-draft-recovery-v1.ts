import { z } from "zod";
import {
  RF_DRAFT_RECOVERY_CONTRACT_VERSION,
  rfDraftRecoveryBindingSchema,
  type RfDraftRecoveryBinding,
  type RfDraftRecoveryCurrentContext,
} from "@/lib/admin-next/rf-draft-recovery-contract";
import {
  parseRoofFusionWorkbenchDraftV1,
  type RoofFusionWorkbenchDraftV1,
} from "./workbench-draft-contract-v1";

export const WORKBENCH_DRAFT_RECOVERY_RECORD_VERSION =
  "roof-fusion-workbench-draft-recovery-record.v1" as const;

const storedRecordSchema = z
  .object({
    schemaVersion: z.literal(WORKBENCH_DRAFT_RECOVERY_RECORD_VERSION),
    draft: z.unknown(),
    recoveryBinding: rfDraftRecoveryBindingSchema,
  })
  .strict();

export type RoofFusionWorkbenchDraftRecoveryRecordV1 = Readonly<{
  draft: RoofFusionWorkbenchDraftV1;
  recoveryBinding: RfDraftRecoveryBinding | null;
}>;

function draftReference(draft: RoofFusionWorkbenchDraftV1) {
  return {
    id: draft.draftId,
    revision: draft.revision,
    hash: draft.draftHash,
  } as const;
}

function geometrySnapshotReference(draft: RoofFusionWorkbenchDraftV1) {
  return {
    id: draft.draftId,
    revision: draft.revision,
    hash: draft.geometryHash,
  } as const;
}

function assertBindingMatchesDraft(
  draft: RoofFusionWorkbenchDraftV1,
  binding: RfDraftRecoveryBinding,
) {
  const expectedDraft = draftReference(draft);
  const expectedSnapshot = geometrySnapshotReference(draft);
  if (
    binding.case.caseId !== draft.caseId ||
    binding.draft.id !== expectedDraft.id ||
    binding.draft.revision !== expectedDraft.revision ||
    binding.draft.hash !== expectedDraft.hash ||
    binding.source.id !== draft.source.sourceId ||
    binding.source.hash !== draft.source.sourceContentHash ||
    binding.snapshot.id !== expectedSnapshot.id ||
    binding.snapshot.revision !== expectedSnapshot.revision ||
    binding.snapshot.hash !== expectedSnapshot.hash
  ) {
    throw new TypeError(
      "Stored workbench recovery binding does not match its exact draft",
    );
  }
}

/**
 * Builds the server-owned binding stored beside an immutable draft JSON. The
 * snapshot reference identifies that draft's exact geometry snapshot; it is
 * never an approved/commercial RoofSnapshot.
 */
export function buildWorkbenchDraftRecoveryBindingV1(input: {
  draft: RoofFusionWorkbenchDraftV1;
  addressRevision: number;
}): RfDraftRecoveryBinding {
  const addressRevision = z
    .number()
    .int()
    .positive()
    .parse(input.addressRevision);
  const binding = rfDraftRecoveryBindingSchema.parse({
    version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
    case: { caseId: input.draft.caseId, addressRevision },
    draft: draftReference(input.draft),
    // Capture IDs and hashes are immutable content identities in this route.
    source: {
      id: input.draft.source.sourceId,
      revision: 1,
      hash: input.draft.source.sourceContentHash,
    },
    snapshot: geometrySnapshotReference(input.draft),
  });
  assertBindingMatchesDraft(input.draft, binding);
  return binding;
}

export function serializeWorkbenchDraftRecoveryRecordV1(
  record: Readonly<{
    draft: RoofFusionWorkbenchDraftV1;
    recoveryBinding: RfDraftRecoveryBinding;
  }>,
) {
  const draft = parseRoofFusionWorkbenchDraftV1(record.draft);
  const recoveryBinding = rfDraftRecoveryBindingSchema.parse(
    record.recoveryBinding,
  );
  assertBindingMatchesDraft(draft, recoveryBinding);
  return {
    schemaVersion: WORKBENCH_DRAFT_RECOVERY_RECORD_VERSION,
    draft,
    recoveryBinding,
  } as const;
}

/** Direct draft JSON is the explicit legacy shape and has no resumable pin. */
export function parseWorkbenchDraftRecoveryRecordV1(
  value: unknown,
): RoofFusionWorkbenchDraftRecoveryRecordV1 {
  const stored = storedRecordSchema.safeParse(value);
  if (!stored.success) {
    return {
      draft: parseRoofFusionWorkbenchDraftV1(value),
      recoveryBinding: null,
    };
  }
  const draft = parseRoofFusionWorkbenchDraftV1(stored.data.draft);
  assertBindingMatchesDraft(draft, stored.data.recoveryBinding);
  return { draft, recoveryBinding: stored.data.recoveryBinding };
}

export function currentWorkbenchDraftRecoveryContextV1(input: {
  record: RoofFusionWorkbenchDraftRecoveryRecordV1;
  addressRevision: number;
  currentSource: Readonly<{ id: string; hash: string }>;
}): RfDraftRecoveryCurrentContext {
  const addressRevision = z
    .number()
    .int()
    .positive()
    .parse(input.addressRevision);
  const sourceRevision =
    input.record.recoveryBinding &&
    input.record.recoveryBinding.source.id === input.currentSource.id &&
    input.record.recoveryBinding.source.hash === input.currentSource.hash
      ? input.record.recoveryBinding.source.revision
      : (input.record.recoveryBinding?.source.revision ?? 0) + 1;
  return {
    case: { caseId: input.record.draft.caseId, addressRevision },
    source: {
      id: input.currentSource.id,
      revision: Math.max(1, sourceRevision),
      hash: input.currentSource.hash,
    },
    snapshot: geometrySnapshotReference(input.record.draft),
  };
}
