import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  normalizedImageFilename,
  sanitizeImageUpload,
} from "./sanitize-upload";

async function sampleJpeg() {
  return sharp({
    create: { width: 120, height: 80, channels: 3, background: "#e65644" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
}

describe("sanitizeImageUpload", () => {
  it("normalizes an image to JPEG and removes embedded metadata", async () => {
    const input = await sampleJpeg();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await sanitizeImageUpload(input, { declaredMime: "image/jpeg" });
    const metadata = await sharp(result.bytes).metadata();

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.sourceMimeType).toBe("image/jpeg");
    expect(result.originalSha256).not.toBe(result.storedSha256);
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("rejects declared MIME mismatches", async () => {
    await expect(sanitizeImageUpload(await sampleJpeg(), {
      declaredMime: "image/png",
    })).rejects.toMatchObject({ code: "mime_mismatch" });
  });

  it("rejects corrupt files even when their first bytes resemble JPEG", async () => {
    const corrupt = Buffer.from([0xff, 0xd8, 0xff, ...new Array(30).fill(0)]);
    await expect(sanitizeImageUpload(corrupt, { declaredMime: "image/jpeg" }))
      .rejects.toMatchObject({ code: "invalid" });
  });

  it("enforces size limits before decoding", async () => {
    await expect(sanitizeImageUpload(await sampleJpeg(), { maxInputBytes: 10 }))
      .rejects.toMatchObject({ code: "too_large" });
  });

  it("creates a safe normalized filename", () => {
    expect(normalizedImageFilename("før bilde.PNG", "photo")).toBe("f-r-bilde.jpg");
    expect(normalizedImageFilename("", "before")).toBe("before.jpg");
  });
});
