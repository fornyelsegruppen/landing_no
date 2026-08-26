import { describe, expect, it } from "vitest";
import {
  contractRequestFollowUpLabel,
  contractRequestReasonLabel,
  contractRequestRecoveryLabel,
  contractRequestStatusLabel,
  contractRequestSuggestionLabel,
  contractRequestWorkStatusLabel,
} from "./contract-request-labels";

describe("contract request admin labels", () => {
  it("renders customer request values in Lithuanian instead of raw system codes", () => {
    expect(contractRequestReasonLabel("prefer_not_to_say", "lt")).toBe("Nenori nurodyti priežasties");
    expect(contractRequestStatusLabel("admin_review", "lt")).toBe("Laukia administratoriaus sprendimo");
    expect(contractRequestRecoveryLabel("yellow", "lt")).toBe("Geltona");
    expect(contractRequestWorkStatusLabel("not_created", "lt")).toBe("Darbo užsakymas nesukurtas");
    expect(contractRequestFollowUpLabel("three_months", "lt")).toBe("Po 3 mėnesių");
    expect(contractRequestSuggestionLabel("Administrator må vurdere saken uten automatisk salgsoppfølging.", "lt"))
      .toBe("Administratorius turi įvertinti bylą be automatinio pardavimo kontakto.");
  });

  it("keeps a safe fallback for a future unknown value", () => {
    expect(contractRequestStatusLabel("future_status", "en")).toBe("future_status");
    expect(contractRequestReasonLabel(undefined, "nb")).toBe("—");
  });
});
