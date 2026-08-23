import { describe, expect, it, vi } from "vitest";
import { buildQuoteSnapshot } from "@/lib/quotes/document";
import { createWorkOrderFromContract } from "./create";

const snapshot = buildQuoteSnapshot({
  quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 1",
  measurement: { id: 1, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1000, actualAreaMaxTenths: 1100, source: "test", credits: "test", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["Kontroller takvinkel"] },
  pricing: { calculationId: 1, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 10000, subtotalExVatOre: 1100000, vatBasisPoints: 2500, vatOre: 275000, totalIncVatOre: 1375000, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 1512500 },
  termsVersion: "v1", validUntil: "2099-09-01T00:00:00Z",
});

describe("work-order creation", () => {
  it("is idempotent for one signed contract", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValueOnce({ id: 7, reference: "K-1-V1", quote: 6, status: "signed", documentHash: "h".repeat(64) }).mockResolvedValueOnce({ id: 6, lead: 1, status: "accepted", snapshot }),
      find: vi.fn().mockResolvedValue({ docs: [{ id: 9, reference: "A-K-1-V1" }] }), create: vi.fn(),
    };
    const result = await createWorkOrderFromContract(payload as never, { contractId: 7 });
    expect(result).toMatchObject({ created: false, workOrder: { id: 9 } });
    expect(payload.create).not.toHaveBeenCalled();
  });
});
