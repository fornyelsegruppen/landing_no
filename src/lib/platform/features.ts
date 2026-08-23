export const featureFlagNames = [
  "aiDrafts",
  "roofMeasurement",
  "customerQuotes",
  "contractSigning",
  "workerPortal",
  "automatedReminders",
  "seoScheduler",
] as const;

export type FeatureFlagName = (typeof featureFlagNames)[number];
export type FeatureFlags = Record<FeatureFlagName, boolean>;
export type Environment = Readonly<Record<string, string | undefined>>;

const environmentKeys: Record<FeatureFlagName, string> = {
  aiDrafts: "FEATURE_AI_DRAFTS",
  roofMeasurement: "FEATURE_ROOF_MEASUREMENT",
  customerQuotes: "FEATURE_CUSTOMER_QUOTES",
  contractSigning: "FEATURE_CONTRACT_SIGNING",
  workerPortal: "FEATURE_WORKER_PORTAL",
  automatedReminders: "FEATURE_AUTOMATED_REMINDERS",
  seoScheduler: "FEATURE_SEO_SCHEDULER",
};

function parseBooleanFlag(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function readFeatureFlags(
  environment: Environment = process.env,
): FeatureFlags {
  return Object.fromEntries(
    featureFlagNames.map((name) => [
      name,
      parseBooleanFlag(environment[environmentKeys[name]]),
    ]),
  ) as FeatureFlags;
}

export type IntegrationName =
  "ai" | "email" | "sms" | "maps" | "signature" | "searchData" | "jobs";

export type IntegrationReadiness =
  "ready" | "configuration_required" | "disabled";

export type IntegrationStatus = {
  name: IntegrationName;
  readiness: IntegrationReadiness;
  provider: string;
  missing: string[];
};

function configured(environment: Environment, key: string) {
  return Boolean(environment[key]?.trim());
}

export function readIntegrationStatus(
  environment: Environment = process.env,
): Record<IntegrationName, IntegrationStatus> {
  const aiReady = configured(environment, "GEMINI_API_KEY");
  const emailReady = configured(environment, "RESEND_API_KEY");
  const smsProvider = environment.SMS_PROVIDER?.trim() || "disabled";
  const smsReady =
    smsProvider !== "disabled" && configured(environment, "SMS_API_KEY");
  const signatureProvider =
    environment.SIGNATURE_PROVIDER?.trim() || "internal";
  const tokenSecretReady =
    configured(environment, "CUSTOMER_TOKEN_SECRET") ||
    configured(environment, "PAYLOAD_SECRET");
  const searchReady =
    configured(environment, "GOOGLE_SEARCH_CONSOLE_CREDENTIALS") ||
    configured(environment, "SEO_IMPORT_BUCKET");
  const cronReady = configured(environment, "CRON_SECRET");

  return {
    ai: {
      name: "ai",
      readiness: aiReady ? "ready" : "configuration_required",
      provider: aiReady ? "gemini" : "fake",
      missing: aiReady ? [] : ["GEMINI_API_KEY"],
    },
    email: {
      name: "email",
      readiness: emailReady ? "ready" : "configuration_required",
      provider: emailReady ? "resend" : "log",
      missing: emailReady ? [] : ["RESEND_API_KEY"],
    },
    sms: {
      name: "sms",
      readiness:
        smsProvider === "disabled"
          ? "disabled"
          : smsReady
            ? "ready"
            : "configuration_required",
      provider: smsProvider,
      missing: smsReady || smsProvider === "disabled" ? [] : ["SMS_API_KEY"],
    },
    maps: {
      name: "maps",
      readiness: "ready",
      provider: "kartverket-address",
      missing: [],
    },
    signature: {
      name: "signature",
      readiness: tokenSecretReady ? "ready" : "configuration_required",
      provider: signatureProvider,
      missing: tokenSecretReady
        ? []
        : ["CUSTOMER_TOKEN_SECRET or PAYLOAD_SECRET"],
    },
    searchData: {
      name: "searchData",
      readiness: searchReady ? "ready" : "configuration_required",
      provider: searchReady ? "google-or-import" : "manual",
      missing: searchReady
        ? []
        : ["GOOGLE_SEARCH_CONSOLE_CREDENTIALS or SEO_IMPORT_BUCKET"],
    },
    jobs: {
      name: "jobs",
      readiness: cronReady ? "ready" : "configuration_required",
      provider: "vercel-cron",
      missing: cronReady ? [] : ["CRON_SECRET"],
    },
  };
}

const featureDependencies: Record<FeatureFlagName, IntegrationName[]> = {
  aiDrafts: ["ai"],
  roofMeasurement: ["maps"],
  customerQuotes: ["email", "signature"],
  contractSigning: ["signature", "email"],
  workerPortal: [],
  automatedReminders: ["email", "jobs"],
  seoScheduler: ["ai", "jobs"],
};

export function featureReadiness(
  feature: FeatureFlagName,
  environment: Environment = process.env,
) {
  const flags = readFeatureFlags(environment);
  const integrations = readIntegrationStatus(environment);
  const unavailable = featureDependencies[feature].filter(
    (name) => integrations[name].readiness !== "ready",
  );

  return {
    enabled: flags[feature],
    ready: flags[feature] && unavailable.length === 0,
    unavailable,
  };
}

export class FeatureUnavailableError extends Error {
  constructor(
    readonly feature: FeatureFlagName,
    readonly reason: "disabled" | "configuration_required",
    readonly unavailable: IntegrationName[] = [],
  ) {
    super(
      reason === "disabled"
        ? `Feature ${feature} is disabled`
        : `Feature ${feature} requires configuration: ${unavailable.join(", ")}`,
    );
    this.name = "FeatureUnavailableError";
  }
}

export function assertFeatureReady(
  feature: FeatureFlagName,
  environment: Environment = process.env,
) {
  const status = featureReadiness(feature, environment);
  if (!status.enabled) {
    throw new FeatureUnavailableError(feature, "disabled");
  }
  if (!status.ready) {
    throw new FeatureUnavailableError(
      feature,
      "configuration_required",
      status.unavailable,
    );
  }
}
