import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";

const blob = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

import { createPrivateMedia, deletePrivateMedia } from "./private-media-storage";

describe("private media storage", () => {
  const create = vi.fn();
  const remove = vi.fn();
  const payload = { create, delete: remove } as unknown as Payload;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "private-test-token";
    create.mockReset().mockResolvedValue({ id: 41, url: "https://store.private.blob.vercel-storage.com/private-media/file-test.pdf" });
    remove.mockReset().mockResolvedValue({ id: 41 });
    blob.put.mockReset().mockResolvedValue({
      pathname: "private-media/contract/contract/2/file-test.pdf",
      url: "https://store.private.blob.vercel-storage.com/private-media/contract/contract/2/file-test.pdf",
    });
    blob.del.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("uploads contract bytes with private access and stores protected metadata", async () => {
    const result = await createPrivateMedia(payload, {
      classification: "contract",
      ownerType: "contract",
      ownerId: "2",
      alt: "Signed contract",
    }, {
      data: new Uint8Array([37, 80, 68, 70]),
      filename: "signed contract.pdf",
      mimeType: "application/pdf",
    });

    expect(result.id).toBe(41);
    expect(blob.put).toHaveBeenCalledWith(
      "private-media/contract/contract/2/signed-contract.pdf",
      expect.any(Buffer),
      expect.objectContaining({ access: "private", contentType: "application/pdf", token: "private-test-token" }),
    );
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "private-media",
      data: expect.objectContaining({
        filename: "file-test.pdf",
        mimeType: "application/pdf",
        filesize: 4,
        url: expect.stringContaining(".private.blob.vercel-storage.com/"),
        focalX: 50,
        focalY: 50,
      }),
    }));
  });

  it("removes the database record and private blob during cleanup", async () => {
    const media = { id: 41, url: "https://store.private.blob.vercel-storage.com/private-media/file-test.pdf" };
    await deletePrivateMedia(payload, media);
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ collection: "private-media", id: 41 }));
    expect(blob.del).toHaveBeenCalledWith(media.url, { token: "private-test-token" });
  });

  it("deletes an uploaded blob when metadata persistence fails", async () => {
    create.mockRejectedValueOnce(new Error("database failed"));
    await expect(createPrivateMedia(payload, {
      classification: "contract", ownerType: "contract", ownerId: "2", alt: "Signed contract",
    }, {
      data: Buffer.from("pdf"), filename: "signed.pdf", mimeType: "application/pdf",
    })).rejects.toThrow("database failed");
    expect(blob.del).toHaveBeenCalledWith(expect.stringContaining(".private.blob.vercel-storage.com/"), { token: "private-test-token" });
  });
});
