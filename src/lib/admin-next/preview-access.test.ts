import { describe, expect, it } from "vitest";
import { adminNextModuleDefinitions } from "@/lib/admin-next/capability-registry";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";

describe("Admin Next protected Preview access matrix", () => {
  it("falls back every module while rollout is off", () => {
    const rollout = buildAdminNextRolloutView({});
    for (const definition of adminNextModuleDefinitions) {
      expect(resolveAdminNextPreviewAccess(rollout, definition.id)).toEqual({
        kind: "legacy_fallback",
        moduleId: definition.id,
        href: definition.legacyHref,
        reason: "rollout_legacy",
      });
    }
  });

  it("allows only modules whose Preview dependencies are ready", () => {
    const rollout = buildAdminNextRolloutView({
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
    });

    expect(resolveAdminNextPreviewAccess(rollout, "today").kind).toBe(
      "allow_preview",
    );
    expect(resolveAdminNextPreviewAccess(rollout, "caseWorkspace").kind).toBe(
      "allow_preview",
    );
    expect(resolveAdminNextPreviewAccess(rollout, "roofWorkbench")).toMatchObject({
      kind: "legacy_fallback",
      reason: "preview_not_ready",
    });
    expect(resolveAdminNextPreviewAccess(rollout, "fieldVisit")).toMatchObject({
      kind: "legacy_fallback",
      reason: "preview_not_ready",
    });
  });

  it("does not activate adapter-only modules in production active mode", () => {
    const rollout = buildAdminNextRolloutView({
      ADMIN_NEXT_MODE: "active",
      VERCEL_ENV: "production",
      ADMIN_NEXT_RELEASE_REFERENCE: "owner-go-reference",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
      FEATURE_WORKER_PORTAL: "true",
    });

    for (const definition of adminNextModuleDefinitions) {
      expect(resolveAdminNextPreviewAccess(rollout, definition.id)).toMatchObject({
        kind: "legacy_fallback",
        reason: "active_not_enabled",
      });
    }
  });

  it("returns the working portal fallback for the worker audience", () => {
    expect(
      resolveAdminNextPreviewAccess(
        buildAdminNextRolloutView({}),
        "fieldVisit",
        "worker",
      ),
    ).toMatchObject({ kind: "legacy_fallback", href: "/user" });
  });
});
