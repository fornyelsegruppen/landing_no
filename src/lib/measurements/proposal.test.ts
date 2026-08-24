import { describe, expect, it } from "vitest";
import { prepareMeasurement } from "./proposal";

const polygon = [
  { latitude: 59.9, longitude: 10.7 },
  { latitude: 59.9, longitude: 10.7002 },
  { latitude: 59.9001, longitude: 10.7002 },
  { latitude: 59.9001, longitude: 10.7 },
];
const base = {
  buildingIdentifier: "0301-149-181", confidenceReasoning: "Clear building and roof edges visible in licensed source.",
  roofPlanes: [{ id: "south", polygon, angleMinDegrees: 27, angleMaxDegrees: 32 }],
};

describe("AI roof proposals", () => {
  it.each([
    ["high", "draft", false],
    ["medium", "review_required", true],
    ["low", "blocked", true],
  ] as const)("handles %s confidence", (confidence, status, review) => {
    const result = prepareMeasurement({ proposal: { ...base, confidence }, addressResolved: true, sourceAuthorized: true, hasApprovedPriceRule: true });
    expect(result.status).toBe(status);
    expect(result.gate.requiresAdminReview).toBe(review);
  });

  it("does not permit AI to provide calculated area or price fields", () => {
    const parsed = prepareMeasurement({ proposal: { ...base, confidence: "high", totalPrice: 1, roofArea: 999 }, addressResolved: true, sourceAuthorized: true, hasApprovedPriceRule: true });
    expect(parsed.proposal).not.toHaveProperty("totalPrice");
    expect(parsed.calculation?.actualAreaMaxTenths).not.toBe(9990);
  });
});
