import { describe, expect, it } from "vitest";
import { buildContractSnapshot, buildQuoteSnapshot, createCompanySignatureEvidence, createSignatureEvidence, documentHash, quoteDisplayModel } from "./document";

const quote = buildQuoteSnapshot({
  quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask",
  propertyAddress: "Testveien 1", measurement: { id: 2, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1079, actualAreaMaxTenths: 1179, source: "Kartverket", credits: "© Kartverket", capturedAt: "2026-08-23T10:00:00Z", assumptions: ["Takvinkel 22–32°"] },
  pricing: { calculationId: 3, inputHash: "b".repeat(64), ruleId: 4, ruleVersion: 1, unitPriceExVatOre: 13800, subtotalExVatOre: 1627020, vatBasisPoints: 2500, vatOre: 406755, totalIncVatOre: 2033775, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 2237153 },
  termsVersion: "2026-08-legal-review", validUntil: "2099-09-06T10:00:00Z",
});
const contract = buildContractSnapshot({ contractReference: "K-1-V1", quote, customer: { name: "Test Kunde", address: "Testveien 1" }, terms: { version: "2026-08-legal-review", text: "Arbeidet utføres i samsvar med den låste beskrivelsen og gjeldende ufravikelig forbrukerlovgivning.", withdrawalInstructions: "Kunden har mottatt informasjon om angrerett og standard angreskjema.", withdrawalFormUrl: "https://example.test/angreskjema" } });
const signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=";

describe("locked quote and contract documents", () => {
  it("shows the exact same totals from the locked quote snapshot", () => {
    expect(quoteDisplayModel(quote)).toMatchObject({ totalIncVatNok: 20337.75, maximumTotalIncVatNok: 22371.53, vatPercent: 25, depositPercent: 0, depositAmountIncVatNok: 0 });
    expect(quote.schemaVersion).toBe("quote-v2");
    expect(contract.schemaVersion).toBe("contract-v2");
    expect(quote.measurement.mode).toBe("legacy");
  });

  it("locks an administrator-selected deposit to the exact quote total", () => {
    const withDeposit = buildQuoteSnapshot({ ...quote, pricing: { ...quote.pricing, depositBasisPoints: 2000, depositAmountIncVatOre: 406755 } });
    expect(quoteDisplayModel(withDeposit)).toMatchObject({ depositPercent: 20, depositAmountIncVatNok: 4067.55 });
    expect(() => buildQuoteSnapshot({ ...quote, pricing: { ...quote.pricing, depositBasisPoints: 2000, depositAmountIncVatOre: 1 } })).toThrow(/Deposit amount/);
  });

  it("hashes canonical content deterministically", () => {
    expect(documentHash(contract)).toBe(documentHash(structuredClone(contract)));
  });

  it("hashes the persisted JSON shape of optional values", () => {
    expect(documentHash({ required: "value", optional: undefined }))
      .toBe(documentHash({ required: "value" }));
    expect(documentHash(["value", undefined]))
      .toBe(documentHash(["value", null]));
  });

  it("signs exactly the expected contract and records minimized security evidence", () => {
    const evidence = createSignatureEvidence({ contract, expectedDocumentHash: documentHash(contract), signatureData, signerName: "Test Kunde", paymentObligationAccepted: true, termsAccepted: true, withdrawalInformationReceived: true, earlyStartRequested: true, earlyStartLossAcknowledged: true, ipAddress: "192.0.2.1", userAgent: "test browser", securitySalt: "s".repeat(32), now: new Date("2026-08-23T12:00:00Z") });
    expect(evidence.documentHash).toBe(documentHash(contract));
    expect(evidence.ipEvidenceHash).toHaveLength(64);
    expect(JSON.stringify(evidence)).not.toContain("192.0.2.1");
  });

  it("rejects stale documents and incomplete early-start consent", () => {
    const base = { contract, signatureData, signerName: "Test Kunde", paymentObligationAccepted: true, termsAccepted: true, withdrawalInformationReceived: true, earlyStartRequested: true, earlyStartLossAcknowledged: false, ipAddress: "", userAgent: "", securitySalt: "s".repeat(32) };
    expect(() => createSignatureEvidence({ ...base, expectedDocumentHash: "0".repeat(64) })).toThrow(/changed/);
    expect(() => createSignatureEvidence({ ...base, expectedDocumentHash: documentHash(contract) })).toThrow(/Early start/);
  });

  it("rejects a forged non-PNG signature payload", () => {
    expect(() => createSignatureEvidence({
      contract,
      expectedDocumentHash: documentHash(contract),
      signatureData: `data:image/png;base64,${"a".repeat(120)}`,
      signerName: "Test Kunde",
      paymentObligationAccepted: true,
      termsAccepted: true,
      withdrawalInformationReceived: true,
      earlyStartRequested: false,
      earlyStartLossAcknowledged: false,
      ipAddress: "",
      userAgent: "",
      securitySalt: "s".repeat(32),
    })).toThrow(/Signature drawing/);
  });

  it("records the authenticated supplier signer separately from the customer", () => {
    const evidence = createCompanySignatureEvidence({
      contract,
      expectedDocumentHash: documentHash(contract),
      signatureData,
      signerName: "Kari Administrator",
      signerUserId: 12,
      ipAddress: "192.0.2.2",
      userAgent: "admin browser",
      securitySalt: "s".repeat(32),
      now: new Date("2026-08-25T12:00:00Z"),
    });
    expect(evidence).toMatchObject({ signerName: "Kari Administrator", signerUserId: 12, method: "drawn-and-typed" });
    expect(JSON.stringify(evidence)).not.toContain("192.0.2.2");
  });
});
