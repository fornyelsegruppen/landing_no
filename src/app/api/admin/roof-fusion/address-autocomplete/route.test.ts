import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  fetchEntur: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ auth: mocks.auth })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.isAdmin }));
vi.mock("@/lib/roof-fusion/preview-read-adapters-v1", () => ({
  assertRoofFusionPreviewEnabledV1: vi.fn(),
}));
vi.mock("@/lib/providers/entur-geocoder-v3", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/providers/entur-geocoder-v3")>();
  return { ...original, fetchEnturAutocompleteV1: mocks.fetchEntur };
});

import { GET, resetEnturAutocompleteRouteStateForTests } from "./route";

describe("GET /api/admin/roof-fusion/address-autocomplete", () => {
  beforeEach(() => {
    resetEnturAutocompleteRouteStateForTests();
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 7 } });
    mocks.isAdmin.mockReset().mockReturnValue(true);
    mocks.fetchEntur.mockReset().mockResolvedValue([
      {
        id: "KVE:PostalAddress:123",
        kind: "address",
        label: "Lyngveien 28A",
      },
    ]);
  });

  it("returns at most one cached provider request for the normalized query", async () => {
    const first = await GET(
      new Request(
        "http://localhost/api/admin/roof-fusion/address-autocomplete?q=Lyngveien%20%2028A",
      ),
    );
    const second = await GET(
      new Request(
        "http://localhost/api/admin/roof-fusion/address-autocomplete?q=lyngveien%2028a",
      ),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.fetchEntur).toHaveBeenCalledTimes(1);
  });

  it("fails closed for unauthenticated callers and unavailable Entur", async () => {
    mocks.auth.mockResolvedValueOnce({ user: null });
    expect(
      await GET(new Request("http://localhost/api?q=Lyngveien")),
    ).toMatchObject({ status: 401 });
    mocks.fetchEntur.mockRejectedValueOnce(new Error("timeout"));
    expect(
      await GET(new Request("http://localhost/api?q=Storgata")),
    ).toMatchObject({ status: 503 });
  });

  it("rate limits repeated uncached requests per authenticated operator", async () => {
    for (let index = 0; index < 30; index += 1) {
      const response = await GET(
        new Request(
          `http://localhost/api/admin/roof-fusion/address-autocomplete?q=Lyngveien-${index}`,
        ),
      );
      expect(response.status).toBe(200);
    }

    expect(
      await GET(
        new Request(
          "http://localhost/api/admin/roof-fusion/address-autocomplete?q=Storgata-31",
        ),
      ),
    ).toMatchObject({ status: 429 });
  });
});
