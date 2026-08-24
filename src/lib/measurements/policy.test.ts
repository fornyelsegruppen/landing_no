import { describe, expect, it } from "vitest";
import { evaluateMeasurementGate } from "./policy";

const complete = {
  addressResolved: true, buildingResolved: true, sourceAuthorized: true,
  confidence: "high" as const,
  roofPlanes: [{ id: "a", polygon: [{ latitude: 60, longitude: 10 }, { latitude: 60, longitude: 10.001 }, { latitude: 60.001, longitude: 10 }], angleMinDegrees: 27, angleMaxDegrees: 32 }],
};

describe("measurement safety gate", () => {
  it("allows a complete high-confidence proposal", () => {
    expect(evaluateMeasurementGate(complete, true)).toEqual({ allowed: true, requiresAdminReview: false, reasons: [] });
  });

  it("requires review for medium confidence", () => {
    expect(evaluateMeasurementGate({ ...complete, confidence: "medium" }, true)).toMatchObject({ allowed: true, requiresAdminReview: true });
  });

  it("cannot bypass low confidence or an unauthorized source", () => {
    const result = evaluateMeasurementGate({ ...complete, confidence: "low", sourceAuthorized: false }, true);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(["confidence_low", "measurement_source_not_authorized"]));
  });

  it("blocks unresolved buildings, unknown slope and missing price rules", () => {
    const result = evaluateMeasurementGate({ ...complete, buildingResolved: false, roofPlanes: [{ ...complete.roofPlanes[0], angleMinDegrees: Number.NaN }] }, false);
    expect(result.reasons).toEqual(expect.arrayContaining(["building_unresolved", "roof_angle_unknown", "price_rule_not_approved"]));
  });
});
