import { describe, expect, it } from "vitest";
import { buildCompletionConfirmationPdf, buildInvoiceDraftPdf, completionDocumentHash, type CompletionConfirmationSnapshot, type InvoiceDraftSnapshot } from "./completion-documents";

describe("completion documents", () => {
  it("builds branded invoice-draft and completion-confirmation PDFs from hashed snapshots", async () => {
    const invoice: InvoiceDraftSnapshot = { schemaVersion: "invoice-draft.v1", reference: "FU-1-V1", workOrderReference: "A-1", contractReference: "K-1", customer: { name: "Kunde", address: "Testveien 1" }, serviceDescription: "Takvask", issuedAt: "2026-08-25T10:00:00Z", dueAt: "2026-09-08T10:00:00Z", amounts: { subtotalExVatOre: 100000, vatOre: 25000, totalIncVatOre: 125000 }, notice: "Ikke bokført" };
    const completion: CompletionConfirmationSnapshot = { schemaVersion: "completion-confirmation.v1", reference: "FD-1-V1", workOrderReference: "A-1", contractReference: "K-1", customer: { name: "Kunde", address: "Testveien 1" }, serviceDescription: "Takvask", completedAt: "2026-08-25T10:00:00Z", reviewedAt: "2026-08-25T12:00:00Z", actualAreaTenths: 1000, amounts: { subtotalExVatOre: 100000, vatOre: 25000, totalIncVatOre: 125000 }, beforePhotoCount: 2, afterPhotoCount: 2, completionNotes: "Arbeidet er ferdig.", reviewNote: "Kontrollert av administrator." };
    expect(completionDocumentHash(invoice)).toHaveLength(64);
    expect(completionDocumentHash(completion)).toHaveLength(64);
    expect(Buffer.from(await buildInvoiceDraftPdf(invoice)).subarray(0, 4).toString()).toBe("%PDF");
    expect(Buffer.from(await buildCompletionConfirmationPdf(completion)).subarray(0, 4).toString()).toBe("%PDF");
  });
});
