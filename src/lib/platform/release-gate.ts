import {
  featureEnvironmentKeys,
  featureFlagNames,
  featureReadiness,
  type Environment,
  type FeatureFlagName,
} from "./features";

export type ReleaseGateStatus = "disabled" | "no_go" | "go";

const commonEvidence = [
  "STAGING_QA_REFERENCE",
  "RESTORE_TEST_REFERENCE",
  "PRODUCTION_OWNER_APPROVAL_REFERENCE",
] as const;

const featureEvidence: Record<FeatureFlagName, readonly string[]> = {
  aiDrafts: ["AI_CONTENT_PILOT_REFERENCE"],
  roofMeasurement: ["ROOF_TECHNICAL_QA_REFERENCE"],
  customerQuotes: ["PRICING_APPROVAL_REFERENCE", "QUOTE_JOURNEY_QA_REFERENCE"],
  contractSigning: [
    "SIGNATURE_APPROVAL_REFERENCE",
    "CONTRACT_JOURNEY_QA_REFERENCE",
  ],
  workerPortal: ["WORKER_MOBILE_QA_REFERENCE"],
  automatedReminders: ["COMMUNICATION_APPROVAL_REFERENCE"],
  seoScheduler: ["SEO_PILOT_REFERENCE"],
  caseStateEngineV2: ["STATE_INVARIANT_QA_REFERENCE"],
  measurementEvidenceV2: ["ROOF_EVIDENCE_QA_REFERENCE"],
  adminExceptionFlowsV2: ["ADMIN_OPERATIONS_QA_REFERENCE"],
  communicationRoutingV2: ["COMMUNICATION_V2_QA_REFERENCE"],
  customerLifecycleV2: ["CUSTOMER_LIFECYCLE_QA_REFERENCE"],
  securityHardeningV2: ["SECURITY_HARDENING_QA_REFERENCE"],
};

function isConfigured(environment: Environment, key: string) {
  return Boolean(environment[key]?.trim());
}

/**
 * Produces a safe production decision summary. Evidence values are never
 * returned: the dashboard only receives missing environment variable names.
 */
export function buildReleaseGate(environment: Environment = process.env) {
  const features = Object.fromEntries(
    featureFlagNames.map((name) => {
      const readiness = featureReadiness(name, environment);
      const requiredEvidence = [...commonEvidence, ...featureEvidence[name]];
      const missingEvidence = readiness.enabled
        ? requiredEvidence.filter((key) => !isConfigured(environment, key))
        : [];
      const status: ReleaseGateStatus = !readiness.enabled
        ? "disabled"
        : readiness.ready && missingEvidence.length === 0
          ? "go"
          : "no_go";

      return [
        name,
        {
          status,
          flag: featureEnvironmentKeys[name],
          unavailableIntegrations: readiness.unavailable,
          missingEvidence,
        },
      ];
    }),
  ) as Record<
    FeatureFlagName,
    {
      status: ReleaseGateStatus;
      flag: string;
      unavailableIntegrations: ReturnType<
        typeof featureReadiness
      >["unavailable"];
      missingEvidence: string[];
    }
  >;

  const decisions = Object.values(features);
  const enabled = decisions.filter(
    (decision) => decision.status !== "disabled",
  );

  return {
    generatedAt: new Date().toISOString(),
    productionReady:
      enabled.length > 0 &&
      enabled.every((decision) => decision.status === "go"),
    counts: {
      go: decisions.filter((decision) => decision.status === "go").length,
      noGo: decisions.filter((decision) => decision.status === "no_go").length,
      disabled: decisions.filter((decision) => decision.status === "disabled")
        .length,
    },
    features,
  };
}
