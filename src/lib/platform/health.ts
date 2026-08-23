import {
  featureFlagNames,
  featureReadiness,
  readFeatureFlags,
  readIntegrationStatus,
  type Environment,
} from "./features";

export type PlatformHealth = ReturnType<typeof buildPlatformHealth>;

/**
 * Builds an administrator-safe configuration summary. It deliberately returns
 * environment variable names that are missing, never configured values.
 */
export function buildPlatformHealth(environment: Environment = process.env) {
  const flags = readFeatureFlags(environment);
  const integrations = readIntegrationStatus(environment);

  return {
    generatedAt: new Date().toISOString(),
    features: Object.fromEntries(
      featureFlagNames.map((name) => [
        name,
        {
          ...featureReadiness(name, environment),
          enabled: flags[name],
        },
      ]),
    ),
    integrations,
  };
}
