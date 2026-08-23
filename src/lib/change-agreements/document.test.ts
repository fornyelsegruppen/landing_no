import { describe, expect, it } from "vitest";
import { buildChangeAgreementSnapshot, changeDocumentHash, createChangeAcceptanceEvidence } from "./document";

const snapshot = buildChangeAgreementSnapshot({ reference: "E-9-V1", workOrderId: 9, contractId: 7, contractDocumentHash: "a".repeat(64), reasonCode: "over_maximum", reasonDescription: "Kontrollmålt takareal er større enn avtalt ramme.", before: { areaTenths: 1100, totalIncVatOre: 1700000, maximumTotalIncVatOre: 1870000 }, after: { areaTenths: 1300, subtotalExVatOre: 1800000, vatOre: 450000, totalIncVatOre: 2250000 }, issuedAt: "2026-08-23T10:00:00Z", validUntil: "2099-09-01T00:00:00Z" });

describe("change agreement document", () => {
  it("locks before/after values into deterministic acceptance evidence", () => {
    const evidence = createChangeAcceptanceEvidence({ snapshot, expectedDocumentHash: changeDocumentHash(snapshot), customerName: "Test Kunde", accepted: true, ipAddress: "192.0.2.1", userAgent: "test", securitySalt: "s".repeat(32), now: new Date("2026-08-23T12:00:00Z") });
    expect(evidence.documentHash).toBe(changeDocumentHash(snapshot));
    expect(JSON.stringify(evidence)).not.toContain("192.0.2.1");
  });

  it("rejects stale documents and implicit consent", () => {
    const base = { snapshot, customerName: "Test Kunde", accepted: true, ipAddress: "", userAgent: "", securitySalt: "s".repeat(32) };
    expect(() => createChangeAcceptanceEvidence({ ...base, expectedDocumentHash: "0".repeat(64) })).toThrow(/changed/);
    expect(() => createChangeAcceptanceEvidence({ ...base, expectedDocumentHash: changeDocumentHash(snapshot), accepted: false })).toThrow(/Explicit/);
  });
});
