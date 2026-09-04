import { describe, expect, it } from "vitest";
import {
  canRfDraftRecoveryFeedPricingOrOffer,
  parseRfDraftRecoveryDecision,
  resolveRfDraftRecoveryDecision,
  RF_DRAFT_RECOVERY_CONTRACT_VERSION,
  type RfDraftRecoveryInput,
} from "./rf-draft-recovery-contract";

const draftHash = "d".repeat(64);
const sourceHash = "a".repeat(64);
const snapshotHash = "b".repeat(64);

function input(): RfDraftRecoveryInput {
  const current = {
    case: { caseId: "lead:13", addressRevision: 7 },
    source: { id: "norge-image-13", revision: 4, hash: sourceHash },
    snapshot: { id: "rf-lead-13-r3", revision: 3, hash: snapshotHash },
  };
  const draft = { id: "draft-lead-13-r5", revision: 5, hash: draftHash };
  return {
    version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
    vercelEnvironment: "preview",
    capabilities: ["roof_fusion.draft.continue", "roof_fusion.draft.create"],
    current,
    persistedDraft: {
      draft,
      recoveryBinding: {
        version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
        draft: { ...draft },
        case: { ...current.case },
        source: { ...current.source },
        snapshot: { ...current.snapshot },
      },
    },
  };
}

describe("RF draft recovery contract", () => {
  it("offers Continue old and Start new only for an exact Preview binding", () => {
    const result = resolveRfDraftRecoveryDecision(input());

    expect(result).toMatchObject({
      scope: "preview_only",
      state: "continue_or_start_new",
      reason: "current_binding",
      staleReasons: [],
      continueOld: {
        available: true,
        requiredCapability: "roof_fusion.draft.continue",
        intent: { kind: "continue_old" },
      },
      startNew: {
        available: true,
        requiredCapability: "roof_fusion.draft.create",
        intent: { kind: "start_new" },
      },
      commercialUse: {
        pricingAllowed: false,
        offerAllowed: false,
        reason: "canonical_approval_required",
      },
    });
    if (result.continueOld.available) {
      expect(result.continueOld.intent.expected).toEqual(
        input().persistedDraft?.recoveryBinding,
      );
    }
    if (result.startNew.available) {
      expect(result.startNew.intent.expectedLatestDraft).toEqual(
        input().persistedDraft?.draft,
      );
    }
  });

  it("makes an old draft stale as soon as the case address revision changes", () => {
    const value = input();
    value.current.case.addressRevision += 1;
    const result = resolveRfDraftRecoveryDecision(value);

    expect(result.state).toBe("start_new_only");
    expect(result.reason).toBe("stale_binding");
    expect(result.staleReasons).toEqual(["address_revision_changed"]);
    expect(result.continueOld).toMatchObject({
      available: false,
      unavailableReason: "stale_binding",
      intent: null,
    });
    expect(result.startNew.available).toBe(true);
    expect(result.commercialUse).toEqual({
      pricingAllowed: false,
      offerAllowed: false,
      reason: "draft_binding_stale",
    });
    expect(canRfDraftRecoveryFeedPricingOrOffer(result)).toBe(false);
  });

  it.each([
    [
      "source id",
      "source_id_changed",
      (value: RfDraftRecoveryInput): void => {
        value.current.source.id = "other-source";
      },
    ],
    [
      "source revision",
      "source_revision_changed",
      (value: RfDraftRecoveryInput): void => {
        value.current.source.revision += 1;
      },
    ],
    [
      "source hash",
      "source_hash_changed",
      (value: RfDraftRecoveryInput): void => {
        value.current.source.hash = "c".repeat(64);
      },
    ],
    [
      "snapshot id",
      "snapshot_id_changed",
      (value: RfDraftRecoveryInput): void => {
        value.current.snapshot.id = "other-snapshot";
      },
    ],
    [
      "snapshot revision",
      "snapshot_revision_changed",
      (value: RfDraftRecoveryInput): void => {
        value.current.snapshot.revision += 1;
      },
    ],
    [
      "snapshot hash",
      "snapshot_hash_changed",
      (value: RfDraftRecoveryInput): void => {
        value.current.snapshot.hash = "e".repeat(64);
      },
    ],
  ] as const)("fails closed for changed %s", (_label, reason, mutate) => {
    const value = input();
    mutate(value);
    const result = resolveRfDraftRecoveryDecision(value);

    expect(result.staleReasons).toEqual([reason]);
    expect(result.continueOld.available).toBe(false);
    expect(result.commercialUse.pricingAllowed).toBe(false);
    expect(result.commercialUse.offerAllowed).toBe(false);
  });

  it("keeps mismatch reasons deterministic and rejects a conflicting draft reference", () => {
    const value = input();
    if (!value.persistedDraft?.recoveryBinding) throw new Error("fixture");
    value.current.case.caseId = "lead:14";
    value.current.case.addressRevision = 8;
    value.current.source.hash = "c".repeat(64);
    value.current.snapshot.revision = 4;
    value.persistedDraft.draft.revision = 6;

    expect(resolveRfDraftRecoveryDecision(value).staleReasons).toEqual([
      "draft_reference_conflict",
      "case_id_changed",
      "address_revision_changed",
      "source_hash_changed",
      "snapshot_revision_changed",
    ]);
  });

  it("never treats an unbound legacy draft as resumable", () => {
    const value = input();
    if (!value.persistedDraft) throw new Error("fixture");
    value.persistedDraft.recoveryBinding = null;
    const result = resolveRfDraftRecoveryDecision(value);

    expect(result).toMatchObject({
      state: "start_new_only",
      reason: "recovery_binding_missing",
      continueOld: {
        available: false,
        unavailableReason: "recovery_binding_missing",
      },
      startNew: { available: true },
      commercialUse: {
        pricingAllowed: false,
        offerAllowed: false,
        reason: "draft_binding_stale",
      },
    });
  });

  it("starts fresh without inventing a previous draft reference", () => {
    const value = input();
    value.persistedDraft = null;
    const result = resolveRfDraftRecoveryDecision(value);

    expect(result.reason).toBe("no_previous_draft");
    expect(result.continueOld.available).toBe(false);
    expect(result.startNew.available).toBe(true);
    if (result.startNew.available) {
      expect(result.startNew.intent.expectedLatestDraft).toBeNull();
    }
  });

  it.each(["production", "development", "test"] as const)(
    "never enables a recovery mutation in %s",
    (vercelEnvironment) => {
      const value = input();
      value.vercelEnvironment = vercelEnvironment;
      const result = resolveRfDraftRecoveryDecision(value);

      expect(result.continueOld).toMatchObject({
        available: false,
        unavailableReason: "preview_required",
        intent: null,
      });
      expect(result.startNew).toMatchObject({
        available: false,
        unavailableReason: "preview_required",
        intent: null,
      });
    },
  );

  it("requires each action capability independently", () => {
    const value = input();
    value.capabilities = ["roof_fusion.draft.create"];
    const result = resolveRfDraftRecoveryDecision(value);

    expect(result.continueOld).toMatchObject({
      available: false,
      unavailableReason: "capability_missing",
    });
    expect(result.startNew.available).toBe(true);
  });

  it.each([
    { ...input(), extra: "unknown" },
    {
      ...input(),
      capabilities: ["roof_fusion.draft.create", "roof_fusion.draft.create"],
    },
    {
      ...input(),
      current: { ...input().current, address: "Must not enter this contract" },
    },
    {
      ...input(),
      current: {
        ...input().current,
        source: { ...input().current.source, hash: "bad" },
      },
    },
  ])(
    "fails closed for malformed, duplicate, unknown or PII-shaped input",
    (value) => {
      const result = resolveRfDraftRecoveryDecision(value);
      expect(result).toMatchObject({
        state: "blocked",
        reason: "invalid_context",
        current: null,
        continueOld: { available: false, intent: null },
        startNew: { available: false, intent: null },
      });
    },
  );

  it("returns a deterministic JSON-safe, PII-minimal projection", () => {
    const first = resolveRfDraftRecoveryDecision(input());
    const second = resolveRfDraftRecoveryDecision(input());
    const json = JSON.stringify(first);

    expect(JSON.parse(json)).toEqual(first);
    expect(second).toEqual(first);
    expect(json).not.toContain('address"');
    expect(json).not.toContain("displayName");
    expect(json).not.toContain("street");
  });

  it("parses only the closed server decision shape", () => {
    const decision = resolveRfDraftRecoveryDecision(input());
    expect(parseRfDraftRecoveryDecision(decision)).toEqual(decision);
    expect(() =>
      parseRfDraftRecoveryDecision({ ...decision, executable: true }),
    ).toThrow();
  });
});
