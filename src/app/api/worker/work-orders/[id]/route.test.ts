import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuoteSnapshot } from "@/lib/quotes/document";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findByID: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => mocks) }));
vi.mock("@/lib/platform/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform/features")>();
  return { ...actual, assertFeatureReady: vi.fn() };
});
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: vi.fn() }));

import { POST } from "./route";

const snapshot = buildQuoteSnapshot({
  quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 1",
  measurement: { id: 1, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1000, actualAreaMaxTenths: 1100, source: "test", credits: "test", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["test"] },
  pricing: { calculationId: 1, inputHash: "b".repeat(64), ruleId: 6, ruleVersion: 2, unitPriceExVatOre: 12500, subtotalExVatOre: 1375000, vatBasisPoints: 2500, vatOre: 343750, totalIncVatOre: 1718750, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 1890625 },
  termsVersion: "v1", validUntil: "2099-09-01T00:00:00Z",
});

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/worker/work-orders/9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("worker work-order API", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 2, role: "worker", active: true } });
    mocks.findByID.mockReset(); mocks.find.mockReset(); mocks.update.mockReset(); mocks.create.mockReset();
  });

  it("allows only the assigned worker to advance the order", async () => {
    const order = { id: 9, assignedWorker: 2, status: "scheduled", eventTimeline: [] };
    mocks.findByID.mockResolvedValueOnce(order);
    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...order, ...data }));
    const response = await POST(request({ action: "on_way" }), { params: Promise.resolve({ id: "9" }) });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "work-orders", id: 9, context: { trustedWorkerAction: true }, data: expect.objectContaining({ status: "on_way" }) }));
  });

  it("returns the same not-found result for another worker's order", async () => {
    mocks.findByID.mockResolvedValueOnce({ id: 9, assignedWorker: 3, status: "scheduled" });
    const response = await POST(request({ action: "on_way" }), { params: Promise.resolve({ id: "9" }) });
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("calculates and stores a ready onsite precheck from the signed price rule", async () => {
    const order = { id: 9, assignedWorker: 2, status: "precheck", quote: 5, eventTimeline: [] };
    mocks.findByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === "work-orders") return order;
      if (collection === "quotes") return { id: 5, snapshot };
      if (collection === "price-rules") return { id: 6, version: 2, status: "approved", unitPriceExVatOre: 12500, vatBasisPoints: 2500, minimumExVatOre: 500000 };
      throw new Error(`Unexpected ${collection}`);
    });
    mocks.find.mockResolvedValue({ docs: [{ id: 11 }, { id: 12 }] });
    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...order, ...data }));
    const response = await POST(request({ action: "submit_precheck", beforePhotoIds: [11, 12], roofType: "teglstein", actualAreaTenths: 1000, measurementMethod: "laser", slopeBasis: "Målt 32 grader", visibleCondition: "Takflaten er kontrollert", safetyStatus: "safe", safetyNotes: "", scopeChanged: false, scopeChangeDetails: "" }), { params: Promise.resolve({ id: "9" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready", decision: "ready", priceOutcome: "lower", actualTotalIncVatOre: 1562500 });
  });
});
