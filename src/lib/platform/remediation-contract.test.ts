import { describe, expect, it } from "vitest";
import {
  commandContract,
  contactRoutingPolicy,
  immutableSnapshotFields,
  integrationFailurePolicies,
  lifecycleBusinessRules,
  operationalStateInventory,
  phaseCanComplete,
  phaseGateKeys,
  pilotGateMetrics,
  remediationPhaseIds,
  retentionDecision,
  workerCustomerFacingRequirements,
} from "./remediation-contract";

describe("F0 state and command contract", () => {
  it("inventories every customer-operation aggregate", () => {
    expect(Object.keys(operationalStateInventory)).toEqual([
      "lead", "measurement", "priceCalculation", "quote", "contract", "workOrder",
      "changeAgreement", "message", "job", "invoiceDraft", "warranty",
    ]);
    expect(operationalStateInventory.workOrder).toContain("unassigned");
    expect(operationalStateInventory.contract).toContain("signed");
  });

  it("requires concurrency, idempotency, audit and one next action", () => {
    expect(commandContract.optimisticConcurrency).toContain("expectedVersion");
    expect(commandContract.idempotency).toContain("no duplicate");
    expect(commandContract.audit).toContain("correlation ID");
    expect(commandContract.nextAction).toContain("exactly one");
  });

  it("freezes legal exceptions for human review", () => {
    expect(lifecycleBusinessRules.cancellationAfterSignature).toContain("freeze");
    expect(lifecycleBusinessRules.earlyStartRequest).toContain("administrator approval");
    expect(lifecycleBusinessRules.warrantyClaim).toContain("immutable completed case");
  });
});

describe("FULL audit remediation contract", () => {
  it("locks the F0-F10 execution order and all five completion gates", () => {
    expect(remediationPhaseIds).toEqual([
      "F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10",
    ]);
    expect(phaseGateKeys).toHaveLength(5);
    expect(phaseCanComplete({
      FUNCTIONAL_RESULT: "PASS",
      TARGET_ACHIEVED: "YES",
      REGRESSION_TESTS: "PASS",
      STAGING_ACCEPTANCE: "PASS",
      ROLLBACK_READY: "YES",
    })).toBe(true);
  });

  it.each(phaseGateKeys)("refuses completion when %s has not passed", (key) => {
    const result = {
      FUNCTIONAL_RESULT: "PASS",
      TARGET_ACHIEVED: "YES",
      REGRESSION_TESTS: "PASS",
      STAGING_ACCEPTANCE: "PASS",
      ROLLBACK_READY: "YES",
    } as const;
    expect(phaseCanComplete({ ...result, [key]: "NOT_RUN" })).toBe(false);
  });

  it("defines a bounded failure and manual fallback for every external dependency", () => {
    for (const policy of Object.values(integrationFailurePolicies)) {
      expect(policy.timeoutMs).toBeGreaterThan(0);
      expect(policy.maxAttempts).toBeGreaterThan(0);
      expect(policy.alertAfterMs).toBeGreaterThan(0);
      expect(policy.fallback.length).toBeGreaterThan(10);
      expect(policy.manualAction.length).toBeGreaterThan(10);
    }
  });

  it("keeps email primary and SMS a non-marketing fallback", () => {
    expect(contactRoutingPolicy).toMatchObject({
      primary: "email",
      smsAllowedReasons: ["email_missing", "email_hard_bounce"],
      smsContainsSensitiveData: false,
      smsMarketingAllowed: false,
      noUsableChannelAction: "manual_contact",
    });
  });

  it("locks every commercial and legal input used by a customer document", () => {
    expect(immutableSnapshotFields).toEqual(expect.arrayContaining([
      "measurementVersion",
      "measurementHash",
      "priceBookVersion",
      "vatBasisPoints",
      "toleranceBasisPoints",
      "warrantyTemplateVersion",
      "legalTemplateVersion",
    ]));
  });

  it("requires safe worker identity and conservative retention", () => {
    expect(workerCustomerFacingRequirements).toEqual(["active", "displayName", "phone"]);
    expect(retentionDecision.trashGraceDays).toBeGreaterThanOrEqual(30);
    expect(retentionDecision.signedRecords).toContain("legal_hold");
  });

  it("defines zero tolerance for integrity and authorization errors in the pilot", () => {
    expect(pilotGateMetrics.criticalStateInvariantFailures.value).toBe(0);
    expect(pilotGateMetrics.quoteContractSnapshotMismatches.value).toBe(0);
    expect(pilotGateMetrics.unauthorizedObjectAccesses.value).toBe(0);
  });
});
