import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildContractSnapshot, buildQuoteSnapshot } from "./document";
import { buildQuoteContractPdf } from "./quote-pdf";

function contractFixture() {
  const quote = buildQuoteSnapshot({
    quoteReference: "T-91-V1",
    leadId: 91,
    serviceKey: "takvask",
    serviceDescription: "Takvask",
    propertyAddress: "Testveien 91",
    measurement: {
      id: 91,
      version: 1,
      inputHash: "a".repeat(64),
      horizontalAreaTenths: 1_000,
      actualAreaMinTenths: 1_000,
      actualAreaMaxTenths: 1_100,
      source: "Synthetic Preview fixture",
      credits: "Synthetic Preview fixture",
      capturedAt: "2026-09-05T09:00:00.000Z",
      assumptions: ["Kontrolleres i isolert Preview"],
    },
    pricing: {
      calculationId: 91,
      inputHash: "b".repeat(64),
      ruleId: 91,
      ruleVersion: 1,
      unitPriceExVatOre: 10_000,
      subtotalExVatOre: 1_100_000,
      vatBasisPoints: 2_500,
      vatOre: 275_000,
      totalIncVatOre: 1_375_000,
      toleranceBasisPoints: 1_000,
      maximumTotalIncVatOre: 1_512_500,
    },
    termsVersion: "preview-existing-terms",
    validUntil: "2099-09-05T09:00:00.000Z",
  });
  return buildContractSnapshot({
    contractReference: "K-91-V1",
    quote,
    customer: { name: "Preview Test", address: "Testveien 91" },
    terms: {
      version: "preview-existing-terms",
      text: "Eksisterende testvilkår.",
      withdrawalInstructions: "Eksisterende testinformasjon om angrerett.",
      withdrawalFormUrl: "https://example.invalid/angreskjema",
    },
  });
}

async function pageTexts(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  }).promise;
  const result: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    result.push(
      content.items
        .flatMap((item) => ("str" in item ? [item.str] : []))
        .join(" "),
    );
  }
  return result;
}

describe("quote PDF Preview nonbinding branding", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("marks the PDF metadata, first-page explanation, and every page chrome", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PREVIEW_E2E_NONBINDING_DOCUMENTS", "true");

    const bytes = await buildQuoteContractPdf({
      contract: contractFixture(),
    });
    const metadata = await PDFDocument.load(bytes);
    const pages = await pageTexts(bytes);

    expect(metadata.getTitle()).toContain("[PREVIEW TEST – IKKE BINDENDE]");
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]).toContain("ingen bindende bestilling");
    for (const page of pages) {
      expect(page).toContain("PREVIEW TEST – IKKE BINDENDE");
    }
  });

  it("does not mark a Production PDF even if the Preview flag is present", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PREVIEW_E2E_NONBINDING_DOCUMENTS", "true");

    const bytes = await buildQuoteContractPdf({
      contract: contractFixture(),
    });
    const metadata = await PDFDocument.load(bytes);

    expect(metadata.getTitle()).not.toContain("PREVIEW TEST");
  });
});
