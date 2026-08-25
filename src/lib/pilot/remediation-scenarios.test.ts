import { describe, expect, it } from "vitest";
import {
  remediationScenarios,
  validateSyntheticScenarioPack,
} from "./remediation-scenarios";

describe("remediation scenario seed pack", () => {
  it("contains stable anonymous coverage for the F0 control journeys", () => {
    expect(validateSyntheticScenarioPack()).toBe(true);
    expect(remediationScenarios).toHaveLength(10);
    expect(new Set(remediationScenarios.map((scenario) => scenario.expectedOutcome))).toEqual(new Set([
      "measurement_review",
      "building_selection",
      "manual_measurement_review",
      "reply_draft_review",
      "decline_follow_up",
      "commercial_review",
      "change_agreement_required",
      "sms_fallback",
      "closed_archive",
    ]));
  });

  it("rejects accidental real contact data", () => {
    expect(() => validateSyntheticScenarioPack([{
      id: "unsafe",
      customer: { email: "person@example.com", name: "Unsafe" },
      expectedOutcome: "none",
      input: {},
    }])).toThrow(/reserved synthetic email domain/);
  });

  it("rejects duplicate scenario identifiers", () => {
    expect(() => validateSyntheticScenarioPack([remediationScenarios[0], remediationScenarios[0]])).toThrow(/Duplicate/);
  });
});

