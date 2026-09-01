import { describe, expect, it } from "vitest";
import {
  adminNextModuleDefinitions,
  buildAdminNextRolloutView,
} from "./rollout-view";

describe("Admin Next rollout view", () => {
  it("keeps the current UI active by default", () => {
    const view = buildAdminNextRolloutView({});

    expect(view).toMatchObject({
      state: "legacy",
      reason: "disabled",
      legacyFallbackAvailable: true,
    });
    expect(view.counts.legacy_active).toBe(5);
    expect(view.modules.every((module) => module.legacyHref)).toBe(true);
  });

  it("fails closed for invalid modes and production previews", () => {
    expect(
      buildAdminNextRolloutView({ ADMIN_NEXT_MODE: "unexpected" }),
    ).toMatchObject({ state: "legacy", reason: "invalid_mode" });
    expect(
      buildAdminNextRolloutView({
        ADMIN_NEXT_MODE: "preview",
        VERCEL_ENV: "production",
      }),
    ).toMatchObject({
      state: "legacy",
      reason: "preview_forbidden_in_production",
    });
  });

  it("allows an isolated preview while keeping unfinished modules explicit", () => {
    const view = buildAdminNextRolloutView({
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
    });

    expect(view.state).toBe("preview");
    expect(view.modules.find(({ id }) => id === "today")?.state).toBe(
      "preview_ready",
    );
    expect(view.modules.find(({ id }) => id === "caseWorkspace")?.state).toBe(
      "preview_ready",
    );
    expect(view.modules.find(({ id }) => id === "roofWorkbench")?.state).toBe(
      "planned",
    );
    expect(
      view.modules.find(({ id }) => id === "documentPreflight")?.state,
    ).toBe("implemented_disabled");
    expect(view.counts.planned).toBe(2);
  });

  it("distinguishes implemented-but-disabled from missing configuration", () => {
    const disabled = buildAdminNextRolloutView({
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
    });
    expect(disabled.modules.find(({ id }) => id === "today")?.state).toBe(
      "implemented_disabled",
    );

    const blocked = buildAdminNextRolloutView({
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
      FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
    });
    expect(
      blocked.modules.find(({ id }) => id === "roofWorkbench")?.state,
    ).toBe("planned");
    expect(
      blocked.modules.find(({ id }) => id === "roofWorkbench")
        ?.unavailableIntegrations,
    ).toEqual(["privateStorage"]);
  });

  it("requires release evidence before production activation", () => {
    expect(
      buildAdminNextRolloutView({
        ADMIN_NEXT_MODE: "active",
        VERCEL_ENV: "production",
      }),
    ).toMatchObject({
      state: "legacy",
      reason: "missing_release_evidence",
      releaseReferencePresent: false,
    });

    expect(
      buildAdminNextRolloutView({
        ADMIN_NEXT_MODE: "active",
        VERCEL_ENV: "production",
        ADMIN_NEXT_RELEASE_REFERENCE: "fp18-pass-195f3d9",
      }),
    ).toMatchObject({
      state: "active",
      reason: "active_enabled",
      releaseReferencePresent: true,
    });
  });

  it("keeps module identifiers and legacy routes unique and complete", () => {
    expect(new Set(adminNextModuleDefinitions.map(({ id }) => id)).size).toBe(
      adminNextModuleDefinitions.length,
    );
    expect(
      adminNextModuleDefinitions.every(({ legacyHref }) =>
        legacyHref.startsWith("/admin-v2"),
      ),
    ).toBe(true);
  });
});
