import { describe, expect, it, vi } from "vitest";
import { buildQuoteSnapshot } from "@/lib/quotes/document";
import { assertAssignableWorker, createWorkOrderFromContract } from "./create";

const snapshot = buildQuoteSnapshot({
  quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 1",
  measurement: { id: 1, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1000, actualAreaMaxTenths: 1100, source: "test", credits: "test", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["Kontroller takvinkel"] },
  pricing: { calculationId: 1, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 10000, subtotalExVatOre: 1100000, vatBasisPoints: 2500, vatOre: 275000, totalIncVatOre: 1375000, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 1512500 },
  termsVersion: "v1", validUntil: "2099-09-01T00:00:00Z",
});

const documentHash = "8".repeat(64);
const signedAt = "2026-08-25T11:55:00Z";
const companySignedAt = "2026-08-25T12:00:00Z";

function fullySignedContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 7, reference: "K-1-V1", quote: 6, status: "signed", documentHash,
    signedAt, signedDocument: 30,
    signatureEvidence: {
      documentHash, signatureHash: "a".repeat(64), signerName: "Test Kunde", signedAt,
      method: "drawn-and-typed", paymentObligationAccepted: true, termsAccepted: true,
      withdrawalInformationReceived: true, earlyStartRequested: false,
      earlyStartLossAcknowledged: false, ipEvidenceHash: "b".repeat(64), userAgentEvidenceHash: "c".repeat(64),
    },
    companySignedAt, companySignedBy: 9, companySignatureImage: 31, companySignedDocument: 32,
    companySignatureEvidence: {
      documentHash, signatureHash: "d".repeat(64), signerName: "Kari Administrator", signerUserId: 9,
      signedAt: companySignedAt, method: "drawn-and-typed", ipEvidenceHash: "e".repeat(64), userAgentEvidenceHash: "f".repeat(64),
    },
    ...overrides,
  };
}

const finalContractPdf = { id: 32, mimeType: "application/pdf", classification: "contract", ownerType: "contract", ownerId: "7" };

describe("work-order creation", () => {
  it("blocks a customer-facing assignment without a complete worker profile", async () => {
    const payload = { findByID: vi.fn().mockResolvedValue({ id: 3, role: "worker", active: true, displayName: "Test Worker", phone: null }) };
    await expect(assertAssignableWorker(payload as never, 3)).rejects.toThrow(/phone/i);
  });

  it("is idempotent for one signed contract", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValueOnce(fullySignedContract()).mockResolvedValueOnce(finalContractPdf).mockResolvedValueOnce({ id: 6, lead: 1, status: "accepted", snapshot }).mockResolvedValueOnce({ id: 1, nextActionBlocker: null }),
      find: vi.fn().mockResolvedValue({ docs: [{ id: 9, reference: "A-K-1-V1" }] }), create: vi.fn(),
    };
    const result = await createWorkOrderFromContract(payload as never, { contractId: 7 });
    expect(result).toMatchObject({ created: false, workOrder: { id: 9 } });
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("creates the assignment and schedule atomically", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValueOnce({ id: 3, role: "worker", active: true, displayName: "Test Worker", phone: "+47 999 99 999" }).mockResolvedValueOnce(fullySignedContract()).mockResolvedValueOnce(finalContractPdf).mockResolvedValueOnce({ id: 6, lead: 1, status: "accepted", snapshot }).mockResolvedValueOnce({ id: 1, nextActionBlocker: null }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 10, status: "scheduled" }),
    };
    const result = await createWorkOrderFromContract(payload as never, {
      adminNote: "Internt",
      arrivalWindow: "08:00–10:00",
      assignedWorkerId: 3,
      contractId: 7,
      scheduledAt: "2026-08-25T06:30:00.000Z",
    });

    expect(result.created).toBe(true);
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "work-orders",
      data: expect.objectContaining({ assignedWorker: 3, scheduledAt: "2026-08-25T06:30:00.000Z", status: "scheduled" }),
    }));
  });

  it("blocks work creation while a customer cancellation request is unresolved", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValueOnce(fullySignedContract()).mockResolvedValueOnce(finalContractPdf).mockResolvedValueOnce({ id: 6, lead: 1, status: "accepted", snapshot }).mockResolvedValueOnce({ id: 1, nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST" }),
      find: vi.fn(), create: vi.fn(),
    };
    await expect(createWorkOrderFromContract(payload as never, { contractId: 7 })).rejects.toThrow(/cancellation request/i);
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("blocks historical signed rows that do not contain the two-party proof package", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue(fullySignedContract({ companySignedDocument: null })),
      find: vi.fn(), create: vi.fn(),
    };
    await expect(createWorkOrderFromContract(payload as never, { contractId: 7 })).rejects.toThrow(/final contract PDF/i);
    expect(payload.create).not.toHaveBeenCalled();
  });
});
