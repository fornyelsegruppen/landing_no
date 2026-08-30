import { describe, expect, it, vi } from "vitest";
import {
  protectWorkOrder,
  scheduleWorkOrderCommunications,
} from "./WorkOrders";

const documentHash = "8".repeat(64);
const signedAt = "2026-08-25T11:55:00Z";
const companySignedAt = "2026-08-25T12:00:00Z";

function fullySignedContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 4, status: "signed", quote: 3, documentHash, signedAt, signedDocument: 30,
    signatureEvidence: {
      documentHash, signatureHash: "a".repeat(64), signerName: "Test Kunde", signedAt,
      method: "drawn-and-typed", paymentObligationAccepted: true, termsAccepted: true,
      withdrawalInformationReceived: true, earlyStartRequested: false, earlyStartLossAcknowledged: false,
      ipEvidenceHash: "b".repeat(64), userAgentEvidenceHash: "c".repeat(64),
    },
    companySignedAt, companySignedBy: 9, companySignatureImage: 31, companySignedDocument: 32,
    companySignatureEvidence: {
      documentHash, signatureHash: "d".repeat(64), signerName: "Kari Administrator", signerUserId: 9,
      signedAt: companySignedAt, method: "drawn-and-typed", ipEvidenceHash: "e".repeat(64), userAgentEvidenceHash: "f".repeat(64),
    },
    ...overrides,
  };
}

function request(contract = fullySignedContract()) {
  return { payload: { findByID: vi.fn()
    .mockResolvedValueOnce(contract)
    .mockResolvedValueOnce({ id: 32, mimeType: "application/pdf", classification: "contract", ownerType: "contract", ownerId: "4" })
    .mockResolvedValueOnce({ id: 3, status: "accepted", lead: 2 })
    .mockResolvedValueOnce({ id: 8, role: "worker", active: true }) } };
}

describe("work-order collection invariants", () => {
  it("creates work only from a signed accepted contract and active worker", async () => {
    const result = await protectWorkOrder({ operation: "create", req: request(), data: { contract: 4, assignedWorker: 8, scheduledAt: "2026-09-01T08:00:00Z" }, originalDoc: { status: "unassigned" } } as never) as Record<string, unknown>;
    expect(result).toMatchObject({ quote: 3, lead: 2, contractDocumentHash: documentHash, status: "scheduled" });
  });

  it("blocks direct collection creation from an incomplete historical signed contract", async () => {
    await expect(protectWorkOrder({ operation: "create", req: request(fullySignedContract({ companySignatureEvidence: null })), data: { contract: 4 }, originalDoc: { status: "unassigned" } } as never)).rejects.toThrow(/counter-signature evidence/i);
  });

  it("blocks status jumps and work start without a completed precheck", async () => {
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, context: { trustedWorkerAction: true }, data: { status: "in_progress" }, originalDoc: { status: "scheduled" } } as never)).rejects.toThrow(/transition/);
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, context: { trustedWorkerAction: true }, data: { status: "in_progress" }, originalDoc: { status: "ready", beforePhotos: [1, 2], roofType: "teglstein", actualAreaTenths: 1000, measurementMethod: "laser", slopeBasis: "32 grader", visibleCondition: "Kontrollert", safetyStatus: "safe", precheckDecision: "blocked", priceOutcome: "hms_blocked", actualTotalIncVatOre: 1000 } } as never)).rejects.toThrow(/Blocked work/);
  });

  it("requires after photos before completion and documentation", async () => {
    const base = { status: "in_progress", beforePhotos: [1, 2], roofType: "teglstein", actualAreaTenths: 1000, measurementMethod: "laser", slopeBasis: "32 grader", visibleCondition: "Kontrollert", safetyStatus: "safe", precheckDecision: "ready", priceOutcome: "within_contract", actualTotalIncVatOre: 1000 };
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, context: { trustedWorkerAction: true }, data: { status: "completed" }, originalDoc: base } as never)).rejects.toThrow(/after photos/);
  });

  it("only allows documented status through the administrative completion review", async () => {
    const originalDoc = { id: 7, status: "completed", beforePhotos: [1, 2], afterPhotos: [3, 4], roofType: "teglstein", actualAreaTenths: 1000, measurementMethod: "laser", slopeBasis: "32 grader", visibleCondition: "Kontrollert", safetyStatus: "safe", precheckDecision: "ready", priceOutcome: "within_contract", actualTotalIncVatOre: 1000, completionNotes: "Arbeidet er dokumentert.", completedAt: "2026-09-01T12:00:00Z" };
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, data: { status: "documented" }, originalDoc } as never)).rejects.toThrow(/Administrator completion review/);
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, context: { trustedCompletionReview: true }, data: { status: "documented", completionReviewedBy: 1, completionReviewedAt: "2026-09-01T13:00:00Z" }, originalDoc } as never)).resolves.toMatchObject({ status: "documented" });
  });

  it("marks the lead converted when documentation is submitted", async () => {
    const update = vi.fn().mockResolvedValue({});
    await scheduleWorkOrderCommunications({
      operation: "update",
      doc: {
        id: 9,
        lead: 2,
        status: "documented",
        scheduledAt: "2026-09-01T08:00:00Z",
        documentationSubmittedAt: "2026-09-01T12:00:00Z",
      },
      previousDoc: {
        id: 9,
        lead: 2,
        status: "completed",
        scheduledAt: "2026-09-01T08:00:00Z",
      },
      req: { payload: { update }, headers: new Headers() },
    } as never);

    expect(update).toHaveBeenCalledWith({
      collection: "leads",
      depth: 0,
      id: 2,
      overrideAccess: true,
      data: {
        status: "converted",
        nextAction: "Kontroller dokumentene og arkiver den fullførte kundesaken.",
        nextActionAt: expect.any(String),
        nextActionOwner: "administrator",
      },
    });
  });
});
