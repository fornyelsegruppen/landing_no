import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  assertUsage: vi.fn(),
  assertFeatureReady: vi.fn(),
  blobGet: vi.fn(),
  create: vi.fn(),
  findByID: vi.fn(),
  generateRoofProposal: vi.fn(),
  getPayload: vi.fn(),
  searchAddress: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: mocks.getPayload,
}));
vi.mock("@/lib/platform/features", () => ({
  assertFeatureReady: mocks.assertFeatureReady,
  FeatureUnavailableError: class FeatureUnavailableError extends Error {
    unavailable: string[] | null;
    constructor(message: string, unavailable: string[] | null = null) {
      super(message);
      this.unavailable = unavailable;
    }
  },
}));
vi.mock("@/lib/ai/payload-usage-limit", () => ({
  assertPayloadAiUsageAvailable: mocks.assertUsage,
}));
vi.mock("@/lib/providers/gemini-ai-provider", () => ({
  GeminiAiProvider: class GeminiAiProvider {},
}));
vi.mock("@/lib/measurements/ai-proposal", () => ({
  generateRoofProposal: mocks.generateRoofProposal,
}));
vi.mock("@/lib/providers/kartverket-address-provider", () => ({
  KartverketAddressProvider: class KartverketAddressProvider {
    searchAddress: typeof mocks.searchAddress;

    constructor() {
      this.searchAddress = mocks.searchAddress;
    }
  },
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
vi.mock("@vercel/blob", () => ({ get: mocks.blobGet }));

import { POST } from "./route";

const baseLead = {
  id: 18,
  address: "Lyngveien",
  houseNumber: "28A",
  postal: "1182",
  city: "OSLO",
};

const baseMedia = {
  id: 91,
  classification: "measurement",
  ownerType: "norge-i-bilder-capture",
  ownerId: "lead-18",
  url: "https://store.private.blob.vercel-storage.com/private-media/file.png",
  mimeType: "image/png",
  filesize: 1_234,
  filename: "norge-i-bilder-screenshot-click-91.png",
  alt: "Norge i bilder screenshot — ©norgeibilder.no",
  createdAt: "2026-09-03T10:00:00.000Z",
};

function buildPayloadFindByID() {
  return async ({ collection, id }: { collection: string; id: number }) => {
    if (collection === "leads" && id === 18) return baseLead;
    if (collection === "private-media" && id === 91) return baseMedia;
    return null;
  };
}

function request(body: unknown) {
  return new Request("https://preview.example/api/admin/measurements/propose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/measurements/propose", () => {
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    mocks.assertUsage.mockReset().mockResolvedValue(undefined);
    mocks.assertFeatureReady.mockReset().mockReturnValue(undefined);
    mocks.auth
      .mockReset()
      .mockResolvedValue({ user: { id: 7, role: "admin", active: true } });
    mocks.findByID.mockReset();
    mocks.findByID.mockImplementation(buildPayloadFindByID());
    mocks.create.mockReset().mockResolvedValue({ id: 41 });
    mocks.update.mockReset().mockResolvedValue({ id: 41 });
    mocks.generateRoofProposal.mockReset().mockResolvedValue({
      proposal: { confidence: 0.84 },
      provider: "gemini",
      model: "mock-model",
      source: "legacy",
      credits: "legacy",
    });
    mocks.searchAddress.mockReset().mockResolvedValue([
      {
        postalCode: "1182",
        label: "Lyngveien 28A, 1182 OSLO",
        latitude: 59.9,
        longitude: 10.8,
      },
    ]);
    const image = new Blob([new Uint8Array([1, 2, 3, 4])]);
    mocks.blobGet.mockReset().mockResolvedValue({
      stream: image.stream(),
      statusCode: 200,
      downloadUrl:
        "https://store.private.blob.vercel-storage.com/private-media/file.png",
    });
    mocks.getPayload.mockReset().mockResolvedValue({
      auth: mocks.auth,
      findByID: mocks.findByID,
      create: mocks.create,
      update: mocks.update,
    });
  });

  const requestBody = {
    leadId: 18,
    mapImageId: 91,
    source: "norge-i-bilder-screenshot",
    licenseAccepted: true,
    trainingProhibited: true,
    credits: "©norgeibilder.no",
  };

  it("rejects legacy source before any quota or image read", async () => {
    const response = await POST(
      request({
        ...requestBody,
        source: "norge-i-bilder",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.assertUsage).not.toHaveBeenCalled();
    expect(mocks.blobGet).not.toHaveBeenCalled();
    expect(mocks.generateRoofProposal).not.toHaveBeenCalled();
  });

  it("rejects wrong attribution or training policy before quota and blob read", async () => {
    const response = await POST(
      request({
        ...requestBody,
        credits: "© norgeibilder.no",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.assertUsage).not.toHaveBeenCalled();
    expect(mocks.blobGet).not.toHaveBeenCalled();
  });

  it("rejects cross-case private media before AI quota and blob read", async () => {
    mocks.findByID.mockImplementation(
      async ({ collection, id }: { collection: string; id: number }) => {
        if (collection === "leads" && id === 18) return baseLead;
        if (collection === "private-media" && id === 91) {
          return { ...baseMedia, ownerId: "lead-19" };
        }
        return null;
      },
    );
    const response = await POST(request(requestBody));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: "A private measurement image is required",
    });
    expect(mocks.assertUsage).not.toHaveBeenCalled();
    expect(mocks.blobGet).not.toHaveBeenCalled();
    expect(mocks.generateRoofProposal).not.toHaveBeenCalled();
  });

  it("rejects a capture without immutable Norge i bilder provenance before AI quota and blob read", async () => {
    mocks.findByID.mockImplementation(
      async ({ collection, id }: { collection: string; id: number }) => {
        if (collection === "leads" && id === 18) return baseLead;
        if (collection === "private-media" && id === 91) {
          return { ...baseMedia, alt: "Uncredited image" };
        }
        return null;
      },
    );

    const response = await POST(request(requestBody));

    expect(response.status).toBe(409);
    expect(mocks.assertUsage).not.toHaveBeenCalled();
    expect(mocks.blobGet).not.toHaveBeenCalled();
    expect(mocks.generateRoofProposal).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested lead does not exist or cannot be read", async () => {
    mocks.findByID.mockImplementation(
      async ({ collection }: { collection: string }) => {
        if (collection === "leads") throw new Error("not found");
        return null;
      },
    );

    const response = await POST(request(requestBody));

    expect(response.status).toBe(404);
    expect(mocks.searchAddress).not.toHaveBeenCalled();
    expect(mocks.assertUsage).not.toHaveBeenCalled();
    expect(mocks.blobGet).not.toHaveBeenCalled();
  });

  it("resolves coordinates from lead address via Kartverket and runs proposal with them", async () => {
    const response = await POST(request(requestBody));

    expect(response.status).toBe(200);
    expect(mocks.searchAddress).toHaveBeenCalledWith("Lyngveien 28A 1182 OSLO");
    expect(mocks.assertUsage).toHaveBeenCalledOnce();
    expect(mocks.blobGet).toHaveBeenCalledOnce();
    expect(mocks.generateRoofProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 59.9,
        longitude: 10.8,
      }),
    );
    expect(mocks.assertUsage).toHaveBeenCalledWith(expect.anything(), {
      reserve: 1,
    });
  });
});
