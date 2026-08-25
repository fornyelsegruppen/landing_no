import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";

const mocks = vi.hoisted(() => ({
  createMedia: vi.fn(),
  dispatch: vi.fn(),
  invoicePdf: vi.fn(),
  warrantyPdf: vi.fn(),
}));

vi.mock("@/lib/private-media-storage", () => ({ createPrivateMedia: mocks.createMedia }));
vi.mock("@/lib/work-orders/communications", () => ({ dispatchCompletionCommunicationNow: mocks.dispatch }));
vi.mock("./completion-documents", async (load) => {
  const actual = await load<typeof import("./completion-documents")>();
  return { ...actual, buildInvoiceDraftPdf: mocks.invoicePdf, buildWarrantyPdf: mocks.warrantyPdf };
});

import { finalizeWorkOrderReview } from "./completion-review";

function fixture(maximum = 130000) {
  const order = { id: 7, reference: "A-7", lead: 1, quote: 2, contract: 3, status: "completed", workSummary: "Takvask", beforePhotos: [10, 11], afterPhotos: [12, 13], actualAreaTenths: 1000, actualSubtotalExVatOre: 100000, actualVatOre: 25000, actualTotalIncVatOre: 125000, completedAt: "2026-08-25T10:00:00Z", documentationSubmittedAt: "2026-08-25T10:10:00Z", completionNotes: "Arbeidet er kontrollert og ferdig.", eventTimeline: [] };
  const findByID = vi.fn().mockImplementation(async ({ collection }: { collection: string }) => ({
    "work-orders": order,
    leads: { id: 1, name: "Test Kunde", email: "kunde@example.no", address: "Testveien", houseNumber: "1", postal: "0001", city: "Oslo" },
    quotes: { id: 2, reference: "T-1", maximumTotalIncVatOre: maximum },
    contracts: { id: 3, reference: "K-1", status: "signed", companySignedAt: "2026-08-24T12:00:00Z" },
  } as Record<string, unknown>)[collection]);
  const find = vi.fn().mockResolvedValue({ docs: [] });
  let mediaId = 90;
  const create = vi.fn().mockImplementation(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => ({ id: collection === "invoice-records" ? 20 : 21, ...data }));
  const update = vi.fn().mockImplementation(async ({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) => collection === "work-orders" ? { ...order, ...data } : { id, ...data });
  mocks.createMedia.mockImplementation(async () => ({ id: mediaId++, filename: "document.pdf" }));
  return { payload: { findByID, find, create, update } as unknown as Payload, create, update };
}

describe("admin completion review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoicePdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    mocks.warrantyPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    mocks.dispatch.mockResolvedValue({ delivered: true });
  });

  it("creates an invoice draft and warranty before finalizing documented work", async () => {
    const { payload, create, update } = fixture();
    const result = await finalizeWorkOrderReview(payload, { workOrderId: 7, actorId: 9, invoiceDueDays: 14, warrantyMonths: 24, warrantyScope: "Gjelder dokumentert takvask.", reviewNote: "Kontrollert bilder og sluttbeløp.", correlationId: "test", now: new Date("2026-08-25T12:00:00Z") });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ collection: "invoice-records", data: expect.objectContaining({ status: "draft", totalIncVatOre: 125000 }) }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ collection: "warranties", data: expect.objectContaining({ status: "active", scope: "Gjelder dokumentert takvask." }) }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ collection: "work-orders", context: { trustedCompletionReview: true }, data: expect.objectContaining({ status: "documented", completionReviewedBy: 9 }) }));
    expect(result.workOrder.status).toBe("documented");
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it("blocks a final amount above the signed maximum without an accepted change", async () => {
    const { payload } = fixture(120000);
    await expect(finalizeWorkOrderReview(payload, { workOrderId: 7, actorId: 9, invoiceDueDays: 14, warrantyMonths: 12, warrantyScope: "Gjelder dokumentert takvask.", reviewNote: "Kontrollert bilder og sluttbeløp.", correlationId: "test" })).rejects.toThrow(/exceeds the signed maximum/);
    expect(mocks.createMedia).not.toHaveBeenCalled();
  });
});
