import { describe, expect, it } from "vitest";
import {
  roofFusionCapabilityAllowsActorV1,
  roofFusionCapabilityContractV1,
} from "./capability-contract-v1";

describe("Roof Fusion I1 capability boundary", () => {
  it("keeps the full snapshot and evidence administrator-only", () => {
    expect(
      roofFusionCapabilityContractV1.capabilities["roof_fusion.snapshot.read"],
    ).toEqual({
      actors: ["administrator"],
      payload: "roof-snapshot.v1",
      scope: "case_scoped_internal",
    });
    expect(
      roofFusionCapabilityAllowsActorV1(
        "roof_fusion.snapshot.read",
        "assigned_worker",
      ),
    ).toBe(false);
    expect(
      roofFusionCapabilityAllowsActorV1(
        "roof_fusion.evidence.read",
        "customer",
      ),
    ).toBe(false);
  });

  it("allows workers only through the approved renderer envelope", () => {
    expect(
      roofFusionCapabilityAllowsActorV1(
        "roof_fusion.renderer.read_approved",
        "assigned_worker",
      ),
    ).toBe(true);
    expect(
      roofFusionCapabilityContractV1.capabilities[
        "roof_fusion.renderer.read_approved"
      ].payload,
    ).toBe("approved-roof-renderer-envelope.v1");
  });

  it("records the independent fail-closed Preview activation", () => {
    expect(roofFusionCapabilityContractV1).toMatchObject({
      schemaVersion: "roof-fusion-capabilities.v1",
      featureGate: "roofFusionV1",
      activation: "preview_only_fail_closed",
    });
  });
});
