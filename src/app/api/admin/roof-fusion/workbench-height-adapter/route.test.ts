import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAdmin: vi.fn(),
  assertCase: vi.fn(),
  readDraft: vi.fn(),
  invoke: vi.fn(),
  previewError: class extends Error { constructor(readonly code: string, message: string) { super(message); } },
}));

const storedDraft = {
  draftId: "draft-1", caseId: "lead:13", draftHash: "a".repeat(64),
  actor: { actorId: "7" },
};

vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ auth: mocks.auth })) }));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.isAdmin }));
vi.mock("@/lib/roof-fusion/preview-read-adapters-v1", () => ({
  assertRoofFusionPreviewEnabledV1: vi.fn(),
  RoofFusionPreviewReadErrorV1: mocks.previewError,
  PayloadRoofFusionCaseAuthorizationV1: vi.fn(function () { return { assertAdminCaseAccess: mocks.assertCase }; }),
}));
vi.mock("@/lib/roof-fusion/workbench-draft-repository-v1", () => ({
  PayloadRoofFusionWorkbenchDraftRepositoryV1: vi.fn(function () { return { readDraft: mocks.readDraft }; }),
}));
vi.mock("@/lib/roof-fusion/workbench-height-adapter-v1", () => ({
  invokeWorkbenchHeightAdapterV1: mocks.invoke,
  RoofFusionWorkbenchHeightAdapterErrorV1: class extends Error {},
}));

import { POST } from "./route";

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify({
      caseId: "lead:13", draftId: "draft-1", draftHash: "a".repeat(64),
      targetSnapshotId: "snapshot-1", idempotencyKey: "height-adapter:13:1",
      heightSurface: {}, orthophoto: {}, ...overrides,
    }),
  });
}

describe("POST /api/admin/roof-fusion/workbench-height-adapter", () => {
  beforeEach(() => {
    mocks.auth.mockReset(); mocks.isAdmin.mockReset(); mocks.assertCase.mockReset(); mocks.readDraft.mockReset(); mocks.invoke.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: 7, role: "admin" } });
    mocks.isAdmin.mockReturnValue(true);
  });

  it("invokes the height adapter only for the stored, authorized draft revision", async () => {
    mocks.readDraft.mockResolvedValue(storedDraft);
    mocks.invoke.mockReturnValue({
      summary: { status: "review_required", pricingReady: false },
      snapshot: { snapshotId: "snapshot-1", state: "review_required", measurement: { class: "preliminary" } },
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "review_required", pricingReady: false });
    expect(mocks.readDraft).toHaveBeenCalledWith("lead:13", "draft-1");
    expect(mocks.invoke).toHaveBeenCalledWith(expect.objectContaining({ draft: storedDraft, heightSurface: {}, orthophoto: {} }));
  });

  it("fails closed before invocation if the case draft hash is stale", async () => {
    mocks.readDraft.mockResolvedValue({ ...storedDraft, draftHash: "b".repeat(64) });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("fails closed for a caller that is not an administrator", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.readDraft).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
