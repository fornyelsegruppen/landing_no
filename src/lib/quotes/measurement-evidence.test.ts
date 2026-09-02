import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { burnNorgeIBilderAttribution } from "@/lib/providers/norge-i-bilder-payload-adapter";
import { buildContractSnapshot, buildQuoteSnapshot } from "./document";
import { buildQuoteContractPdf } from "./quote-pdf";

const readPrivateMediaContent = vi.fn();

vi.mock("@/lib/private-media-content", () => ({ readPrivateMediaContent }));

function quote(mode: "schematic" | "manual_no_visual", evidenceHash?: string) {
  return buildQuoteSnapshot({
    quoteReference: "T-4-V1",
    leadId: 4,
    serviceKey: "takvask",
    serviceDescription: "Takvask",
    propertyAddress: "Testveien 4",
    measurement: {
      id: 4,
      version: 1,
      inputHash: "a".repeat(64),
      horizontalAreaTenths: 1_000,
      actualAreaMinTenths: 1_079,
      actualAreaMaxTenths: 1_179,
      source: mode === "manual_no_visual" ? "Administrator" : "OSM",
      credits: mode === "manual_no_visual" ? "Manuell måling" : "© OpenStreetMap contributors",
      capturedAt: "2026-08-25T00:00:00Z",
      assumptions: ["Kontrolleres på stedet"],
      mode,
      evidenceMediaId: mode === "schematic" ? 44 : undefined,
      evidenceHash,
      manualAreaSource: mode === "manual_no_visual" ? "admin_estimate" : undefined,
      manualAreaReason: mode === "manual_no_visual" ? "Kontrollert mot kundens tegning" : undefined,
    },
    pricing: {
      calculationId: 4,
      inputHash: "b".repeat(64),
      ruleId: 1,
      ruleVersion: 1,
      unitPriceExVatOre: 13_800,
      subtotalExVatOre: 1_627_020,
      vatBasisPoints: 2_500,
      vatOre: 406_755,
      totalIncVatOre: 2_033_775,
      toleranceBasisPoints: 1_000,
      maximumTotalIncVatOre: 2_237_153,
    },
    termsVersion: "legal-v1",
    validUntil: "2099-09-01T00:00:00Z",
  });
}

function norgeQuote(evidenceHash: string) {
  return buildQuoteSnapshot({
    quoteReference: "T-5-V1",
    leadId: 5,
    serviceKey: "takvask",
    serviceDescription: "Takvask",
    propertyAddress: "Testveien 5",
    measurement: {
      id: 5,
      version: 1,
      inputHash: "a".repeat(64),
      horizontalAreaTenths: 1_000,
      actualAreaMinTenths: 1_050,
      actualAreaMaxTenths: 1_150,
      source: "Kartverket skjermdump",
      credits: "©norgeibilder.no",
      capturedAt: "2026-09-02T10:00:00Z",
      assumptions: ["Kontrolleres på stedet"],
      mode: "schematic_with_context",
      evidenceMediaId: 55,
      evidenceHash,
      evidenceSource: "norge-i-bilder-screenshot",
      evidenceAttribution: "©norgeibilder.no",
      imageryCapturedAt: "2026-09-02T10:00:00.000Z",
      evidenceTrainingProhibited: true,
    },
    pricing: {
      calculationId: 5,
      inputHash: "b".repeat(64),
      ruleId: 1,
      ruleVersion: 1,
      unitPriceExVatOre: 13_800,
      subtotalExVatOre: 1_627_020,
      vatBasisPoints: 2_500,
      vatOre: 406_755,
      totalIncVatOre: 2_033_775,
      toleranceBasisPoints: 1_000,
      maximumTotalIncVatOre: 2_237_153,
    },
    termsVersion: "legal-v1",
    validUntil: "2099-09-01T00:00:00Z",
  });
}

describe("immutable measurement evidence", () => {
  beforeEach(() => readPrivateMediaContent.mockReset());

  it("verifies the saved hash and converts SVG evidence for the PDF", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
    readPrivateMediaContent.mockResolvedValue({ data: svg, filename: "roof.svg", contentType: "image/svg+xml" });
    const { loadPdfMeasurementEvidence } = await import("./measurement-evidence");
    const payload = { findByID: vi.fn().mockResolvedValue({ id: 44, filename: "roof.svg", mimeType: "image/svg+xml" }) };

    const result = await loadPdfMeasurementEvidence(payload as never, quote("schematic", createHash("sha256").update(svg).digest("hex")));

    expect(result?.mimeType).toBe("image/png");
    expect(Buffer.from(result?.data || []).subarray(1, 4).toString()).toBe("PNG");
  });

  it("blocks changed evidence and skips visual loading for a manual measurement", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    readPrivateMediaContent.mockResolvedValue({ data: svg, filename: "roof.svg", contentType: "image/svg+xml" });
    const { loadPdfMeasurementEvidence } = await import("./measurement-evidence");
    const payload = { findByID: vi.fn().mockResolvedValue({ id: 44 }) };

    await expect(loadPdfMeasurementEvidence(payload as never, quote("schematic", "f".repeat(64)))).rejects.toThrow(/hash mismatch/i);
    await expect(loadPdfMeasurementEvidence(payload as never, quote("manual_no_visual"))).resolves.toBeUndefined();
    expect(payload.findByID).toHaveBeenCalledTimes(1);
  });

  it("rejects Norge i bilder evidence unless the stored raster is PNG or JPEG", async () => {
    const webp = Buffer.from("RIFFxxxxWEBP", "utf8");
    readPrivateMediaContent.mockResolvedValue({
      data: webp,
      filename: "norge.webp",
      contentType: "image/webp",
    });
    const { loadPdfMeasurementEvidence } = await import("./measurement-evidence");
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 55, filename: "norge.webp", mimeType: "image/webp" }),
    };

    await expect(
      loadPdfMeasurementEvidence(
        payload as never,
        norgeQuote(createHash("sha256").update(webp).digest("hex")),
      ),
    ).rejects.toThrow(/png or jpeg/i);
  });

  it("reuses the same approved capture-media fixture from evidence load through quote PDF generation", async () => {
    const rawCapture = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: "#23558c",
      },
    })
      .png()
      .toBuffer();
    const storedCapture = await burnNorgeIBilderAttribution(rawCapture);
    readPrivateMediaContent.mockResolvedValue({
      data: storedCapture,
      filename: "norge-i-bilder-screenshot-click-55.png",
      contentType: "image/png",
    });
    const { loadPdfMeasurementEvidence } = await import("./measurement-evidence");
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 55,
        filename: "norge-i-bilder-screenshot-click-55.png",
        mimeType: "image/png",
        classification: "measurement",
        ownerType: "norge-i-bilder-capture",
        ownerId: "lead-5",
      }),
    };
    const quote = norgeQuote(
      createHash("sha256").update(storedCapture).digest("hex"),
    );
    const contract = buildContractSnapshot({
      contractReference: "K-5-V1",
      quote,
      customer: { name: "Test Kunde", address: "Testveien 5" },
      terms: {
        version: "legal-v1",
        text: "Avtalevilkår.",
        withdrawalInstructions: "Informasjon om angrerett.",
        withdrawalFormUrl: "https://example.test/form",
      },
    });

    const measurementEvidence = await loadPdfMeasurementEvidence(
      payload as never,
      quote,
    );
    const bytes = await buildQuoteContractPdf({
      contract,
      measurementEvidence,
    });
    const pdf = await PDFDocument.load(bytes);

    expect(measurementEvidence).toMatchObject({
      mimeType: "image/png",
      data: storedCapture,
    });
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "private-media", id: 55 }),
    );
  });
});
