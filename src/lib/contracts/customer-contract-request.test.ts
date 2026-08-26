import { describe, expect, it } from "vitest";
import { customerContractRequestSchema, nominalWithdrawalAssessment, recoveryPotential, suggestedFollowUpAt } from "./customer-contract-request";

describe("customer contract request rules", () => {
  it("accepts a required reason choice that preserves the right not to state a reason", () => {
    expect(customerContractRequestSchema.parse({ action: "withdrawal", reasonCode: "prefer_not_to_say", followUpConsent: false })).toMatchObject({ reasonCode: "prefer_not_to_say" });
    expect(() => customerContractRequestSchema.parse({ action: "withdrawal", reasonCode: "other", followUpConsent: false })).toThrow();
  });

  it("keeps follow-up consent separate from the withdrawal", () => {
    expect(() => customerContractRequestSchema.parse({ action: "withdrawal", reasonCode: "wait", followUpConsent: false, preferredFollowUp: "three_months" })).toThrow();
    expect(recoveryPotential({ action: "withdrawal", reasonCode: "wait", followUpConsent: true, preferredFollowUp: "three_months" })).toBe("green");
    expect(recoveryPotential({ action: "withdrawal", reasonCode: "communication", followUpConsent: false, preferredFollowUp: "never" })).toBe("red");
  });

  it("records the nominal 14 day signal without blocking receipt", () => {
    const inside = nominalWithdrawalAssessment("2026-08-01T10:00:00.000Z", new Date("2026-08-10T10:00:00.000Z"));
    const outside = nominalWithdrawalAssessment("2026-08-01T10:00:00.000Z", new Date("2026-08-20T10:00:00.000Z"));
    expect(inside.withinPeriod).toBe(true);
    expect(outside.withinPeriod).toBe(false);
  });

  it("calculates a requested follow-up date", () => {
    expect(suggestedFollowUpAt("three_months", undefined, new Date("2026-08-26T10:00:00.000Z"))).toBe("2026-11-26T10:00:00.000Z");
  });
});
