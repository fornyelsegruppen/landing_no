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
    ];

    expect(hrefs.every((href) => href.startsWith("/admin-v2/"))).toBe(true);
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
