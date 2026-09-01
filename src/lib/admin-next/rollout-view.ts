import {
  featureReadiness,
  type Environment,
  type FeatureFlagName,
  type IntegrationName,
} from "@/lib/platform/features";
import {
  adminNextModuleDefinitions,
  type AdminNextModuleDefinition,
} from "@/lib/admin-next/capability-registry";

export {
  adminNextModuleDefinitions,
  type AdminNextModuleDefinition,
  type AdminNextModuleId,
} from "@/lib/admin-next/capability-registry";

export type AdminNextRolloutState = "legacy" | "preview" | "active";

export type AdminNextRolloutReason =
  | "disabled"
  | "preview_enabled"
  | "active_enabled"
  | "invalid_mode"
  | "preview_forbidden_in_production"
  | "missing_release_evidence"
  | "non_production_active_is_preview";

export type AdminNextCapabilityState =
  | "legacy_active"
  | "implemented_disabled"
  | "blocked_configuration"
  | "preview_ready"
  | "enabled"
  | "planned";

export type AdminNextModuleView = AdminNextModuleDefinition & {
  state: AdminNextCapabilityState;
  disabledDependencies: FeatureFlagName[];
  unavailableIntegrations: IntegrationName[];
};

export type AdminNextRolloutView = {
  state: AdminNextRolloutState;
  reason: AdminNextRolloutReason;
  releaseReferencePresent: boolean;
  legacyFallbackAvailable: true;
  modules: AdminNextModuleView[];
  counts: Record<AdminNextCapabilityState, number>;
};

function resolveGlobalRollout(environment: Environment) {
  const requestedMode = environment.ADMIN_NEXT_MODE?.trim().toLowerCase();
  const isProduction = environment.VERCEL_ENV === "production";
  const releaseReferencePresent = Boolean(
    environment.ADMIN_NEXT_RELEASE_REFERENCE?.trim(),
  );

  if (!requestedMode || requestedMode === "off") {
    return {
      state: "legacy" as const,
      reason: "disabled" as const,
      releaseReferencePresent,
    };
  }

  if (requestedMode === "preview") {
    return isProduction
      ? {
          state: "legacy" as const,
          reason: "preview_forbidden_in_production" as const,
          releaseReferencePresent,
        }
      : {
          state: "preview" as const,
          reason: "preview_enabled" as const,
          releaseReferencePresent,
        };
  }

  if (requestedMode === "active") {
    if (!isProduction) {
      return {
        state: "preview" as const,
        reason: "non_production_active_is_preview" as const,
        releaseReferencePresent,
      };
    }
    return releaseReferencePresent
      ? {
          state: "active" as const,
          reason: "active_enabled" as const,
          releaseReferencePresent,
        }
      : {
          state: "legacy" as const,
          reason: "missing_release_evidence" as const,
          releaseReferencePresent,
        };
  }

  return {
    state: "legacy" as const,
    reason: "invalid_mode" as const,
    releaseReferencePresent,
  };
}

function resolveModuleView(
  definition: AdminNextModuleDefinition,
  rollout: ReturnType<typeof resolveGlobalRollout>,
  environment: Environment,
): AdminNextModuleView {
  const checks = definition.dependencies.map((dependency) => ({
    dependency,
    readiness: featureReadiness(dependency, environment),
  }));
  const disabledDependencies = checks
    .filter(({ readiness }) => !readiness.enabled)
    .map(({ dependency }) => dependency);
  const unavailableIntegrations = [
    ...new Set(checks.flatMap(({ readiness }) => readiness.unavailable)),
  ];

  let state: AdminNextCapabilityState;
  if (rollout.state === "legacy") state = "legacy_active";
  else if (definition.stage === "planned") state = "planned";
  else if (disabledDependencies.length) state = "implemented_disabled";
  else if (unavailableIntegrations.length) state = "blocked_configuration";
  else if (rollout.state === "active" && definition.stage === "release_ready")
    state = "enabled";
  else state = "preview_ready";

  return {
    ...definition,
    state,
    disabledDependencies,
    unavailableIntegrations,
  };
}

export function buildAdminNextRolloutView(
  environment: Environment = process.env,
): AdminNextRolloutView {
  const rollout = resolveGlobalRollout(environment);
  const modules = adminNextModuleDefinitions.map((definition) =>
    resolveModuleView(definition, rollout, environment),
  );
  const states: AdminNextCapabilityState[] = [
    "legacy_active",
    "implemented_disabled",
    "blocked_configuration",
    "preview_ready",
    "enabled",
    "planned",
  ];

  return {
    ...rollout,
    legacyFallbackAvailable: true,
    modules,
    counts: Object.fromEntries(
      states.map((state) => [
        state,
        modules.filter((module) => module.state === state).length,
      ]),
    ) as Record<AdminNextCapabilityState, number>,
  };
}
