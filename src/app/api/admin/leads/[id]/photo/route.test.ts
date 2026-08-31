import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  getBlob: vi.fn(),
  getPayload: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@vercel/blob", () => ({ get: mocks.getBlob }));

import { GET } from "./route";

function request(index?: string, extra = "") {
  const search = index === undefined ? "" : `?index=${index}${extra}`;
  return new Request(`http://localhost/api/admin/leads/12/photo${search}`);
}

const context = { params: Promise.resolve({ id: "12" }) };

function imageResult(contentType = "image/jpeg") {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
  return { blob: { contentType }, statusCode: 200, stream };
}

describe("admin lead photo GET", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    mocks.auth.mockReset();
    mocks.findByID.mockReset();
    mocks.getBlob.mockReset();
    mocks.getPayload.mockReset().mockResolvedValue({
      auth: mocks.auth,
      findByID: mocks.findByID,
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects unauthenticated access before reading the case or Blob", async () => {
    mocks.auth.mockResolvedValue({ user: null });

    const response = await GET(request("0"), context);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.getBlob).not.toHaveBeenCalled();
  });

  it.each([
    { active: true, id: 4, role: "worker" },
    { active: false, id: 5, role: "admin" },
  ])(
    "rejects a non-admin user before reading the case or Blob",
    async (user) => {
      mocks.auth.mockResolvedValue({ user });

      const response = await GET(request("0"), context);

      expect(response.status).toBe(403);
      expect(mocks.findByID).not.toHaveBeenCalled();
      expect(mocks.getBlob).not.toHaveBeenCalled();
    },
  );

  it("serves only the indexed photo belonging to the requested lead", async () => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 1, role: "admin" },
    });
    mocks.findByID.mockResolvedValue({
      id: 12,
      photoUrls:
        "https://safe.blob.vercel-storage.com/leads/roof-1.jpg?secret=ignored\nhttps://safe.blob.vercel-storage.com/leads/roof-2.jpg",
    });
    mocks.getBlob.mockResolvedValue(imageResult());

    const response = await GET(
      request(
        "1",
        "&url=https://safe.blob.vercel-storage.com/leads/not-this-photo.jpg",
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin",
    );
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "leads", id: 12 }),
    );
    expect(mocks.getBlob).toHaveBeenCalledWith(
      "https://safe.blob.vercel-storage.com/leads/roof-2.jpg",
      { access: "private", token: "test-token" },
    );
  });

  it.each([undefined, "", "-1", "1.5", "abc", "15"])(
    "rejects a missing or invalid index %s before case or Blob reads",
    async (index) => {
      mocks.auth.mockResolvedValue({
        user: { active: true, id: 1, role: "admin" },
      });

      const response = await GET(request(index), context);

      expect(response.status).toBe(404);
      expect(mocks.findByID).not.toHaveBeenCalled();
      expect(mocks.getBlob).not.toHaveBeenCalled();
    },
  );

  it.each([
    "http://safe.blob.vercel-storage.com/leads/roof.jpg",
    "https://example.com/leads/roof.jpg",
    "https://safe.blob.vercel-storage.com/private/roof.jpg",
    "not-a-url",
  ])("rejects an untrusted stored photo URL %s", async (photoUrl) => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 1, role: "admin" },
    });
    mocks.findByID.mockResolvedValue({ id: 12, photoUrls: photoUrl });

    const response = await GET(request("0"), context);

    expect(response.status).toBe(404);
    expect(mocks.getBlob).not.toHaveBeenCalled();
  });

  it.each([null, { id: 12, photoUrls: "" }])(
    "rejects a missing lead or photo",
    async (lead) => {
      mocks.auth.mockResolvedValue({
        user: { active: true, id: 1, role: "admin" },
      });
      mocks.findByID.mockResolvedValue(lead);

      const response = await GET(request("0"), context);

      expect(response.status).toBe(404);
      expect(mocks.getBlob).not.toHaveBeenCalled();
    },
  );

  it("rejects non-image Blob content", async () => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 1, role: "admin" },
    });
    mocks.findByID.mockResolvedValue({
      id: 12,
      photoUrls: "https://safe.blob.vercel-storage.com/leads/file.svg",
    });
    mocks.getBlob.mockResolvedValue(imageResult("image/svg+xml"));

    const response = await GET(request("0"), context);

    expect(response.status).toBe(404);
  });

  it("rejects a failed or empty Blob read", async () => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 1, role: "admin" },
    });
    mocks.findByID.mockResolvedValue({
      id: 12,
      photoUrls: "https://safe.blob.vercel-storage.com/leads/roof.jpg",
    });
    mocks.getBlob.mockResolvedValue({
      blob: { contentType: "image/jpeg" },
      statusCode: 404,
      stream: null,
    });

    const response = await GET(request("0"), context);

    expect(response.status).toBe(404);
  });
});
