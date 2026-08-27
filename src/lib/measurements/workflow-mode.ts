import { readFeatureFlags, type Environment } from "@/lib/platform/features";

/**
 * Keeps measurement-only pilots isolated from pricing and documents.
 * Customer quote activation is the single boundary that allows a measurement
 * action to require a price rule or create a commercial package.
 */
export function measurementWorkflowMode(
  environment: Environment = process.env,
) {
  const commercialPackageEnabled = readFeatureFlags(environment).customerQuotes;

  return {
    commercialPackageEnabled,
    requireApprovedPriceRule: commercialPackageEnabled,
  };
}
