import { describe, expect, it } from "vitest";
import {
  adminNextCanonicalCapabilityIds,
  adminNextCanonicalCapabilityRegistry,
  adminNextModuleDefinitions,
  adminNextRoofFusionActionCapabilityIds,
  adminNextRoofFusionI1TargetContract,
} from "@/lib/admin-next/capability-registry";

describe("Admin Next capability registry", () => {
  it("defines one fail-closed boundary for every canonical capability", () => {
    expect(Object.keys(adminNextCanonicalCapabilityRegistry).sort()).toEqual(
      [...adminNextCanonicalCapabilityIds].sort(),
    );
    for (const contract of Object.values(adminNextCanonicalCapabilityRegistry)) {
      expect(contract.previewMutationPolicy).toBe("forbidden");
      expect(contract.readContract).toBeTruthy();
      expect(contract.mutationOwner).toBeTruthy();
    }
  });

  it("records read adapters while keeping every mutation on the legacy owner", () => {
    expect(new Set(adminNextModuleDefinitions.map(({ id }) => id)).size).toBe(
      adminNextModuleDefinitions.length,
    );
    for (const definition of adminNextModuleDefinitions) {
      expect(definition.capabilities.length).toBeGreaterThan(0);
      expect(["fixture_only", "canonical_read_with_fixture_fallback"]).toContain(
        definition.previewAdapter,
      );
      expect(definition.mutationPolicy).toBe("legacy_only");
      expect(definition.legacyHref).toMatch(/^\/(admin-v2|user)\b/);
      for (const capability of definition.capabilities) {
        expect(adminNextCanonicalCapabilityRegistry[capability]).toBeDefined();
      }
    }
    expect(
      adminNextModuleDefinitions
        .filter(({ id }) => id !== "documentPreflight")
        .every(({ previewAdapter }) => previewAdapter === "canonical_read_with_fixture_fallback"),
    ).toBe(true);
    expect(
      adminNextModuleDefinitions.find(({ id }) => id === "documentPreflight")
        ?.previewAdapter,
    ).toBe("fixture_only");
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
    expect(adminNextRoofFusionActionCapabilityIds).toHaveLength(7);
    expect(new Set(adminNextRoofFusionActionCapabilityIds).size).toBe(7);
    expect(adminNextRoofFusionI1TargetContract).toMatchObject({
      status: "r4_preview_read_wired",
      featureGate: "roofFusionV1",
      previewMutationPolicy: "forbidden",
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
      "preview-uat/route.ts#POST",
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
