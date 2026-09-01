import {
  adminNextModuleDefinition,
  type AdminNextModuleId,
} from "@/lib/admin-next/capability-registry";
import type { AdminNextRolloutView } from "@/lib/admin-next/rollout-view";

export type AdminNextPreviewAccessDecision =
  | { kind: "allow_preview"; moduleId: AdminNextModuleId }
  | { kind: "allow_active"; moduleId: AdminNextModuleId }
  | {
      kind: "legacy_fallback";
      moduleId: AdminNextModuleId;
      href: string;
      reason:
        | "rollout_legacy"
        | "module_unavailable"
        | "preview_not_ready"
        | "active_not_enabled";
    };

export function resolveAdminNextPreviewAccess(
  rollout: AdminNextRolloutView,
  moduleId: AdminNextModuleId,
  audience: "admin" | "worker" = "admin",
): AdminNextPreviewAccessDecision {
  const definition = adminNextModuleDefinition(moduleId);
  const fallbackHref =
    audience === "worker" && definition.workerLegacyHref
      ? definition.workerLegacyHref
      : definition.legacyHref;
  const moduleView = rollout.modules.find((item) => item.id === moduleId);

  if (rollout.state === "legacy") {
    return {
      kind: "legacy_fallback",
      moduleId,
      href: fallbackHref,
      reason: "rollout_legacy",
    };
  }
  if (!moduleView) {
    return {
      kind: "legacy_fallback",
      moduleId,
      href: fallbackHref,
      reason: "module_unavailable",
    };
  }
  if (rollout.state === "preview") {
    return moduleView.state === "preview_ready"
      ? { kind: "allow_preview", moduleId }
      : {
          kind: "legacy_fallback",
          moduleId,
          href: fallbackHref,
          reason: "preview_not_ready",
        };
  }
  return moduleView.state === "enabled"
    ? { kind: "allow_active", moduleId }
    : {
        kind: "legacy_fallback",
        moduleId,
        href: fallbackHref,
        reason: "active_not_enabled",
      };
}
