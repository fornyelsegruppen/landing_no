import type { MeasurementInput } from "./types";

export type MeasurementGate = {
  allowed: boolean;
  requiresAdminReview: boolean;
  reasons: string[];
};

export function evaluateMeasurementGate(
  input: MeasurementInput,
  hasApprovedPriceRule: boolean,
  options: { requireApprovedPriceRule?: boolean } = {},
): MeasurementGate {
  const reasons: string[] = [];
  if (!input.addressResolved) reasons.push("address_unresolved");
  if (!input.buildingResolved) reasons.push("building_unresolved");
  if (!input.sourceAuthorized)
    reasons.push("measurement_source_not_authorized");
  if (input.roofPlanes.length === 0) reasons.push("roof_polygon_missing");
  if (
    input.roofPlanes.some(
      (plane) =>
        !Number.isFinite(plane.angleMinDegrees) ||
        !Number.isFinite(plane.angleMaxDegrees),
    )
  ) {
    reasons.push("roof_angle_unknown");
  }
  if ((options.requireApprovedPriceRule ?? true) && !hasApprovedPriceRule) {
    reasons.push("price_rule_not_approved");
  }
  if (input.confidence === "low") reasons.push("confidence_low");

  return {
    allowed: reasons.length === 0,
    requiresAdminReview: input.confidence !== "high" || reasons.length > 0,
    reasons,
  };
}
