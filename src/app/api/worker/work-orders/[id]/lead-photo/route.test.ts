import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  getPayload: vi.fn(),
  getBlob: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@vercel/blob", () => ({ get: mocks.getBlob }));

import { GET } from "./route";

function request() {
  return new Request(
    "http://localhost/api/worker/work-orders/9/lead-photo?index=0",
  );
}

const context = { params: Promise.resolve({ id: "9" }) };

describe("worker lead photo GET", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_WORKER_PORTAL", "true");
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

  it("does not touch auth, DB or Blob when the portal is disabled", async () => {
    vi.stubEnv("FEATURE_WORKER_PORTAL", "false");

    const response = await GET(request(), context);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.getBlob).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated access before DB or Blob reads", async () => {
    mocks.auth.mockResolvedValue({ user: null });

    const response = await GET(request(), context);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.getBlob).not.toHaveBeenCalled();
  });

  it("serves only an assigned worker's image as private no-store", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 2, role: "worker", active: true },
    });
    mocks.findByID.mockImplementation(
      async ({ collection }: { collection: string }) =>
        collection === "work-orders"
          ? { id: 9, assignedWorker: 2, lead: 7 }
          : {
              id: 7,
              photoUrls:
                "https://example.public.blob.vercel-storage.com/roof.jpg",
            },
    );
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    mocks.getBlob.mockResolvedValue({
      stream,
      statusCode: 200,
      blob: { contentType: "image/jpeg" },
    });

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.getBlob).toHaveBeenCalledWith(
      "https://example.public.blob.vercel-storage.com/roof.jpg",
      { access: "private", token: "test-token" },
    );
  });
});
