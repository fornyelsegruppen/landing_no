import { describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_TERMS } from "./production-pilot-terms";

describe("owner-approved production pilot terms", () => {
  it("contains the complete versioned contract and live withdrawal route", () => {
    expect(PRODUCTION_PILOT_TERMS.version).toBe("PRODUCTION-PILOT-V1");
    expect(PRODUCTION_PILOT_TERMS.contractText).toContain(
      "14. KLAGER OG TVISTER",
    );
    expect(PRODUCTION_PILOT_TERMS.contractText.length).toBeGreaterThan(7_000);
    expect(
      PRODUCTION_PILOT_TERMS.withdrawalInstructions.length,
    ).toBeGreaterThan(500);
    expect(PRODUCTION_PILOT_TERMS.withdrawalFormUrl).toBe(
      "https://www.takfornyelse.as/no/angreskjema",
    );
    expect(
      `${PRODUCTION_PILOT_TERMS.contractText}\n${PRODUCTION_PILOT_TERMS.withdrawalInstructions}\n${PRODUCTION_PILOT_TERMS.withdrawalFormUrl}`,
    ).not.toMatch(/STAGINGTEST|example\.com|staging-only/i);
  });
});
