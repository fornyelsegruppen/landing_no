import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  getPayload: vi.fn(),
  readPrivateMediaContent: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/private-media-content", () => ({
  readPrivateMediaContent: mocks.readPrivateMediaContent,
}));

import { GET } from "./route";

function request() {
  return new Request("http://localhost/api/worker/work-orders/9/media/21");
}

const context = {
  params: Promise.resolve({ id: "9", mediaId: "21" }),
};

describe("worker private media GET", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_WORKER_PORTAL", "true");
    mocks.auth.mockReset();
    mocks.findByID.mockReset();
    mocks.getPayload.mockReset().mockResolvedValue({
      auth: mocks.auth,
      findByID: mocks.findByID,
    });
    mocks.readPrivateMediaContent.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("fails closed before auth or DB access for workers and admins when disabled", async () => {
    vi.stubEnv("FEATURE_WORKER_PORTAL", "false");
    mocks.auth.mockResolvedValue({
      user: { id: 1, role: "admin", active: true },
    });

    const response = await GET(request(), context);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated access without reading work data", async () => {
    mocks.auth.mockResolvedValue({ user: null });

    const response = await GET(request(), context);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.findByID).not.toHaveBeenCalled();
  });

  it("hides another worker's assignment", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 2, role: "worker", active: true },
    });
    mocks.findByID.mockResolvedValue({ id: 9, assignedWorker: 3 });

    const response = await GET(request(), context);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.readPrivateMediaContent).not.toHaveBeenCalled();
  });

  it("serves owned private media with no-store and nosniff", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 2, role: "worker", active: true },
    });
    mocks.findByID.mockImplementation(
      async ({ collection }: { collection: string }) =>
        collection === "work-orders"
          ? { id: 9, assignedWorker: 2 }
          : {
              id: 21,
              classification: "work",
              ownerType: "work-order",
              ownerId: "9",
              mimeType: "image/jpeg",
            },
    );
    mocks.readPrivateMediaContent.mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
