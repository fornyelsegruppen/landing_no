import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { loadAdminDocuments } from "./documents";

describe("admin document center", () => {
  it("groups immutable quote and final contract documents under one case", async () => {
    const find = vi.fn().mockImplementation(async ({ collection }: { collection: string }) => ({ docs: ({
      leads: [{ id: 1, name: "Test Kunde" }],
      quotes: [{ id: 2, lead: 1, reference: "T-1-V1", version: 1, status: "accepted", snapshotHash: "q".repeat(64) }],
      contracts: [{ id: 3, quote: 2, reference: "K-1-V1", version: 1, status: "signed", companySignedDocument: 4, documentHash: "c".repeat(64) }],
      "work-orders": [], "change-agreements": [],
      "roof-measurements": [{ id: 5, lead: 1, reference: "TM-1-V1", version: 1, status: "approved", mapImage: 6, inputHash: "m".repeat(64) }],
      "invoice-records": [{ id: 7, lead: 1, reference: "FU-1-V1", status: "draft", document: 8, documentHash: "i".repeat(64) }],
      warranties: [{ id: 9, lead: 1, reference: "G-1-V1", status: "active", document: 10, documentHash: "w".repeat(64) }],
      "private-media": [
        { id: 4, filename: "endelig-k-1-v1.pdf", url: "https://safe.blob.vercel-storage.com/private/f.pdf" },
        { id: 6, filename: "tak-kart.png", url: "https://safe.blob.vercel-storage.com/private/map.png" },
        { id: 8, filename: "fu-1-v1-utkast.pdf", url: "https://safe.blob.vercel-storage.com/private/invoice.pdf" },
        { id: 10, filename: "g-1-v1-garanti.pdf", url: "https://safe.blob.vercel-storage.com/private/warranty.pdf" },
      ],
    } as Record<string, unknown[]>)[collection] || [] }));
    const result = await loadAdminDocuments({ find } as unknown as Pick<Payload, "find">);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "quote", reference: "T-1-V1", caseHref: "/admin-v2/cases/1" }),
      expect.objectContaining({ type: "final_contract", reference: "K-1-V1", href: "/api/admin/media/4" }),
      expect.objectContaining({ type: "measurement", reference: "TM-1-V1", href: "/api/admin/media/6" }),
      expect.objectContaining({ type: "invoice_draft", reference: "FU-1-V1", href: "/api/admin/media/8" }),
      expect.objectContaining({ type: "warranty", reference: "G-1-V1", href: "/api/admin/media/10" }),
    ]));
  });
});
