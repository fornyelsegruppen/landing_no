import { createHash } from "node:crypto";
import type { Payload } from "payload";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import { configureServerFonts } from "@/lib/server-fontconfig";
import type { ContractSnapshot, QuoteSnapshot } from "./document";

export type PdfMeasurementEvidence = {
  data: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
};

function quoteFrom(value: ContractSnapshot | QuoteSnapshot) {
  return "quote" in value ? value.quote : value;
}

export function measurementNeedsVisualEvidence(
  value: ContractSnapshot | QuoteSnapshot,
) {
  const measurement = quoteFrom(value).measurement;
  return (
    measurement.mode === "schematic" ||
    measurement.mode === "schematic_with_context"
  );
}

export async function loadPdfMeasurementEvidence(
  payload: Payload,
  value: ContractSnapshot | QuoteSnapshot,
): Promise<PdfMeasurementEvidence | undefined> {
  const measurement = quoteFrom(value).measurement;
  if (!measurementNeedsVisualEvidence(value)) return undefined;
  if (!measurement.evidenceMediaId || !measurement.evidenceHash)
    throw new Error("Visual measurement snapshot is incomplete");
  const media = await payload.findByID({
    collection: "private-media",
    id: measurement.evidenceMediaId,
    depth: 0,
    overrideAccess: true,
  });
  const file = await readPrivateMediaContent(media);
  const actualHash = createHash("sha256").update(file.data).digest("hex");
  if (actualHash !== measurement.evidenceHash)
    throw new Error("Visual measurement evidence hash mismatch");
  if (file.contentType === "image/svg+xml") {
    if (!configureServerFonts()) {
      throw new Error("Bundled PDF font is unavailable");
    }
    const { default: sharp } = await import("sharp");
    return {
      data: await sharp(file.data).png().toBuffer(),
      mimeType: "image/png",
    };
  }
  if (file.contentType === "image/png")
    return { data: file.data, mimeType: "image/png" };
  if (file.contentType === "image/jpeg")
    return { data: file.data, mimeType: "image/jpeg" };
  throw new Error("Unsupported visual measurement evidence format");
}
