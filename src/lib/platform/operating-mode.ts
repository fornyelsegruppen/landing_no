import {
  featureFlagNames,
  readFeatureFlags,
  type Environment,
  type FeatureFlagName,
} from "./features";

export type PlatformOperatingMode = "controlled_pilot" | "full_automation";

function configuredFalse(value: string | undefined) {
  return value?.trim().toLowerCase() === "false" || value?.trim() === "0";
}

/**
 * Commercial and operational automation is fail-closed in Production. New
 * customer requests and explicitly approved message deliveries remain usable.
 */
export function automaticCommunicationIsPaused(
  environment: Environment = process.env,
) {
  const configured = environment.AUTOMATION_EMERGENCY_PAUSE;
  if (configured?.trim()) return !configuredFalse(configured);
  return environment.VERCEL_ENV === "production";
}

export function buildOperatingMode(environment: Environment = process.env) {
  const flags = readFeatureFlags(environment);
  const enabledFeatures = featureFlagNames.filter((name) => flags[name]);
  const disabledFeatures = featureFlagNames.filter((name) => !flags[name]);
  const requestedMode = environment.PLATFORM_OPERATING_MODE?.trim();
  const realPilotCompleted = Boolean(
    environment.LEAD_INBOX_PILOT_REFERENCE?.trim() &&
    environment.ROOF_VALIDATION_REFERENCE?.trim(),
  );
  const mode: PlatformOperatingMode =
    requestedMode === "full_automation" && realPilotCompleted
      ? "full_automation"
      : "controlled_pilot";

  return {
    mode,
    activeWave: environment.PLATFORM_ACTIVE_WAVE?.trim() || "PROD-8.0",
    enabledFeatures: enabledFeatures as FeatureFlagName[],
    disabledFeatures: disabledFeatures as FeatureFlagName[],
    automaticCommunicationPaused: automaticCommunicationIsPaused(environment),
  };
}
