import { describe, expect, it, vi } from "vitest";
import { rebuildCommercialPackage } from "./commercial-package";

function repository(input: { caseRevision: number; quoteId: number }) {
  const payload = {
    create: vi.fn(),
    update: vi.fn(),
    findByID: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === "leads") {
        return {
          id: 12,
          caseRevision: input.caseRevision,
          inquiryType: "takvask",
        };
      }
      throw new Error(`Unexpected collection ${collection}`);
    }),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === "roof-measurements") {
        return {
          docs: [{ id: 8, status: "approved", actualAreaMaxTenths: 1000 }],
        };
      }
      if (collection === "quotes") {
        return {
          docs: [{ id: input.quoteId, status: "draft" }],
        };
      }
      throw new Error(`Unexpected collection ${collection}`);
    }),
  };
  return payload;
}

const baseInput = {
  administratorId: 9,
  baseUnitPriceExVatOre: 9900,
  discountKind: "none" as const,
  discountValue: 0,
  expectedRevision: 12,
  leadId: 12,
  reason: "Godkjent kontrollgrunnlag",
  sourceQuoteId: 20,
};

describe("commercial package stale-context guards", () => {
  it("rejects a stale case revision before creating any record", async () => {
    const payload = repository({ caseRevision: 13, quoteId: 20 });
    await expect(
      rebuildCommercialPackage(payload as never, baseInput),
    ).rejects.toThrow("Commercial package state changed");
    expect(payload.create).not.toHaveBeenCalled();
    expect(payload.update).not.toHaveBeenCalled();
  });

  it("rejects a changed source quote before creating any record", async () => {
    const payload = repository({ caseRevision: 12, quoteId: 21 });
    await expect(
      rebuildCommercialPackage(payload as never, baseInput),
    ).rejects.toThrow("Commercial quote version changed");
    expect(payload.create).not.toHaveBeenCalled();
    expect(payload.update).not.toHaveBeenCalled();
  });
});
