import { describe, expect, it, vi } from "vitest";
import { protectWorkOrder } from "./WorkOrders";

function request() {
  return { payload: { findByID: vi.fn()
    .mockResolvedValueOnce({ id: 4, status: "signed", quote: 3, documentHash: "h".repeat(64) })
    .mockResolvedValueOnce({ id: 3, status: "accepted", lead: 2 })
    .mockResolvedValueOnce({ id: 8, role: "worker", active: true }) } };
}

describe("work-order collection invariants", () => {
  it("creates work only from a signed accepted contract and active worker", async () => {
    const result = await protectWorkOrder({ operation: "create", req: request(), data: { contract: 4, assignedWorker: 8, scheduledAt: "2026-09-01T08:00:00Z" } } as never) as Record<string, unknown>;
    expect(result).toMatchObject({ quote: 3, lead: 2, contractDocumentHash: "h".repeat(64), status: "scheduled" });
  });

  it("blocks status jumps and work start without a completed precheck", async () => {
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, context: { trustedWorkerAction: true }, data: { status: "in_progress" }, originalDoc: { status: "scheduled" } } as never)).rejects.toThrow(/transition/);
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, context: { trustedWorkerAction: true }, data: { status: "in_progress" }, originalDoc: { status: "ready", beforePhotos: [1, 2], roofType: "teglstein", actualAreaTenths: 1000, measurementMethod: "laser", slopeBasis: "32 grader", visibleCondition: "Kontrollert", safetyStatus: "safe", precheckDecision: "blocked", priceOutcome: "hms_blocked", actualTotalIncVatOre: 1000 } } as never)).rejects.toThrow(/Blocked work/);
  });

  it("requires after photos before completion and documentation", async () => {
    const base = { status: "in_progress", beforePhotos: [1, 2], roofType: "teglstein", actualAreaTenths: 1000, measurementMethod: "laser", slopeBasis: "32 grader", visibleCondition: "Kontrollert", safetyStatus: "safe", precheckDecision: "ready", priceOutcome: "within_contract", actualTotalIncVatOre: 1000 };
    await expect(protectWorkOrder({ operation: "update", req: { payload: {} }, context: { trustedWorkerAction: true }, data: { status: "completed" }, originalDoc: base } as never)).rejects.toThrow(/after photos/);
  });
});
