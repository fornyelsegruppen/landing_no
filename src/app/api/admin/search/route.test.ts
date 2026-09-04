import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  searchAdminRecords: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ auth: mocks.auth, find: vi.fn() })),
}));

vi.mock("@/lib/admin-v2/dashboard", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin-v2/dashboard")>();
  return { ...original, searchAdminRecords: mocks.searchAdminRecords };
});

import { GET } from "./route";

describe("permission-aware admin search route", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.searchAdminRecords.mockReset();
  });

  it("does not expose search results without an authenticated admin", async () => {
    mocks.auth.mockResolvedValue({ user: null });
    const response = await GET(new Request("http://localhost/api/admin/search?q=roof"));
    expect(response.status).toBe(401);
    expect(mocks.searchAdminRecords).not.toHaveBeenCalled();
  });

  it("returns only the server-projected result shape for an active admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: 1, active: true, role: "admin" } });
    mocks.searchAdminRecords.mockResolvedValue([{ id: 42, href: "/admin-v2/cases/42", reference: "CASE-42", subtitle: "Oslo", type: "lead" }]);
    const response = await GET(new Request("http://localhost/api/admin/search?q=roof"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ query: "roof", results: [{ id: 42, type: "lead" }] });
    expect(mocks.searchAdminRecords).toHaveBeenCalledOnce();
  });
});
