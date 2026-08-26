import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQuoteDraft } from "./payload-quote-engine";

describe("controlled quote change", () => {
  const previousLegalReference = process.env.LEGAL_REVIEW_REFERENCE;

  beforeEach(() => {
    process.env.LEGAL_REVIEW_REFERENCE = "OWNER-APPROVED-CONTROLLED-PILOT-2026-08-26";
  });

  afterEach(() => {
    if (previousLegalReference === undefined) delete process.env.LEGAL_REVIEW_REFERENCE;
    else process.env.LEGAL_REVIEW_REFERENCE = previousLegalReference;
  });

  it("creates a new immutable version linked to the accepted quote and signed contract", async () => {
    const update = vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => ({ id, ...data }));
    const create = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => ({ id: collection === "quotes" ? 20 : 30, ...data }));
    const payload = {
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === "price-calculations") return { id: 8, status: "ready", lead: 1, measurement: 2, priceRule: 3, inputHash: "b".repeat(64), subtotalExVatOre: 1_000_000, vatOre: 250_000, totalIncVatOre: 1_250_000, maximumTotalIncVatOre: 1_375_000 };
        if (collection === "leads") return { id: 1, name: "Test Kunde", email: "kunde@example.test", phone: "47735888" };
        if (collection === "roof-measurements") return { id: 2, version: 1, status: "approved", normalizedAddress: "Testveien 1", measurementMode: "manual_no_visual", manualAreaSource: "admin_estimate", manualAreaReason: "Kontrollert testareal", horizontalAreaTenths: 900, actualAreaMinTenths: 1_000, actualAreaMaxTenths: 1_000, inputHash: "a".repeat(64), source: "administrator", credits: "Takfornyelse", capturedAt: "2026-08-26T10:00:00.000Z", approvedAt: "2026-08-26T10:05:00.000Z" };
        if (collection === "price-rules") return { id: 3, version: 1, status: "approved", serviceKey: "takvask_impregnering", unitPriceExVatOre: 10_000, vatBasisPoints: 2_500, minimumExVatOre: 0, toleranceBasisPoints: 1_000 };
        throw new Error(`Unexpected collection ${collection}`);
      }),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === "contract-terms") return { docs: [{ id: 4, version: "PRODUCTION-PILOT-V1", status: "approved", legalReviewReference: process.env.LEGAL_REVIEW_REFERENCE, contractText: "Kontrollerte avtalevilkår", withdrawalInstructions: "Angrefrist", withdrawalFormUrl: "https://example.test/angrerett" }] };
        if (collection === "quotes") return { docs: [{ id: 10, version: 1, status: "accepted" }] };
        if (collection === "contracts") return { docs: [{ id: 11, version: 1, status: "signed", companySignedAt: "2026-08-26T11:00:00.000Z" }] };
        return { docs: [] };
      }),
      create,
      update,
      delete: vi.fn(),
    };

    const result = await createQuoteDraft(payload as never, 8, new Date("2026-08-26T12:00:00.000Z"), { controlledChangeFromQuoteId: 10 });

    expect(result.quote).toMatchObject({ id: 20, reference: "T-1-V2", supersedes: 10, status: "draft" });
    expect(result.contract).toMatchObject({ id: 30, reference: "K-1-V2", supersedes: 11, status: "draft" });
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "quotes", id: 10 }));
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "contracts", id: 11 }));
  });
});
