import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildContractSnapshot, buildQuoteSnapshot, createCompanySignatureEvidence, createSignatureEvidence, documentHash } from "./document";
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

  it("builds a branded final contract with both signatures in the document", async () => {
    const quote = buildQuoteSnapshot({ quoteReference: "T-2-V1", leadId: 2, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 2", measurement: { id: 2, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1079, actualAreaMaxTenths: 1179, source: "Kartverket", credits: "© Kartverket", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["Kontrolleres på stedet"] }, pricing: { calculationId: 2, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 13800, subtotalExVatOre: 1627020, vatBasisPoints: 2500, vatOre: 406755, totalIncVatOre: 2033775, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 2237153 }, termsVersion: "legal-v1", validUntil: "2099-09-01T00:00:00Z" });
    const contract = buildContractSnapshot({ contractReference: "K-2-V1", quote, customer: { name: "Test Kunde", address: "Testveien 2" }, terms: { version: "legal-v1", text: "Avtalevilkår.", withdrawalInstructions: "Informasjon om angrerett.", withdrawalFormUrl: "https://example.test/form" } });
    const signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=";
    const evidence = createSignatureEvidence({ contract, expectedDocumentHash: documentHash(contract), signatureData, signerName: "Test Kunde", paymentObligationAccepted: true, termsAccepted: true, withdrawalInformationReceived: true, earlyStartRequested: false, earlyStartLossAcknowledged: false, ipAddress: "", userAgent: "", securitySalt: "s".repeat(32) });
    const companyEvidence = createCompanySignatureEvidence({ contract, expectedDocumentHash: documentHash(contract), signatureData, signerName: "Kari Admin", signerUserId: 1, ipAddress: "", userAgent: "", securitySalt: "s".repeat(32) });
    const bytes = await buildQuoteContractPdf({ contract, signatureData, evidence, companySignatureData: signatureData, companyEvidence });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdf.getAuthor()).toBe("Fornyelse Gruppen AS");
  });

  it("requires and embeds the immutable visual evidence for a schematic v2 snapshot", async () => {
    const evidencePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=", "base64");
    const quote = buildQuoteSnapshot({ quoteReference: "T-3-V1", leadId: 3, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 3", measurement: { id: 3, version: 2, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1079, actualAreaMaxTenths: 1179, source: "OSM", credits: "© OpenStreetMap contributors", capturedAt: "2026-08-25T00:00:00Z", assumptions: ["Kontrolleres på stedet"], mode: "schematic", buildingIdentifier: "way/3", evidenceMediaId: 33, evidenceHash: "c".repeat(64), evidenceAttribution: "© OpenStreetMap contributors", angleMinDegrees: 22, angleMaxDegrees: 32 }, pricing: { calculationId: 3, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 13800, subtotalExVatOre: 1627020, vatBasisPoints: 2500, vatOre: 406755, totalIncVatOre: 2033775, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 2237153 }, termsVersion: "legal-v1", validUntil: "2099-09-01T00:00:00Z" });
    const contract = buildContractSnapshot({ contractReference: "K-3-V1", quote, customer: { name: "Test Kunde", address: "Testveien 3" }, terms: { version: "legal-v1", text: "Avtalevilkår.", withdrawalInstructions: "Informasjon om angrerett.", withdrawalFormUrl: "https://example.test/form" } });
    await expect(buildQuoteContractPdf({ contract })).rejects.toThrow(/evidence is required/i);
    const bytes = await buildQuoteContractPdf({ contract, measurementEvidence: { data: evidencePng, mimeType: "image/png" } });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
