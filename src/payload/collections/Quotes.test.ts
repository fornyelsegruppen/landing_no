import { describe, expect, it } from "vitest";
import {
  buildContractSnapshot,
  buildQuoteSnapshot,
  documentHash as hashDocument,
} from "@/lib/quotes/document";
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
  const rfQuoteSnapshot = buildQuoteSnapshot({
    quoteReference: "T-12-V1",
    leadId: 12,
    serviceKey: "takvask",
    serviceDescription: "Takvask",
    propertyAddress: "Testveien 12, 0012 Oslo",
    measurement: {
      id: 31,
      version: 1,
      inputHash: "d".repeat(64),
      horizontalAreaTenths: 1_000,
      actualAreaMinTenths: 1_080,
      actualAreaMaxTenths: 1_180,
      source: "Roof Fusion",
      credits: "Licensed test source",
      capturedAt: "2026-09-04T10:00:00.000Z",
      assumptions: [],
      rfBinding: {
        caseRevision: 3,
        addressRevision: 2,
        snapshotId: "rf-1-r4",
        snapshotRevision: 4,
        snapshotHash: "a".repeat(64),
        sourceInputHash: "b".repeat(64),
        rendererHash: "c".repeat(64),
      },
    },
    pricing: {
      calculationId: 32,
      inputHash: "e".repeat(64),
      ruleId: 21,
      ruleVersion: 4,
      unitPriceExVatOre: 10_000,
      subtotalExVatOre: 1_180_000,
      vatBasisPoints: 2_500,
      vatOre: 295_000,
      totalIncVatOre: 1_475_000,
      toleranceBasisPoints: 1_000,
      maximumTotalIncVatOre: 1_622_500,
    },
    termsVersion: "terms-4",
    validUntil: "2099-09-18T10:00:00.000Z",
  });
  const rfQuoteData = {
    status: "draft",
    reference: rfQuoteSnapshot.quoteReference,
    lead: rfQuoteSnapshot.leadId,
    measurement: rfQuoteSnapshot.measurement.id,
    priceCalculation: rfQuoteSnapshot.pricing.calculationId,
    version: 1,
    snapshot: rfQuoteSnapshot,
    serviceDescription: rfQuoteSnapshot.serviceDescription,
    totalIncVatOre: rfQuoteSnapshot.pricing.totalIncVatOre,
    maximumTotalIncVatOre:
      rfQuoteSnapshot.pricing.maximumTotalIncVatOre,
    termsVersion: rfQuoteSnapshot.termsVersion,
    validUntil: rfQuoteSnapshot.validUntil,
  };
  it("hashes a new quote snapshot", () => {
    const result = protectQuoteVersion({ operation: "create", data: { status: "draft", snapshot: { amount: 100 } } } as never) as Record<string, unknown>;
    expect(result.snapshotHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
  });
  it("requires a new version after quote approval", () => {
    expect(() => protectQuoteVersion({ operation: "update", data: { snapshot: { amount: 200 } }, originalDoc: { status: "approved", snapshot: { amount: 100 } } } as never)).toThrow(/new version/);
  });
  it("allows only the trusted bridge to create RF-bound drafts and freezes their exact quote lineage", () => {
    expect(() =>
      protectQuoteVersion({
        operation: "create",
        data: rfQuoteData,
      } as never),
    ).toThrow(/canonical Preview offer bridge/i);
    const created = protectQuoteVersion({
      operation: "create",
      context: { trustedRoofFusionOfferBridge: true },
      data: structuredClone(rfQuoteData),
    } as never) as Record<string, unknown>;
    expect(created.snapshotHash).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/u),
    );
    expect(() =>
      protectQuoteVersion({
        operation: "update",
        originalDoc: {
          status: "draft",
          snapshot: rfQuoteSnapshot,
          snapshotHash: created.snapshotHash,
        },
        data: { snapshot: { measurement: { mode: "legacy" } } },
      } as never),
    ).toThrow(/Roof Fusion-bound quote draft is immutable/i);
  });
  it("rejects a trusted RF quote when top-level relations disagree with its snapshot", () => {
    expect(() =>
      protectQuoteVersion({
        operation: "create",
        context: { trustedRoofFusionOfferBridge: true },
        data: { ...structuredClone(rfQuoteData), measurement: 999 },
      } as never),
    ).toThrow(/disagree with the immutable snapshot/i);
  });
  it("makes a signed contract immutable", () => {
    expect(() => protectContractVersion({ operation: "update", data: { status: "revoked" }, originalDoc: { status: "signed" } } as never)).toThrow();
  });
  it("allows only the trusted bridge to create RF-bound contracts and freezes their exact lineage", () => {
    const snapshot = buildContractSnapshot({
      contractReference: "K-12-V1",
      quote: rfQuoteSnapshot,
      customer: { name: "Test Kunde", address: "Testveien 12" },
      terms: {
        version: "terms-4",
        text: "Approved contract terms.",
        withdrawalInstructions: "Approved withdrawal instructions.",
        withdrawalFormUrl: "https://example.invalid/withdrawal",
      },
    });
    const contractData = {
      status: "draft",
      reference: snapshot.contractReference,
      quote: 41,
      version: 1,
      snapshot,
      documentHash: hashDocument(snapshot),
      termsVersion: snapshot.terms.version,
    };
    expect(() =>
      protectContractVersion({
        operation: "create",
        data: contractData,
      } as never),
    ).toThrow(/canonical Preview offer bridge/i);
    expect(
      protectContractVersion({
        operation: "create",
        context: { trustedRoofFusionOfferBridge: true },
        data: structuredClone(contractData),
      } as never),
    ).toMatchObject({ status: "draft", snapshot, quote: 41 });
    expect(() =>
      protectContractVersion({
        operation: "create",
        context: { trustedRoofFusionOfferBridge: true },
        data: { ...structuredClone(contractData), documentHash: "f".repeat(64) },
      } as never),
    ).toThrow(/disagree with the immutable quote and contract snapshots/i);
    expect(() =>
      protectContractVersion({
        operation: "update",
        originalDoc: { status: "draft", snapshot, documentHash },
        data: { documentHash: "f".repeat(64) },
      } as never),
    ).toThrow(/Roof Fusion-bound contract draft is immutable/i);
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
