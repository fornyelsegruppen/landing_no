import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  assertReady: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/security/cron-auth", () => ({ cronRequestAuthorized: mocks.authorized }));
vi.mock("@/lib/platform/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform/features")>();
  return { ...actual, assertFeatureReady: mocks.assertReady };
});
vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ find: mocks.find, update: mocks.update })) }));

import { GET } from "./route";

describe("scheduled post publishing cron", () => {
  beforeEach(() => {
    mocks.authorized.mockReset().mockReturnValue(true);
    mocks.assertReady.mockReset();
    mocks.find.mockReset().mockResolvedValue({
      docs: [{ id: 8, editorialStatus: "scheduled", reviewerName: "Kari", reviewedAt: "2026-08-27T08:00:00.000Z" }],
    });
    mocks.update.mockReset().mockResolvedValue({ id: 8, _status: "published" });
  });

  it("rejects requests without cron authorization", async () => {
    mocks.authorized.mockReturnValue(false);

    const response = await GET(new Request("https://www.takfornyelse.as/api/cron/publish-posts"));

    expect(response.status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("selects only administrator-reviewed scheduled drafts", async () => {
    const response = await GET(new Request("https://www.takfornyelse.as/api/cron/publish-posts"));

    expect(response.status).toBe(200);
    expect(mocks.assertReady).toHaveBeenCalledWith("seoScheduler");
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "posts",
      draft: true,
      where: { and: expect.arrayContaining([
        { _status: { equals: "draft" } },
        { editorialStatus: { equals: "scheduled" } },
      ]) },
    }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "posts",
      id: 8,
      draft: false,
      data: { _status: "published" },
    }));
  });
});
