import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractSignaturePngFromPdf } from "./extract-signature";

describe("legacy signature extraction", () => {
  it("recovers the alpha-backed signature image from a durable PDF", async () => {
    const width = 300;
    const height = 80;
    const rgba = Buffer.alloc(width * height * 4);
    for (let x = 20; x < 280; x += 1) {
      const y = 20 + Math.round(20 * Math.sin(x / 20));
      const offset = (y * width + x) * 4;
      rgba[offset] = 10; rgba[offset + 1] = 20; rgba[offset + 2] = 30; rgba[offset + 3] = 255;
    }
    const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const image = await pdf.embedPng(png);
    page.drawImage(image, { x: 50, y: 500, width: 240, height: 64 });
    const recovered = await extractSignaturePngFromPdf(await pdf.save());
    expect(recovered).not.toBeNull();
    await expect(sharp(recovered!).metadata()).resolves.toMatchObject({ width, height, format: "png" });
  });
});
