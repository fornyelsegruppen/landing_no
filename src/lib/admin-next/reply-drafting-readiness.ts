import {
  featureReadiness,
  readIntegrationStatus,
  type Environment,
} from "@/lib/platform/features";

export type AdminNextReplyDraftingReadiness = {
  ai: {
    blockers: readonly ("FEATURE_AI_DRAFTS=false" | "GEMINI_API_KEY")[];
    state: "ready" | "feature_disabled" | "provider_configuration_required";
  };
  manual: {
    state: "ready";
  };
};

/**
 * Exposes only operator-actionable configuration names. Environment values and
 * provider secrets must never cross the server/client boundary.
 */
export function adminNextReplyDraftingReadiness(
  environment: Environment = process.env,
): AdminNextReplyDraftingReadiness {
  const feature = featureReadiness("aiDrafts", environment);
  if (!feature.enabled) {
    return {
      ai: {
        blockers: ["FEATURE_AI_DRAFTS=false"],
        state: "feature_disabled",
      },
      manual: { state: "ready" },
    };
  }

  const integration = readIntegrationStatus(environment).ai;
  if (!feature.ready || integration.readiness !== "ready") {
    return {
      ai: {
        blockers: ["GEMINI_API_KEY"],
        state: "provider_configuration_required",
      },
      manual: { state: "ready" },
    };
  }

  return {
    ai: { blockers: [], state: "ready" },
    manual: { state: "ready" },
  };
}
