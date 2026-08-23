import { describe, expect, it } from "vitest";
import { assessPrecheck } from "./precheck";

const base = {
  actualAreaTenths: 1_100,
  hmsSafe: true,
  scopeChanged: false,
  contract: {
    estimatedAreaMinTenths: 1_000,
    estimatedAreaMaxTenths: 1_100,
    toleranceBasisPoints: 1_000,
    originalTotalIncVatOre: 17_187_50,
    maximumTotalIncVatOre: 18_906_25,
  },
  rule: { unitPriceExVatOre: 12_500, vatBasisPoints: 2_500, minimumExVatOre: 500_000 },
};

describe("onsite precheck assessment", () => {
  it("confirms a lower exact price inside the signed frame", () => {
    const result = assessPrecheck({ ...base, actualAreaTenths: 1_000 });
    expect(result).toMatchObject({ decision: "ready", outcome: "lower", actualTotalIncVatOre: 15_625_00 });
  });

  it("allows a higher area only inside tolerance and maximum price", () => {
    const result = assessPrecheck({ ...base, actualAreaTenths: 1_180 });
    expect(result).toMatchObject({ decision: "ready", outcome: "within_contract" });
  });

  it("blocks area outside the contractual tolerance", () => {
    const result = assessPrecheck({ ...base, actualAreaTenths: 1_220 });
    expect(result).toMatchObject({ decision: "blocked", outcome: "over_tolerance" });
  });

  it("blocks changed scope and HMS risk before price", () => {
    expect(assessPrecheck({ ...base, scopeChanged: true })).toMatchObject({ decision: "blocked", outcome: "scope_change" });
    expect(assessPrecheck({ ...base, hmsSafe: false, scopeChanged: true })).toMatchObject({ decision: "blocked", outcome: "hms_blocked" });
  });
});
