import { describe, expect, it } from "vitest";
import { protectQuoteVersion } from "./Quotes";
import { protectContractVersion } from "./Contracts";

const documentHash = "a".repeat(64);
const signedAt = "2026-08-25T09:00:00.000Z";
const companySignedAt = "2026-08-25T10:00:00.000Z";

function customerProof() {
  return {
    status: "signed", documentHash, signedAt, signedDocument: 30,
    signatureEvidence: {
      documentHash, signatureHash: "b".repeat(64), signerName: "Test Kunde", signedAt,
      method: "drawn-and-typed", paymentObligationAccepted: true, termsAccepted: true,
      withdrawalInformationReceived: true, earlyStartRequested: false, earlyStartLossAcknowledged: false,
      ipEvidenceHash: "c".repeat(64), userAgentEvidenceHash: "d".repeat(64),
    },
  };
}

describe("quote and contract version protection", () => {
  it("hashes a new quote snapshot", () => {
    const result = protectQuoteVersion({ operation: "create", data: { status: "draft", snapshot: { amount: 100 } } } as never) as Record<string, unknown>;
    expect(result.snapshotHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
  });
  it("requires a new version after quote approval", () => {
    expect(() => protectQuoteVersion({ operation: "update", data: { snapshot: { amount: 200 } }, originalDoc: { status: "approved", snapshot: { amount: 100 } } } as never)).toThrow(/new version/);
  });
  it("makes a signed contract immutable", () => {
    expect(() => protectContractVersion({ operation: "update", data: { status: "revoked" }, originalDoc: { status: "signed" } } as never)).toThrow();
  });
  it("allows supplier counter-signature fields when Payload also returns unchanged contract fields", () => {
    const originalDoc = {
      ...customerProof(),
      reference: "K-6-V1",
      snapshot: { customer: "Test" },
      companySignedAt: null,
    };
    const result = protectContractVersion({
      operation: "update",
      originalDoc,
      context: { trustedCompanyCountersignature: true },
      data: {
        ...originalDoc,
        companySignatureEvidence: { documentHash, signatureHash: "e".repeat(64), signerName: "Administrator", signerUserId: 9, signedAt: companySignedAt, method: "drawn-and-typed", ipEvidenceHash: "f".repeat(64), userAgentEvidenceHash: "1".repeat(64) },
        companySignatureImage: 31,
        companySignedDocument: 32,
        companySignedAt,
        companySignedBy: 9,
      },
    } as never);
    expect(result).toMatchObject({ companySignedBy: 9 });
  });
  it("blocks a privileged direct transition that has no trusted customer-signature workflow", () => {
    expect(() => protectContractVersion({ operation: "update", originalDoc: { status: "issued", documentHash }, data: customerProof() } as never)).toThrow(/verified customer-signature workflow/i);
  });
  it("requires the complete customer proof even in the trusted signing workflow", () => {
    expect(() => protectContractVersion({ operation: "update", originalDoc: { status: "issued", documentHash }, context: { trustedCustomerSignature: true }, data: { status: "signed", signedAt, signatureEvidence: customerProof().signatureEvidence } } as never)).toThrow(/customer-signed contract PDF/i);
  });
  it("accepts a complete customer proof from the trusted signing workflow", () => {
    expect(protectContractVersion({ operation: "update", originalDoc: { status: "issued", documentHash }, context: { trustedCustomerSignature: true }, data: customerProof() } as never)).toMatchObject({ status: "signed", signedDocument: 30 });
  });
  it("blocks partial or untrusted supplier counter-signatures", () => {
    const originalDoc = { ...customerProof(), companySignedAt: null };
    expect(() => protectContractVersion({ operation: "update", originalDoc, data: { companySignedAt, companySignedBy: 9 } } as never)).toThrow(/verified counter-signature workflow/i);
    expect(() => protectContractVersion({ operation: "update", originalDoc, context: { trustedCompanyCountersignature: true }, data: { companySignedAt, companySignedBy: 9 } } as never)).toThrow(/counter-signature evidence/i);
  });
  it("accepts a new draft contract even when Payload supplies an empty original document", () => {
    expect(protectContractVersion({ operation: "create", data: { status: "draft" }, originalDoc: {} } as never)).toEqual({ status: "draft" });
  });
});
