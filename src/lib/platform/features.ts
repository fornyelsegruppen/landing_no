export const featureFlagNames = [
  "aiDrafts",
  "roofMeasurement",
  "customerQuotes",
  "contractSigning",
  "workerPortal",
  "automatedReminders",
  "seoScheduler",
  "caseStateEngineV2",
  "measurementEvidenceV2",
  "adminExceptionFlowsV2",
  "communicationRoutingV2",
  "customerLifecycleV2",
  "securityHardeningV2",
] as const;

export type FeatureFlagName = (typeof featureFlagNames)[number];
export type FeatureFlags = Record<FeatureFlagName, boolean>;
export type Environment = Readonly<Record<string, string | undefined>>;

export const featureEnvironmentKeys: Record<FeatureFlagName, string> = {
  aiDrafts: "FEATURE_AI_DRAFTS",
  roofMeasurement: "FEATURE_ROOF_MEASUREMENT",
  customerQuotes: "FEATURE_CUSTOMER_QUOTES",
  contractSigning: "FEATURE_CONTRACT_SIGNING",
  workerPortal: "FEATURE_WORKER_PORTAL",
  automatedReminders: "FEATURE_AUTOMATED_REMINDERS",
  seoScheduler: "FEATURE_SEO_SCHEDULER",
  caseStateEngineV2: "FEATURE_CASE_STATE_ENGINE_V2",
  measurementEvidenceV2: "FEATURE_MEASUREMENT_EVIDENCE_V2",
  adminExceptionFlowsV2: "FEATURE_ADMIN_EXCEPTION_FLOWS_V2",
  communicationRoutingV2: "FEATURE_COMMUNICATION_ROUTING_V2",
  customerLifecycleV2: "FEATURE_CUSTOMER_LIFECYCLE_V2",
  securityHardeningV2: "FEATURE_SECURITY_HARDENING_V2",
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
      parseBooleanFlag(environment[featureEnvironmentKeys[name]]),
    ]),
  ) as FeatureFlags;
}

export type IntegrationName =
  "ai" | "email" | "sms" | "maps" | "buildingFootprints" | "imagery" | "signature" | "legal" | "searchData" | "jobs" | "rateLimit" | "botProtection" | "privateStorage";

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

function configuredAny(environment: Environment, keys: readonly string[]) {
  return keys.some((key) => configured(environment, key));
}

export function readIntegrationStatus(
  environment: Environment = process.env,
): Record<IntegrationName, IntegrationStatus> {
  const aiReady = configured(environment, "GEMINI_API_KEY");
  const previewEmailLog = environment.VERCEL_ENV === "preview"
    && parseBooleanFlag(environment.ALLOW_PREVIEW_EMAIL_LOG);
  const emailReady = configured(environment, "RESEND_API_KEY") || previewEmailLog;
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
      provider: configured(environment, "RESEND_API_KEY") ? "resend" : "log",
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
    buildingFootprints: {
      name: "buildingFootprints",
      readiness: "ready",
      provider: "openstreetmap-overpass",
      missing: [],
    },
    imagery: {
      name: "imagery",
      readiness: configured(environment, "NORGE_I_BILDER_TOKEN") && configured(environment, "MAP_TERMS_ACCEPTED_AT") ? "ready" : "configuration_required",
      provider: "norge-i-bilder",
      missing: [
        ...(!configured(environment, "NORGE_I_BILDER_TOKEN") ? ["NORGE_I_BILDER_TOKEN"] : []),
        ...(!configured(environment, "MAP_TERMS_ACCEPTED_AT") ? ["MAP_TERMS_ACCEPTED_AT"] : []),
      ],
    },
    signature: {
      name: "signature",
      readiness: tokenSecretReady ? "ready" : "configuration_required",
      provider: signatureProvider,
      missing: tokenSecretReady
        ? []
        : ["CUSTOMER_TOKEN_SECRET or PAYLOAD_SECRET"],
    },
    legal: {
      name: "legal",
      readiness: configured(environment, "LEGAL_REVIEW_REFERENCE") ? "ready" : "configuration_required",
      provider: "approved-contract-terms",
      missing: configured(environment, "LEGAL_REVIEW_REFERENCE") ? [] : ["LEGAL_REVIEW_REFERENCE"],
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
    rateLimit: {
      name: "rateLimit",
      readiness: configuredAny(environment, ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"]) && configuredAny(environment, ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"]) ? "ready" : "configuration_required",
      provider: "upstash-redis",
      missing: [
        ...(!configuredAny(environment, ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"]) ? ["UPSTASH_REDIS_REST_URL or KV_REST_API_URL"] : []),
        ...(!configuredAny(environment, ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"]) ? ["UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN"] : []),
      ],
    },
    botProtection: {
      name: "botProtection",
      readiness: configured(environment, "TURNSTILE_SECRET_KEY") && configured(environment, "NEXT_PUBLIC_TURNSTILE_SITE_KEY") ? "ready" : "configuration_required",
      provider: "cloudflare-turnstile",
      missing: [
        ...(!configured(environment, "TURNSTILE_SECRET_KEY") ? ["TURNSTILE_SECRET_KEY"] : []),
        ...(!configured(environment, "NEXT_PUBLIC_TURNSTILE_SITE_KEY") ? ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] : []),
      ],
    },
    privateStorage: {
      name: "privateStorage",
      readiness: configured(environment, "BLOB_READ_WRITE_TOKEN") ? "ready" : "configuration_required",
      provider: "vercel-blob-private",
      missing: configured(environment, "BLOB_READ_WRITE_TOKEN") ? [] : ["BLOB_READ_WRITE_TOKEN"],
    },
  };
}

const featureDependencies: Record<FeatureFlagName, IntegrationName[]> = {
  aiDrafts: ["ai"],
  roofMeasurement: ["maps", "buildingFootprints"],
  customerQuotes: ["email", "legal"],
  contractSigning: ["signature", "email", "legal"],
  workerPortal: [],
  automatedReminders: ["email", "jobs"],
  seoScheduler: ["ai", "jobs"],
  caseStateEngineV2: [],
  measurementEvidenceV2: ["maps", "buildingFootprints"],
  adminExceptionFlowsV2: [],
  communicationRoutingV2: ["email", "jobs"],
  customerLifecycleV2: ["email", "legal"],
  securityHardeningV2: ["signature", "rateLimit", "botProtection", "privateStorage"],
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
