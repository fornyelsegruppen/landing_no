import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";

const mocks = vi.hoisted(() => ({
  createQuoteDraft: vi.fn(),
}));

vi.mock("@/lib/quotes/payload-quote-engine", () => ({
  createQuoteDraft: mocks.createQuoteDraft,
}));

import { overridePreparedLeadArea } from "./automatic-package";

describe("manual roof-area override", () => {
  beforeEach(() => {
    mocks.createQuoteDraft.mockReset().mockResolvedValue({ quote: { id: 32 }, contract: { id: 33 } });
  });

  it("creates a versioned measurement and rebuilds price, quote and contract from the verified area", async () => {
    const current = {
      id: 20,
      reference: "TM-8-V1",
      lead: 8,
      version: 1,
      status: "review_required",
      inputHash: "a".repeat(64),
      normalizedAddress: "Testveien 8",
      latitude: 59,
      longitude: 10,
      source: "OpenStreetMap",
      license: "ODbL",
      credits: "OSM",
      imageryLicensed: true,
      capturedAt: "2026-08-25T08:00:00.000Z",
      roofPlanes: [{ id: "roof", polygon: [{ latitude: 59, longitude: 10 }, { latitude: 59, longitude: 10.001 }, { latitude: 59.001, longitude: 10 }], angleMinDegrees: 22, angleMaxDegrees: 32 }],
      horizontalAreaTenths: 900,
      actualAreaMinTenths: 970,
      actualAreaMaxTenths: 1060,
      calculationSnapshot: { horizontalAreaTenths: 900 },
      confidence: "high",
      confidenceReasoning: "Automatic estimate",
      blockingReasons: [],
    };
    const create = vi.fn().mockImplementation(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => ({
      ...data,
      id: collection === "roof-measurements" ? 30 : 31,
    }));
    const update = vi.fn().mockResolvedValue({});
    const payload = {
      findByID: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => collection === "roof-measurements"
        ? current
        : { id: 8, inquiryType: "takvask", qualification: {} }),
      find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => collection === "quotes"
        ? { docs: [{ id: 22, status: "draft", version: 1 }] }
        : { docs: [{ id: 5, version: 1, serviceKey: "takvask", unitPriceExVatOre: 9900, vatBasisPoints: 2500, minimumExVatOre: 0, toleranceBasisPoints: 1000, status: "approved" }] }),
      create,
      update,
      delete: vi.fn(),
    } as unknown as Payload;

    const result = await overridePreparedLeadArea(payload, {
      measurementId: 20,
      administratorId: 9,
      areaSquareMeters: 140.5,
      reason: "Kontrollert mot godkjent tegning",
    });

    expect(result).toMatchObject({ measurementId: 30, calculationId: 31, quoteId: 32, contractId: 33, areaSquareMeters: 140.5 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "roof-measurements",
      data: expect.objectContaining({
        version: 2,
        supersedes: 20,
        actualAreaMinTenths: 1405,
        actualAreaMaxTenths: 1405,
        confidence: "high",
      }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "price-calculations",
      data: expect.objectContaining({ measurement: 30 }),
    }));
    expect(mocks.createQuoteDraft).toHaveBeenCalledWith(payload, 31, expect.any(Date), { allowPendingMeasurement: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ collection: "roof-measurements", id: 20, data: { status: "superseded" } }));
  });
});
