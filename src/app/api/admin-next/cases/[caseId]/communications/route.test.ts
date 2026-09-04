import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  loadPage: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    count: vi.fn(),
    find: vi.fn(),
    findByID: mocks.findByID,
  })),
}));

vi.mock("@/lib/admin-next/case-communication-read", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/admin-next/case-communication-read")
    >();
  return {
    ...original,
    loadAdminNextCaseCommunicationPage: mocks.loadPage,
  };
});

import { GET } from "./route";

const context = { params: Promise.resolve({ caseId: "TF-13" }) };

describe("Admin Next communication history route", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.findByID.mockReset();
    mocks.loadPage.mockReset();
  });

  it("does not expose customer messages without an authenticated admin", async () => {
    mocks.auth.mockResolvedValue({ user: null });

    const response = await GET(
      new Request("http://localhost/api/admin-next/cases/TF-13/communications"),
      context,
    );

    expect(response.status).toBe(401);
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.loadPage).not.toHaveBeenCalled();
  });

  it("returns a private canonical page for an active admin", async () => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 7, role: "admin" },
    });
    mocks.findByID.mockResolvedValue({ id: 13 });
    mocks.loadPage.mockResolvedValue({
      items: [],
      pageInfo: {
        totalCount: 0,
        remainingCount: 0,
        nextCursor: null,
        loadMoreHref: "/api/admin-next/cases/13/communications",
      },
    });

    const response = await GET(
      new Request("http://localhost/api/admin-next/cases/TF-13/communications"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(mocks.findByID).toHaveBeenCalledWith({
      collection: "leads",
      depth: 0,
      id: 13,
      overrideAccess: true,
    });
    expect(mocks.loadPage).toHaveBeenCalledWith(expect.anything(), 13, null);
  });

  it("rejects a malformed continuation cursor", async () => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 7, role: "admin" },
    });
    const response = await GET(
      new Request(
        "http://localhost/api/admin-next/cases/TF-13/communications?cursor=bad-cursor",
      ),
      context,
    );

    expect(response.status).toBe(400);
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.loadPage).not.toHaveBeenCalled();
  });
});
