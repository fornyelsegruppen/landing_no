import { describe, expect, it } from "vitest";
import { measurementWorkflowMode } from "./workflow-mode";

describe("measurement workflow mode", () => {
  it("isolates a measurement-only pilot from commercial records", () => {
    expect(
      measurementWorkflowMode({ FEATURE_CUSTOMER_QUOTES: "false" }),
    ).toEqual({
      commercialPackageEnabled: false,
      requireApprovedPriceRule: false,
    });
  });

  it("enables price-rule and package requirements with customer quotes", () => {
    expect(
      measurementWorkflowMode({ FEATURE_CUSTOMER_QUOTES: "true" }),
    ).toEqual({
      commercialPackageEnabled: true,
      requireApprovedPriceRule: true,
    });
  });
});
