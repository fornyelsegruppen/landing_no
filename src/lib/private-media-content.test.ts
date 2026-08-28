import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@vercel/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vercel/blob")>();
  return { ...actual, get: mocks.get };
});

import {
  PrivateMediaTemporarilyUnavailableError,
  readPrivateMediaContent,
} from "./private-media-content";

const media = {
  filename: "roof-evidence.svg",
  filesize: 24,
  mimeType: "image/svg+xml",
  url: "https://example-store.blob.vercel-storage.com/roof-evidence.svg",
};

function blobResult(content: string) {
  return {
    statusCode: 200 as const,
    stream: new Response(content).body,
  };
}

describe("private Blob reads", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-private-blob-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retries one transient fetch failure and returns the complete content", async () => {
    mocks.get
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(blobResult("verified-evidence"));

    const result = await readPrivateMediaContent(media);

    expect(result.data.toString("utf8")).toBe("verified-evidence");
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenLastCalledWith(
      "https://example-store.blob.vercel-storage.com/roof-evidence.svg",
      expect.objectContaining({
        access: "private",
        abortSignal: expect.any(AbortSignal),
        token: "test-private-blob-token",
      }),
    );
  });

  it("raises a typed sanitized error after the bounded retry is exhausted", async () => {
    const transient = new TypeError("fetch failed", {
      cause: new Error(
        "https://example-store.blob.vercel-storage.com/private?token=test-private-blob-token",
      ),
    });
    mocks.get.mockRejectedValue(transient);
    const operation = readPrivateMediaContent(media);

    await expect(operation).rejects.toMatchObject({
      code: "PRIVATE_MEDIA_TEMPORARILY_UNAVAILABLE",
      message: "Private media is temporarily unavailable",
      name: "PrivateMediaTemporarilyUnavailableError",
    });
    await expect(operation).rejects.not.toHaveProperty("cause");
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent private Blob access failure", async () => {
    const permanent = new Error("Failed to fetch blob: 403 Forbidden");
    mocks.get.mockRejectedValue(permanent);

    await expect(readPrivateMediaContent(media)).rejects.toBe(permanent);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(permanent).not.toBeInstanceOf(
      PrivateMediaTemporarilyUnavailableError,
    );
  });

  it("does not retry when private Blob storage is not configured", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    await expect(readPrivateMediaContent(media)).rejects.toThrow(
      "Private Blob storage is not configured",
    );
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
