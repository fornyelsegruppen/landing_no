import { describe, expect, it } from "vitest";
import {
  loadAdminNextCaseWorkspace,
  type AdminNextCaseWorkspaceAdapter,
} from "@/lib/admin-next/case-workspace-contract";
import {
  adminNextCaseWorkspaceFixture,
  adminNextFixtureCaseWorkspaceAdapter,
} from "@/lib/admin-next/case-workspace-fixture";

describe("Admin Next Case Workspace adapter boundary", () => {
  it("normalizes references before calling the replaceable adapter", async () => {
    let received = "";
    const adapter: AdminNextCaseWorkspaceAdapter = {
      async load(reference) {
        received = reference;
        return { status: "not_found" };
      },
    };

    await loadAdminNextCaseWorkspace(adapter, " tf-1042 ");
    expect(received).toBe("TF-1042");
  });

  it("returns a deterministic fixture without exposing mutable source data", async () => {
    const result = await loadAdminNextCaseWorkspace(
      adminNextFixtureCaseWorkspaceAdapter,
      "TF-1042",
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.source).toBe("fixture");
    expect(result.value.reference).toBe("TF-1042");
    expect(result.value.evidence).toHaveLength(4);
    expect(result.value.measurementReview?.areaSquareMeters).toBe(186.4);
    expect(result.value.measurementReview?.confidencePercent).toBe(82);
    expect(result.value.measurementReview?.planes).toHaveLength(7);
    expect(result.value.measurementReview?.reviewEdges).toHaveLength(2);
    expect(result.value.measurementReview?.primarySlopes).toHaveLength(4);
    expect(result.value.measurementReview?.photos).toHaveLength(3);
    expect(result.value.measurementReview?.verificationGates).toHaveLength(4);
    expect(new Set(result.value.timeline.map(({ id }) => id)).size).toBe(
      result.value.timeline.length,
    );
  });

  it("keeps every interactive destination inside the working admin surface", () => {
    const hrefs = [
      adminNextCaseWorkspaceFixture.fallback.caseHref,
      adminNextCaseWorkspaceFixture.fallback.documentsHref,
      adminNextCaseWorkspaceFixture.fallback.workHref,
      ...adminNextCaseWorkspaceFixture.evidence.map(({ fallbackHref }) =>
        fallbackHref,
      ),
      adminNextCaseWorkspaceFixture.measurementReview?.fallbackHref || "",
    ];

    expect(hrefs.every((href) => href.startsWith("/admin-v2/"))).toBe(true);
  });

  it("keeps the R4 plane sum aligned with the presented total", () => {
    const measurement = adminNextCaseWorkspaceFixture.measurementReview;
    expect(measurement).toBeDefined();
    const sum = measurement?.planes.reduce(
      (total, plane) => total + plane.areaSquareMeters,
      0,
    );
    expect(sum).toBeCloseTo(measurement?.areaSquareMeters || 0, 5);
    const primarySlopeSum = measurement?.primarySlopes.reduce(
      (total, slope) => total + slope.areaSquareMeters,
      0,
    );
    expect(primarySlopeSum).toBeCloseTo(
      measurement?.areaSquareMeters || 0,
      5,
    );
  });

  it("keeps PS-SEND-007 blocked until the exact measurement review completes", () => {
    const preflight = adminNextCaseWorkspaceFixture.documentPreflight;
    expect(preflight).toBeDefined();
    expect(preflight?.state).toBe("blocked");
    expect(preflight?.policyCode).toBe("PS-SEND-007");
    expect(preflight?.artifacts).toHaveLength(6);
    expect(
      preflight?.artifacts.find(({ id }) => id === "measurement")?.state,
    ).toBe("review_required");
    expect(preflight?.sequence.map(({ id }) => id)).toEqual([
      "measurement_review",
      "reload",
      "verify_artifacts",
      "owner_gate",
      "send",
    ]);
    expect(preflight?.sequence.at(-1)?.state).toBe("locked");
  });

  it("fails closed for an unknown fixture reference", async () => {
    await expect(
      loadAdminNextCaseWorkspace(
        adminNextFixtureCaseWorkspaceAdapter,
        "TF-DOES-NOT-EXIST",
      ),
    ).resolves.toEqual({ status: "not_found" });
  });
});
