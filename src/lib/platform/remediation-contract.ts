export const remediationPhaseIds = [
  "F0",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
] as const;

export const operationalStateInventory = {
  lead: ["new", "draft_ready", "customer_waiting", "waiting_customer", "qualified", "measuring", "quoted", "converted", "closed", "contacted"],
  measurement: ["draft", "review_required", "blocked", "approved", "superseded"],
  priceCalculation: ["draft", "ready", "blocked", "superseded"],
  quote: ["draft", "approved", "sent", "viewed", "accepted", "declined", "expired", "revoked", "superseded"],
  contract: ["draft", "issued", "signed", "declined", "revoked", "superseded"],
  workOrder: ["unassigned", "assigned", "scheduled", "on_way", "arrived", "precheck", "ready", "blocked", "in_progress", "completed", "documented", "cancelled"],
  changeAgreement: ["draft", "approved", "sent", "viewed", "accepted", "declined", "revoked", "superseded"],
  message: ["draft", "approved", "queued", "sent", "delivered", "failed", "attention", "cancelled"],
  job: ["pending", "running", "retry", "completed", "failed", "attention", "cancelled"],
  invoiceDraft: ["draft"],
  warranty: ["active", "expired", "revoked"],
} as const;

export type CaseCommandEnvelope = {
  actorId: string | number;
  actorRole: "administrator" | "customer" | "system" | "worker";
  caseId: string | number;
  command: string;
  expectedVersion: number;
  idempotencyKey: string;
  occurredAt: string;
};

export const commandContract = {
  optimisticConcurrency: "expectedVersion must equal the current case version",
  idempotency: "the same idempotencyKey returns the original result and creates no duplicate side effect",
  audit: "every accepted or rejected command records actor, case, command, before, after, reason and correlation ID",
  statusWrites: "related operational statuses may only change inside the central command transaction",
  nextAction: "every active case resolves to exactly one owner, action, due date or explicit blocker",
} as const;

export const lifecycleBusinessRules = {
  cancellationAfterSignature: "freeze automation and create an administrator legal-review task",
  earlyStartRequest: "require a separately recorded customer request and administrator approval before scheduling",
  quoteExpiry: "expire the customer action link and create a non-response follow-up task",
  weatherReschedule: "preserve the previous schedule in audit history and notify the customer of the replacement window",
  warrantyClaim: "create a new case linked to the immutable completed case",
  companyCountersignature: "only an active authorised administrator may countersign; offboarding immediately removes permission",
} as const;

export type RemediationPhaseId = (typeof remediationPhaseIds)[number];

export const phaseGateKeys = [
  "FUNCTIONAL_RESULT",
  "TARGET_ACHIEVED",
  "REGRESSION_TESTS",
  "STAGING_ACCEPTANCE",
  "ROLLBACK_READY",
] as const;

export type PhaseGateKey = (typeof phaseGateKeys)[number];
export type PhaseGateResult = Record<
  PhaseGateKey,
  "PASS" | "FAIL" | "YES" | "NO" | "NOT_RUN"
>;

export function phaseCanComplete(result: PhaseGateResult) {
  return result.FUNCTIONAL_RESULT === "PASS"
    && result.TARGET_ACHIEVED === "YES"
    && result.REGRESSION_TESTS === "PASS"
    && result.STAGING_ACCEPTANCE === "PASS"
    && result.ROLLBACK_READY === "YES";
}

export type IntegrationFailurePolicy = {
  alertAfterMs: number;
  fallback: string;
  manualAction: string;
  maxAttempts: number;
  timeoutMs: number;
};

export const integrationFailurePolicies = {
  gemini: {
    timeoutMs: 20_000,
    maxAttempts: 3,
    alertAfterMs: 15 * 60_000,
    fallback: "Create a deterministic administrator task without an AI draft.",
    manualAction: "Administrator writes or regenerates the reply draft.",
  },
  kartverket: {
    timeoutMs: 10_000,
    maxAttempts: 3,
    alertAfterMs: 15 * 60_000,
    fallback: "Keep the submitted address and open manual address review.",
    manualAction: "Administrator corrects the address or enters a manual roof area.",
  },
  buildingFootprints: {
    timeoutMs: 15_000,
    maxAttempts: 3,
    alertAfterMs: 15 * 60_000,
    fallback: "Offer manual roof area without a visual attachment.",
    manualAction: "Administrator selects, draws or replaces the measurement with a manual area.",
  },
  contextualImagery: {
    timeoutMs: 15_000,
    maxAttempts: 2,
    alertAfterMs: 60 * 60_000,
    fallback: "Use the internally rendered schematic evidence without an external background.",
    manualAction: "No action is required when a verified polygon exists.",
  },
  resend: {
    timeoutMs: 15_000,
    maxAttempts: 5,
    alertAfterMs: 15 * 60_000,
    fallback: "Route a hard bounce to SMS when allowed; otherwise create a manual-contact task.",
    manualAction: "Administrator verifies the email address or contacts the customer manually.",
  },
  sms: {
    timeoutMs: 15_000,
    maxAttempts: 3,
    alertAfterMs: 15 * 60_000,
    fallback: "Create a manual-contact task; never silently discard the customer action.",
    manualAction: "Administrator calls the customer and records the result.",
  },
  blob: {
    timeoutMs: 30_000,
    maxAttempts: 3,
    alertAfterMs: 15 * 60_000,
    fallback: "Keep the form draft and mark the file as not uploaded.",
    manualAction: "Retry the resumable upload or attach a smaller verified file.",
  },
  operationalJobs: {
    timeoutMs: 55_000,
    maxAttempts: 5,
    alertAfterMs: 15 * 60_000,
    fallback: "Move the exhausted job to attention without repeating completed side effects.",
    manualAction: "Administrator retries or resolves the recorded job from the custom admin.",
  },
} as const satisfies Record<string, IntegrationFailurePolicy>;

export const contactRoutingPolicy = {
  primary: "email",
  smsAllowedReasons: ["email_missing", "email_hard_bounce"],
  smsContainsSensitiveData: false,
  smsMarketingAllowed: false,
  noUsableChannelAction: "manual_contact",
} as const;

export const immutableSnapshotFields = [
  "measurementVersion",
  "measurementHash",
  "priceBookVersion",
  "vatBasisPoints",
  "toleranceBasisPoints",
  "warrantyTemplateVersion",
  "legalTemplateVersion",
] as const;

export const workerCustomerFacingRequirements = [
  "active",
  "displayName",
  "phone",
] as const;

export const retentionDecision = {
  trashGraceDays: 30,
  unsignedRecords: "follow_lead",
  signedRecords: "legal_hold_until_approved_retention_policy",
  workEvidence: "legal_hold_until_approved_retention_policy",
  auditEvents: "immutable_until_approved_retention_policy",
} as const;

export const pilotGateMetrics = {
  criticalStateInvariantFailures: { direction: "max", value: 0 },
  duplicateCustomerMessages: { direction: "max", value: 0 },
  wrongCaseInboundMessages: { direction: "max", value: 0 },
  quoteContractSnapshotMismatches: { direction: "max", value: 0 },
  unauthorizedObjectAccesses: { direction: "max", value: 0 },
  customerReceiptP95Minutes: { direction: "max", value: 5 },
  automaticPackageP95Minutes: { direction: "max", value: 15 },
  emailDeliveryPercentExcludingInvalidAddresses: { direction: "min", value: 95 },
  physicalChecksInsideQuotedAreaIntervalPercent: { direction: "min", value: 100 },
} as const;
