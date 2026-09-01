import { describe, expect, it } from "vitest";
import {
  adminNextCanonicalCapabilityIds,
  adminNextCanonicalCapabilityRegistry,
  adminNextModuleDefinitions,
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

  it("keeps every Preview module fixture-only with a legacy mutation owner", () => {
    expect(new Set(adminNextModuleDefinitions.map(({ id }) => id)).size).toBe(
      adminNextModuleDefinitions.length,
    );
    for (const definition of adminNextModuleDefinitions) {
      expect(definition.capabilities.length).toBeGreaterThan(0);
      expect(definition.previewAdapter).toBe("fixture_only");
      expect(definition.mutationPolicy).toBe("legacy_only");
      expect(definition.legacyHref).toMatch(/^\/(admin-v2|user)\b/);
      for (const capability of definition.capabilities) {
        expect(adminNextCanonicalCapabilityRegistry[capability]).toBeDefined();
      }
    }
  });

  it("does not claim release readiness for an adapter-only slice", () => {
    expect(
      adminNextModuleDefinitions.some(({ stage }) => stage === "release_ready"),
    ).toBe(false);
  });
});
