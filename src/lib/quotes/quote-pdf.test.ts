import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildContractSnapshot, buildQuoteSnapshot, documentHash } from "./document";
import { buildQuoteContractPdf } from "./quote-pdf";

describe("quote PDF", () => {
  it("builds one durable document from the same locked snapshot", async () => {
    const quote = buildQuoteSnapshot({ quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 1", measurement: { id: 1, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1079, actualAreaMaxTenths: 1179, source: "Kartverket", credits: "© Kartverket", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["Kontrolleres på stedet"] }, pricing: { calculationId: 1, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 13800, subtotalExVatOre: 1627020, vatBasisPoints: 2500, vatOre: 406755, totalIncVatOre: 2033775, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 2237153 }, termsVersion: "legal-v1", validUntil: "2099-09-01T00:00:00Z" });
    const contract = buildContractSnapshot({ contractReference: "K-1-V1", quote, customer: { name: "Test Kunde", address: "Testveien 1" }, terms: { version: "legal-v1", text: "Dette er juridisk kontrollert kontraktstekst som beskriver oppdrag, betaling, ansvar, endringer og kundens ufravikelige rettigheter.", withdrawalInstructions: "Du kan normalt gå fra fjernsalgsavtalen innen 14 dager. Bruk skjemaet eller send en annen tydelig melding til leverandøren.", withdrawalFormUrl: "https://example.test/form" } });
    const bytes = await buildQuoteContractPdf({ contract });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdf.getTitle()).toContain(contract.contractReference);
    expect(documentHash(contract)).toHaveLength(64);
  });
});
