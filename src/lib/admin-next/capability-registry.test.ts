import { describe, expect, it } from "vitest";
import {
  adminNextCanonicalCapabilityIds,
  adminNextCanonicalCapabilityRegistry,
  adminNextModuleCanServeCanonical,
  adminNextModuleDefinitions,
  adminNextReadCapabilityIds,
  adminNextReadCapabilityRegistry,
  adminNextRoleHasReadCapability,
  adminNextRoofFusionActionCapabilityIds,
  adminNextRoofFusionI1TargetContract,
} from "@/lib/admin-next/capability-registry";

describe("Admin Next capability registry", () => {
  it("defines an explicit fail-closed Preview mutation boundary for every canonical capability", () => {
    expect(Object.keys(adminNextCanonicalCapabilityRegistry).sort()).toEqual(
      [...adminNextCanonicalCapabilityIds].sort(),
    );
    for (const contract of Object.values(
      adminNextCanonicalCapabilityRegistry,
    )) {
      expect(["forbidden", "preview_limited"]).toContain(
        contract.previewMutationPolicy,
      );
      expect(contract.readContract).toBeTruthy();
      expect(contract.mutationOwner).toBeTruthy();
    }
    expect(
      Object.entries(adminNextCanonicalCapabilityRegistry)
        .filter(([, value]) => value.previewMutationPolicy === "preview_limited")
        .map(([key]) => key),
    ).toEqual(["Case", "Property", "Roof"]);
  });

  it("gates case audit reads to the existing admin role", () => {
    expect(Object.keys(adminNextReadCapabilityRegistry).sort()).toEqual(
      [...adminNextReadCapabilityIds].sort(),
    );
    expect(
      adminNextCanonicalCapabilityRegistry.Case.readCapabilities,
    ).toContain("audit.read");
    expect(adminNextRoleHasReadCapability("admin", "audit.read")).toBe(true);
    expect(adminNextRoleHasReadCapability("worker", "audit.read")).toBe(false);
    expect(adminNextReadCapabilityRegistry["audit.read"]).toMatchObject({
      mode: "read_only",
      source: "audit-events",
    });
  });

  it("records read adapters and limits new mutations to the case and roof Preview modules", () => {
    expect(new Set(adminNextModuleDefinitions.map(({ id }) => id)).size).toBe(
      adminNextModuleDefinitions.length,
    );
    for (const definition of adminNextModuleDefinitions) {
      expect(definition.capabilities.length).toBeGreaterThan(0);
      expect([
        "fixture_only",
        "canonical_read_with_fixture_fallback",
      ]).toContain(definition.previewAdapter);
      expect(["legacy_only", "preview_limited"]).toContain(
        definition.mutationPolicy,
      );
      expect(["legacy_only", "shadow_read", "preview", "canonical"]).toContain(
        definition.rolloutStage,
      );
      expect(definition.legacyHref).toMatch(/^\/(admin-v2|user)\b/);
      for (const capability of definition.capabilities) {
        expect(adminNextCanonicalCapabilityRegistry[capability]).toBeDefined();
      }
    }
    expect(
      adminNextModuleDefinitions
        .filter(({ id }) => id !== "documentPreflight")
        .every(
          ({ previewAdapter }) =>
            previewAdapter === "canonical_read_with_fixture_fallback",
        ),
    ).toBe(true);
    expect(
      adminNextModuleDefinitions.find(({ id }) => id === "documentPreflight")
        ?.previewAdapter,
    ).toBe("fixture_only");
    expect(
      adminNextModuleDefinitions
        .filter(({ mutationPolicy }) => mutationPolicy === "preview_limited")
        .map(({ id }) => id),
    ).toEqual(["caseWorkspace", "roofWorkbench"]);
  });

  it("keeps every F1 module out of canonical rollout until its domain gate passes", () => {
    expect(
      adminNextModuleDefinitions.every(
        ({ rolloutStage }) => rolloutStage === "preview",
      ),
    ).toBe(true);
    expect(adminNextModuleCanServeCanonical("today")).toBe(false);
  });

  it("does not claim release readiness for an adapter-only slice", () => {
    expect(
      adminNextModuleDefinitions.some(({ stage }) => stage === "release_ready"),
    ).toBe(false);
  });

  it("records the accepted I1 target and its Preview read adapters", () => {
    expect(adminNextCanonicalCapabilityRegistry.Roof).toMatchObject({
      canonicalSource: "roof-measurements",
      maturity: "legacy_bridge",
      targetCanonicalSource: "append-only roof-snapshot.v1 repository",
    });
    expect(adminNextRoofFusionActionCapabilityIds).toHaveLength(11);
    expect(new Set(adminNextRoofFusionActionCapabilityIds).size).toBe(11);
    expect(adminNextRoofFusionI1TargetContract).toMatchObject({
      status: "r4_preview_mutation_gated",
      featureGate: "roofFusionV1",
      previewMutationPolicy: "preview_limited",
      downstreamReadPolicy: "approved_renderer_envelope_only",
    });
    expect(adminNextRoofFusionI1TargetContract.adminReadAdapter).toContain(
      "AdminRoofFusionPreviewReadAdapterV1",
    );
    expect(adminNextRoofFusionI1TargetContract.workerReadAdapter).toContain(
      "WorkerRoofFusionPreviewRendererAdapterV1",
    );
    expect(adminNextRoofFusionI1TargetContract.r4ReadRoute).toContain(
      "[measurementId]/page.tsx",
    );
    expect(adminNextRoofFusionI1TargetContract.previewUatHarness).toContain(
      "roof-fusion/uat/page.tsx#prepareR4Uat",
    );
    expect(
      adminNextModuleDefinitions.find(({ id }) => id === "roofWorkbench")
        ?.stage,
    ).toBe("adapter_ready");
    expect(
      adminNextModuleDefinitions.find(({ id }) => id === "roofWorkbench")
        ?.dependencies,
    ).toEqual(["roofFusionV1"]);
  });
});
