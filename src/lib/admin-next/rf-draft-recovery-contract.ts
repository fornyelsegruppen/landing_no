import { z } from "zod";

export const RF_DRAFT_RECOVERY_CONTRACT_VERSION =
  "rf-draft-recovery.v1" as const;

export const rfDraftRecoveryCapabilities = [
  "roof_fusion.draft.continue",
  "roof_fusion.draft.create",
] as const;

export type RfDraftRecoveryCapability =
  (typeof rfDraftRecoveryCapabilities)[number];

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const positiveRevision = z.number().int().positive().safe();

const revisionedHashReferenceSchema = z
  .object({
    id: identifier,
    revision: positiveRevision,
    hash: sha256,
  })
  .strict();

const caseAddressBindingSchema = z
  .object({
    caseId: identifier,
    addressRevision: positiveRevision,
  })
  .strict();

const draftReferenceSchema = revisionedHashReferenceSchema;

export const rfDraftRecoveryBindingSchema = z
  .object({
    version: z.literal(RF_DRAFT_RECOVERY_CONTRACT_VERSION),
    draft: draftReferenceSchema,
    case: caseAddressBindingSchema,
    source: revisionedHashReferenceSchema,
    snapshot: revisionedHashReferenceSchema,
  })
  .strict();

const currentContextSchema = z
  .object({
    case: caseAddressBindingSchema,
    source: revisionedHashReferenceSchema,
    snapshot: revisionedHashReferenceSchema,
  })
  .strict();

const persistedDraftSchema = z
  .object({
    draft: draftReferenceSchema,
    /**
     * Existing drafts created before this contract have no trustworthy address
     * and snapshot pin. They must be represented as null and cannot be resumed.
     */
    recoveryBinding: rfDraftRecoveryBindingSchema.nullable(),
  })
  .strict();

export const rfDraftRecoveryInputSchema = z
  .object({
    version: z.literal(RF_DRAFT_RECOVERY_CONTRACT_VERSION),
    /** Supplied by a trusted server boundary; this library never reads env itself. */
    vercelEnvironment: z.enum(["preview", "production", "development", "test"]),
    capabilities: z.array(z.enum(rfDraftRecoveryCapabilities)).max(2),
    current: currentContextSchema,
    persistedDraft: persistedDraftSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.capabilities).size !== value.capabilities.length) {
      context.addIssue({
        code: "custom",
        message: "Recovery capabilities must be unique",
        path: ["capabilities"],
      });
    }
  });

export type RfDraftRecoveryBinding = z.infer<
  typeof rfDraftRecoveryBindingSchema
>;
export type RfDraftRecoveryInput = z.infer<typeof rfDraftRecoveryInputSchema>;
export type RfDraftRecoveryCurrentContext = RfDraftRecoveryInput["current"];
export type RfDraftReference = z.infer<typeof draftReferenceSchema>;

export type RfDraftStaleReason =
  | "draft_reference_conflict"
  | "case_id_changed"
  | "address_revision_changed"
  | "source_id_changed"
  | "source_revision_changed"
  | "source_hash_changed"
  | "snapshot_id_changed"
  | "snapshot_revision_changed"
  | "snapshot_hash_changed";

export type RfDraftRecoveryReason =
  | "current_binding"
  | "no_previous_draft"
  | "recovery_binding_missing"
  | "stale_binding"
  | "invalid_context";

export type RfDraftActionUnavailableReason =
  | "preview_required"
  | "capability_missing"
  | "no_previous_draft"
  | "recovery_binding_missing"
  | "stale_binding"
  | "invalid_context";

export type RfContinueOldIntent = Readonly<{
  version: typeof RF_DRAFT_RECOVERY_CONTRACT_VERSION;
  kind: "continue_old";
  expected: RfDraftRecoveryBinding;
}>;

export type RfStartNewIntent = Readonly<{
  version: typeof RF_DRAFT_RECOVERY_CONTRACT_VERSION;
  kind: "start_new";
  current: RfDraftRecoveryCurrentContext;
  expectedLatestDraft: RfDraftReference | null;
}>;

type AvailableAction<TIntent> = Readonly<{
  available: true;
  requiredCapability: RfDraftRecoveryCapability;
  unavailableReason: null;
  intent: TIntent;
}>;

type UnavailableAction = Readonly<{
  available: false;
  requiredCapability: RfDraftRecoveryCapability;
  unavailableReason: RfDraftActionUnavailableReason;
  intent: null;
}>;

export type RfContinueOldAction =
  AvailableAction<RfContinueOldIntent> | UnavailableAction;
export type RfStartNewAction =
  AvailableAction<RfStartNewIntent> | UnavailableAction;

export type RfDraftRecoveryDecision = Readonly<{
  version: typeof RF_DRAFT_RECOVERY_CONTRACT_VERSION;
  scope: "preview_only";
  state: "continue_or_start_new" | "start_new_only" | "blocked";
  reason: RfDraftRecoveryReason;
  staleReasons: readonly RfDraftStaleReason[];
  current: RfDraftRecoveryCurrentContext | null;
  continueOld: RfContinueOldAction;
  startNew: RfStartNewAction;
  /**
   * A recoverable workbench draft is never commercial truth. Pricing and offer
   * adapters must consume a separately approved canonical RF snapshot using its
   * exact revision/hash boundary, not this decision or either action intent.
   */
  commercialUse: Readonly<{
    pricingAllowed: false;
    offerAllowed: false;
    reason:
      | "canonical_approval_required"
      | "no_draft"
      | "draft_binding_stale"
      | "invalid_context";
  }>;
}>;

const continueOldActionSchema = z.discriminatedUnion("available", [
  z
    .object({
      available: z.literal(true),
      requiredCapability: z.literal("roof_fusion.draft.continue"),
      unavailableReason: z.null(),
      intent: z
        .object({
          version: z.literal(RF_DRAFT_RECOVERY_CONTRACT_VERSION),
          kind: z.literal("continue_old"),
          expected: rfDraftRecoveryBindingSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      available: z.literal(false),
      requiredCapability: z.literal("roof_fusion.draft.continue"),
      unavailableReason: z.enum([
        "preview_required",
        "capability_missing",
        "no_previous_draft",
        "recovery_binding_missing",
        "stale_binding",
        "invalid_context",
      ]),
      intent: z.null(),
    })
    .strict(),
]);

const startNewActionSchema = z.discriminatedUnion("available", [
  z
    .object({
      available: z.literal(true),
      requiredCapability: z.literal("roof_fusion.draft.create"),
      unavailableReason: z.null(),
      intent: z
        .object({
          version: z.literal(RF_DRAFT_RECOVERY_CONTRACT_VERSION),
          kind: z.literal("start_new"),
          current: currentContextSchema,
          expectedLatestDraft: draftReferenceSchema.nullable(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      available: z.literal(false),
      requiredCapability: z.literal("roof_fusion.draft.create"),
      unavailableReason: z.enum([
        "preview_required",
        "capability_missing",
        "no_previous_draft",
        "recovery_binding_missing",
        "stale_binding",
        "invalid_context",
      ]),
      intent: z.null(),
    })
    .strict(),
]);

export const rfDraftRecoveryDecisionSchema = z
  .object({
    version: z.literal(RF_DRAFT_RECOVERY_CONTRACT_VERSION),
    scope: z.literal("preview_only"),
    state: z.enum(["continue_or_start_new", "start_new_only", "blocked"]),
    reason: z.enum([
      "current_binding",
      "no_previous_draft",
      "recovery_binding_missing",
      "stale_binding",
      "invalid_context",
    ]),
    staleReasons: z.array(
      z.enum([
        "draft_reference_conflict",
        "case_id_changed",
        "address_revision_changed",
        "source_id_changed",
        "source_revision_changed",
        "source_hash_changed",
        "snapshot_id_changed",
        "snapshot_revision_changed",
        "snapshot_hash_changed",
      ]),
    ),
    current: currentContextSchema.nullable(),
    continueOld: continueOldActionSchema,
    startNew: startNewActionSchema,
    commercialUse: z
      .object({
        pricingAllowed: z.literal(false),
        offerAllowed: z.literal(false),
        reason: z.enum([
          "canonical_approval_required",
          "no_draft",
          "draft_binding_stale",
          "invalid_context",
        ]),
      })
      .strict(),
  })
  .strict();

export function parseRfDraftRecoveryDecision(
  value: unknown,
): RfDraftRecoveryDecision {
  return rfDraftRecoveryDecisionSchema.parse(value) as RfDraftRecoveryDecision;
}

const staleReasonOrder: readonly RfDraftStaleReason[] = [
  "draft_reference_conflict",
  "case_id_changed",
  "address_revision_changed",
  "source_id_changed",
  "source_revision_changed",
  "source_hash_changed",
  "snapshot_id_changed",
  "snapshot_revision_changed",
  "snapshot_hash_changed",
];

function unavailable<T extends RfDraftRecoveryCapability>(
  requiredCapability: T,
  unavailableReason: RfDraftActionUnavailableReason,
): UnavailableAction {
  return {
    available: false,
    requiredCapability,
    unavailableReason,
    intent: null,
  };
}

function mayUseCapability(
  environment: RfDraftRecoveryInput["vercelEnvironment"],
  capabilities: readonly RfDraftRecoveryCapability[],
  capability: RfDraftRecoveryCapability,
) {
  if (environment !== "preview") return "preview_required" as const;
  if (!capabilities.includes(capability)) return "capability_missing" as const;
  return null;
}

function staleReasons(
  persisted: NonNullable<RfDraftRecoveryInput["persistedDraft"]>,
  current: RfDraftRecoveryCurrentContext,
) {
  const binding = persisted.recoveryBinding;
  if (!binding) return [];
  const found = new Set<RfDraftStaleReason>();
  if (
    persisted.draft.id !== binding.draft.id ||
    persisted.draft.revision !== binding.draft.revision ||
    persisted.draft.hash !== binding.draft.hash
  ) {
    found.add("draft_reference_conflict");
  }
  if (binding.case.caseId !== current.case.caseId) {
    found.add("case_id_changed");
  }
  if (binding.case.addressRevision !== current.case.addressRevision) {
    found.add("address_revision_changed");
  }
  if (binding.source.id !== current.source.id) found.add("source_id_changed");
  if (binding.source.revision !== current.source.revision) {
    found.add("source_revision_changed");
  }
  if (binding.source.hash !== current.source.hash) {
    found.add("source_hash_changed");
  }
  if (binding.snapshot.id !== current.snapshot.id) {
    found.add("snapshot_id_changed");
  }
  if (binding.snapshot.revision !== current.snapshot.revision) {
    found.add("snapshot_revision_changed");
  }
  if (binding.snapshot.hash !== current.snapshot.hash) {
    found.add("snapshot_hash_changed");
  }
  return staleReasonOrder.filter((reason) => found.has(reason));
}

function blockedInvalidDecision(): RfDraftRecoveryDecision {
  return {
    version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
    scope: "preview_only",
    state: "blocked",
    reason: "invalid_context",
    staleReasons: [],
    current: null,
    continueOld: unavailable("roof_fusion.draft.continue", "invalid_context"),
    startNew: unavailable("roof_fusion.draft.create", "invalid_context"),
    commercialUse: {
      pricingAllowed: false,
      offerAllowed: false,
      reason: "invalid_context",
    },
  };
}

/**
 * Pure decision boundary for a recoverable RF workbench draft.
 *
 * Action availability is not authorization: the integration must re-check the
 * capability, Preview environment and all expected references inside the
 * server command with CAS/idempotency before persisting anything.
 */
export function resolveRfDraftRecoveryDecision(
  input: unknown,
): RfDraftRecoveryDecision {
  const parsed = rfDraftRecoveryInputSchema.safeParse(input);
  if (!parsed.success) return blockedInvalidDecision();
  const value = parsed.data;
  const continuePermission = mayUseCapability(
    value.vercelEnvironment,
    value.capabilities,
    "roof_fusion.draft.continue",
  );
  const startPermission = mayUseCapability(
    value.vercelEnvironment,
    value.capabilities,
    "roof_fusion.draft.create",
  );

  const createStartNew = (
    expectedLatestDraft: RfDraftReference | null,
  ): RfStartNewAction =>
    startPermission
      ? unavailable("roof_fusion.draft.create", startPermission)
      : {
          available: true,
          requiredCapability: "roof_fusion.draft.create",
          unavailableReason: null,
          intent: {
            version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
            kind: "start_new",
            current: value.current,
            expectedLatestDraft,
          },
        };

  if (!value.persistedDraft) {
    return {
      version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
      scope: "preview_only",
      state: "start_new_only",
      reason: "no_previous_draft",
      staleReasons: [],
      current: value.current,
      continueOld: unavailable(
        "roof_fusion.draft.continue",
        "no_previous_draft",
      ),
      startNew: createStartNew(null),
      commercialUse: {
        pricingAllowed: false,
        offerAllowed: false,
        reason: "no_draft",
      },
    };
  }

  if (!value.persistedDraft.recoveryBinding) {
    return {
      version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
      scope: "preview_only",
      state: "start_new_only",
      reason: "recovery_binding_missing",
      staleReasons: [],
      current: value.current,
      continueOld: unavailable(
        "roof_fusion.draft.continue",
        "recovery_binding_missing",
      ),
      startNew: createStartNew(value.persistedDraft.draft),
      commercialUse: {
        pricingAllowed: false,
        offerAllowed: false,
        reason: "draft_binding_stale",
      },
    };
  }

  const mismatches = staleReasons(value.persistedDraft, value.current);
  if (mismatches.length > 0) {
    return {
      version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
      scope: "preview_only",
      state: "start_new_only",
      reason: "stale_binding",
      staleReasons: mismatches,
      current: value.current,
      continueOld: unavailable("roof_fusion.draft.continue", "stale_binding"),
      startNew: createStartNew(value.persistedDraft.draft),
      commercialUse: {
        pricingAllowed: false,
        offerAllowed: false,
        reason: "draft_binding_stale",
      },
    };
  }

  return {
    version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
    scope: "preview_only",
    state: "continue_or_start_new",
    reason: "current_binding",
    staleReasons: [],
    current: value.current,
    continueOld: continuePermission
      ? unavailable("roof_fusion.draft.continue", continuePermission)
      : {
          available: true,
          requiredCapability: "roof_fusion.draft.continue",
          unavailableReason: null,
          intent: {
            version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
            kind: "continue_old",
            expected: value.persistedDraft.recoveryBinding,
          },
        },
    startNew: createStartNew(value.persistedDraft.draft),
    commercialUse: {
      pricingAllowed: false,
      offerAllowed: false,
      reason: "canonical_approval_required",
    },
  };
}

/**
 * Convenience boundary for commercial adapters. This literal false makes it
 * impossible for a draft recovery decision to be mistaken for approved truth.
 */
export function canRfDraftRecoveryFeedPricingOrOffer(
  _decision: RfDraftRecoveryDecision,
): false {
  void _decision;
  return false;
}
