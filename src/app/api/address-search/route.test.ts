import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchAddress: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/providers/kartverket-address-provider", () => ({
  KartverketAddressProvider: class {
    searchAddress = mocks.searchAddress;
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: vi.fn(async () => ({ success: true, remaining: 29 })),
}));
vi.mock("@/lib/monitoring", () => ({
  captureException: mocks.captureException,
}));

import { GET } from "./route";

function request(query: string) {
  return new Request(
    `http://localhost/api/address-search?q=${encodeURIComponent(query)}`,
  );
}

function candidate(index: number) {
  return {
    id: `0301-1-2-0-0-Testveien ${index}`,
    label: `Testveien ${index}, 1182 OSLO`,
    streetAddress: `Testveien ${index}`,
    postalCode: "1182",
    city: "OSLO",
    latitude: 59.89 + index / 10_000,
    longitude: 10.79 + index / 10_000,
    source: "Kartverket",
  };
}

describe("public address search", () => {
  beforeEach(() => {
    mocks.searchAddress.mockReset();
    mocks.captureException.mockReset();
  });

  it.each(["", "abc", "x".repeat(181)])(
    "rejects an out-of-bounds query without calling Kartverket",
    async (query) => {
      const response = await GET(request(query));

      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.searchAddress).not.toHaveBeenCalled();
    },
  );

  it("returns an empty bounded result set", async () => {
    mocks.searchAddress.mockResolvedValueOnce([]);

    const response = await GET(request("Testveien 1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  it("maps and limits provider candidates without exposing provider diagnostics", async () => {
    mocks.searchAddress.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, index) => candidate(index + 1)),
    );

    const response = await GET(request("Testveien 1"));
    const payload = (await response.json()) as { items: unknown[] };

    expect(payload.items).toHaveLength(10);
    expect(payload.items[0]).toMatchObject({
      provider: "kartverket-address-rest-v1",
      providerAddressId: "0301-1-2-0-0-Testveien 1",
      canonicalLabel: "Testveien 1, 1182 OSLO",
      streetAddress: "Testveien 1",
      postalCode: "1182",
      city: "OSLO",
    });
    expect((payload.items[0] as { latitude: number }).latitude).toBeCloseTo(
      59.8901,
    );
    expect((payload.items[0] as { longitude: number }).longitude).toBeCloseTo(
      10.7901,
    );
    expect(JSON.stringify(payload)).not.toContain("source");
  });

  it("sanitizes provider failures", async () => {
    mocks.searchAddress.mockRejectedValueOnce(
      new Error("upstream secret diagnostic"),
    );

    const response = await GET(request("Testveien 1"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Address search is temporarily unavailable",
    });
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });
});
