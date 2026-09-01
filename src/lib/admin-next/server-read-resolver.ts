import type { Environment } from "@/lib/platform/features";
import type { UserRole } from "@/payload/access/roles";
import { adminNextModuleDefinition, type AdminNextModuleId } from "@/lib/admin-next/capability-registry";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import type { AdminNextRolloutView } from "@/lib/admin-next/rollout-view";

export type AdminNextServerReadSelection<T> =
  | { kind: "canonical_read"; adapter: T }
  | { kind: "fixture_fallback"; adapter: T; reason: "canonical_unavailable" | "non_preview_environment" }
  | { kind: "legacy_fallback"; href: string; reason: "access_denied" | "production_denied" | "rollout_denied" };

export function resolveAdminNextServerRead<T>(input: {
  moduleId: AdminNextModuleId;
  rollout: AdminNextRolloutView;
  environment?: Environment;
  audience?: "admin" | "worker";
  role: UserRole;
  canonical?: T;
  fixture: T;
}): AdminNextServerReadSelection<T> {
  const environment = input.environment || process.env;
  const audience = input.audience || "admin";
  const access = resolveAdminNextPreviewAccess(input.rollout, input.moduleId, audience);
  const definition = adminNextModuleDefinition(input.moduleId);
  const fallbackHref = audience === "worker" && definition.workerLegacyHref
    ? definition.workerLegacyHref
    : definition.legacyHref;
  const roleAllowed = audience === "admin" ? input.role === "admin" : input.role === "admin" || input.role === "worker";
  if (!roleAllowed) {
    return { kind: "legacy_fallback", href: access.kind === "legacy_fallback" ? access.href : fallbackHref, reason: "access_denied" };
  }
  if (environment.VERCEL_ENV === "production") {
    return { kind: "legacy_fallback", href: access.kind === "legacy_fallback" ? access.href : fallbackHref, reason: "production_denied" };
  }
  if (access.kind !== "allow_preview") {
    return { kind: "legacy_fallback", href: access.kind === "legacy_fallback" ? access.href : fallbackHref, reason: "rollout_denied" };
  }
  if (environment.VERCEL_ENV !== "preview") {
    return { kind: "fixture_fallback", adapter: input.fixture, reason: "non_preview_environment" };
  }
  if (!input.canonical) {
    return { kind: "fixture_fallback", adapter: input.fixture, reason: "canonical_unavailable" };
  }
  return { kind: "canonical_read", adapter: input.canonical };
}
