import { describe, expect, it } from "vitest";
import { buildInvoiceDraftPdf, buildWarrantyPdf, completionDocumentHash, type InvoiceDraftSnapshot, type WarrantySnapshot } from "./completion-documents";

describe("completion documents", () => {
  it("builds branded invoice-draft and warranty PDFs from hashed snapshots", async () => {
    const invoice: InvoiceDraftSnapshot = { schemaVersion: "invoice-draft.v1", reference: "FU-1-V1", workOrderReference: "A-1", contractReference: "K-1", customer: { name: "Kunde", address: "Testveien 1" }, serviceDescription: "Takvask", issuedAt: "2026-08-25T10:00:00Z", dueAt: "2026-09-08T10:00:00Z", amounts: { subtotalExVatOre: 100000, vatOre: 25000, totalIncVatOre: 125000 }, notice: "Ikke bokført" };
    const warranty: WarrantySnapshot = { schemaVersion: "warranty.v1", reference: "G-1-V1", workOrderReference: "A-1", contractReference: "K-1", customer: { name: "Kunde", address: "Testveien 1" }, serviceDescription: "Takvask", scope: "Gjelder utført takvask.", startsAt: "2026-08-25T10:00:00Z", endsAt: "2027-08-25T10:00:00Z", termsVersion: "SAKSBEKREFTET-V1" };
    expect(completionDocumentHash(invoice)).toHaveLength(64);
    expect(completionDocumentHash(warranty)).toHaveLength(64);
    expect(Buffer.from(await buildInvoiceDraftPdf(invoice)).subarray(0, 4).toString()).toBe("%PDF");
    expect(Buffer.from(await buildWarrantyPdf(warranty)).subarray(0, 4).toString()).toBe("%PDF");
  });
});
