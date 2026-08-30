import { describe, expect, it, vi } from "vitest";
import {
  assertContractReadyForWorkOrder,
  assertCustomerSignatureProof,
  assertFullySignedContractProof,
} from "./signing-invariants";

const documentHash = "a".repeat(64);
const signedAt = "2026-08-30T06:00:00.000Z";
const companySignedAt = "2026-08-30T06:05:00.000Z";

function signedContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    status: "signed",
    documentHash,
    signedAt,
    signedDocument: 30,
    signatureEvidence: {
      documentHash,
      signatureHash: "b".repeat(64),
      signerName: "Test Kunde",
      signedAt,
      method: "drawn-and-typed",
      paymentObligationAccepted: true,
      termsAccepted: true,
      withdrawalInformationReceived: true,
      earlyStartRequested: false,
      earlyStartLossAcknowledged: false,
      ipEvidenceHash: "c".repeat(64),
      userAgentEvidenceHash: "d".repeat(64),
    },
    companySignedAt,
    companySignedBy: 9,
    companySignatureImage: 31,
    companySignedDocument: 32,
    companySignatureEvidence: {
      documentHash,
      signatureHash: "e".repeat(64),
      signerName: "Kari Administrator",
      signerUserId: 9,
      signedAt: companySignedAt,
      method: "drawn-and-typed",
      ipEvidenceHash: "f".repeat(64),
      userAgentEvidenceHash: "1".repeat(64),
    },
    ...overrides,
  };
}

describe("contract signing invariants", () => {
  it("requires the immutable customer evidence and customer-signed PDF", () => {
    expect(() =>
      assertCustomerSignatureProof(signedContract({ signedDocument: null })),
    ).toThrow(/customer-signed contract PDF/i);
    expect(() =>
      assertCustomerSignatureProof(
        signedContract({ signatureEvidence: { documentHash } }),
      ),
    ).toThrow(/timestamp|incomplete/i);
  });

  it("requires an atomic supplier counter-signature and final PDF relation", () => {
    expect(() =>
      assertFullySignedContractProof(
        signedContract({ companySignedDocument: null }),
      ),
    ).toThrow(/final contract PDF/i);
    const contract = signedContract();
    expect(() =>
      assertFullySignedContractProof({
        ...contract,
        companySignatureEvidence: {
          ...(contract.companySignatureEvidence as Record<string, unknown>),
          signerUserId: 8,
        },
      }),
    ).toThrow(/recorded administrator/i);
  });

  it("accepts a complete two-party proof package", () => {
    expect(() =>
      assertFullySignedContractProof(signedContract()),
    ).not.toThrow();
  });

  it("verifies the final private PDF before allowing work-order creation", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 32,
        mimeType: "application/pdf",
        classification: "contract",
        ownerType: "contract",
        ownerId: "7",
      }),
    };
    await expect(
      assertContractReadyForWorkOrder(payload as never, signedContract()),
    ).resolves.toBeUndefined();
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "private-media", id: 32 }),
    );
  });

  it("rejects a final file that is not the contract-owned PDF", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 32,
        mimeType: "image/png",
        classification: "contract",
        ownerType: "contract",
        ownerId: "7",
      }),
    };
    await expect(
      assertContractReadyForWorkOrder(payload as never, signedContract()),
    ).rejects.toThrow(/verified private contract PDF/i);
  });

  it("returns a clear invariant error when the final PDF relation is broken", async () => {
    const payload = {
      findByID: vi.fn().mockRejectedValue(new Error("not found")),
    };
    await expect(
      assertContractReadyForWorkOrder(payload as never, signedContract()),
    ).rejects.toThrow(/verified private contract PDF/i);
  });
});
