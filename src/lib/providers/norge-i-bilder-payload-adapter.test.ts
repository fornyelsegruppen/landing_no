import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  burnNorgeIBilderAttribution,
  norgeIBilderCapturePrivateMediaDescriptor,
} from "./norge-i-bilder-payload-adapter";

describe("Norge i bilder final image adapter", () => {
  it("burns the mandatory source attribution into a PNG final file", async () => {
    const source = await sharp({
      create: { width: 320, height: 180, channels: 3, background: "#23558c" },
    })
      .png()
      .toBuffer();

    const result = await burnNorgeIBilderAttribution(source);
    const metadata = await sharp(result).metadata();
    expect(metadata).toMatchObject({ format: "png", width: 320, height: 180 });
    expect(Buffer.compare(source, result)).not.toBe(0);

    const raw = await sharp(result).removeAlpha().raw().toBuffer();
    // The lower-right watermark box must alter what was a uniform blue input.
    const pixelOffset = ((165 * 320) + 300) * 3;
    expect(raw[pixelOffset]).not.toBe(35);
  });
});

describe("Norge i bilder private-media ownership", () => {
  it("uses a non-shareable lead-owned evidence descriptor", () => {
    expect(
      norgeIBilderCapturePrivateMediaDescriptor("lead-18", "click-6d5f"),
    ).toEqual({
      classification: "measurement",
      ownerType: "norge-i-bilder-capture",
      ownerId: "lead-18",
      alt: "Norge i bilder screenshot — ©norgeibilder.no",
      filename: "norge-i-bilder-screenshot-click-6d5f.png",
    });
  });

  it("rejects non-canonical case ownership", () => {
    expect(() =>
      norgeIBilderCapturePrivateMediaDescriptor("lead-18-other", "click-6d5f"),
    ).toThrow("canonical lead case ID");
  });
});
