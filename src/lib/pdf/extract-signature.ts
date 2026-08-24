import zlib from "node:zlib";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

/**
 * Compatibility path for contracts signed before the signature PNG received
 * its own protected-media relation. The old durable PDF still contains the
 * exact PNG as an RGB image with an alpha soft-mask.
 */
export async function extractSignaturePngFromPdf(pdfBytes: Buffer | Uint8Array) {
  const document = await PDFDocument.load(pdfBytes);
  const candidates: Array<{ rgb: PDFRawStream; alpha: PDFRawStream; width: number; height: number }> = [];

  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    if (object.dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;
    if (object.dict.get(PDFName.of("ColorSpace"))?.toString() !== "/DeviceRGB") continue;
    const width = Number(object.dict.get(PDFName.of("Width"))?.toString());
    const height = Number(object.dict.get(PDFName.of("Height"))?.toString());
    const maskRef = object.dict.get(PDFName.of("SMask"));
    const alpha = maskRef ? document.context.lookup(maskRef) : null;
    if (!(alpha instanceof PDFRawStream) || !Number.isInteger(width) || !Number.isInteger(height)) continue;
    if (width < 64 || height < 24 || width / height < 2.5 || width * height > 8_000_000) continue;
    candidates.push({ rgb: object, alpha, width, height });
  }

  const candidate = candidates.sort((a, b) => (b.width / b.height) - (a.width / a.height))[0];
  if (!candidate) return null;
  const rgb = zlib.inflateSync(candidate.rgb.contents);
  const alpha = zlib.inflateSync(candidate.alpha.contents);
  const pixels = candidate.width * candidate.height;
  if (rgb.length !== pixels * 3 || alpha.length !== pixels) return null;
  const rgba = Buffer.allocUnsafe(pixels * 4);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    rgba[pixel * 4] = rgb[pixel * 3];
    rgba[pixel * 4 + 1] = rgb[pixel * 3 + 1];
    rgba[pixel * 4 + 2] = rgb[pixel * 3 + 2];
    rgba[pixel * 4 + 3] = alpha[pixel];
  }
  return sharp(rgba, { raw: { width: candidate.width, height: candidate.height, channels: 4 } }).png().toBuffer();
}
