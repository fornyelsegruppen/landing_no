import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuoteSnapshot } from "./document";

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
});
