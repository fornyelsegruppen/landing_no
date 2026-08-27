import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createWorkOrder: vi.fn(),
  dispatchCustomer: vi.fn(),
  notifyWorker: vi.fn(),
  syncCommunications: vi.fn(),
  findByID: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ auth: mocks.auth, findByID: mocks.findByID })) }));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
vi.mock("@/lib/work-orders/create", () => ({ createWorkOrderFromContract: mocks.createWorkOrder }));
vi.mock("@/lib/work-orders/communications", () => ({
  dispatchAdminApprovedScheduleCommunicationNow: mocks.dispatchCustomer,
  notifyAssignedWorkerNow: mocks.notifyWorker,
  syncWorkOrderCommunicationJobs: mocks.syncCommunications,
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({ createPayloadAuditWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.recordAudit }));
vi.mock("@/lib/admin-v2/commercial-action-guard", () => ({
  assertExpectedDocumentHash: vi.fn(() => undefined),
  assertWorkOrderContractTarget: vi.fn(async () => undefined),
}));

import { POST } from "./route";

describe("admin work-order creation", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.findByID.mockReset().mockImplementation(async ({ collection }: { collection: string }) => collection === "contracts"
      ? { id: 7, quote: 4 }
      : { id: 4, lead: 1 });
    mocks.createWorkOrder.mockReset().mockResolvedValue({ created: true, workOrder: { id: 41, status: "scheduled" } });
    mocks.dispatchCustomer.mockReset().mockResolvedValue({ delivered: true, queued: false });
    mocks.notifyWorker.mockReset().mockResolvedValue({ delivered: true, queued: false });
    mocks.syncCommunications.mockReset().mockResolvedValue({ created: 0, cancelled: 0, skipped: true });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
  });

  it("creates and plans one order using Norwegian local time", async () => {
    const response = await POST(new Request("http://localhost/api/admin/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: 7, assignedWorkerId: 3, scheduledLocal: "2026-08-25T08:30", arrivalWindow: "08:30–10:00", adminNote: "Internt" }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createWorkOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      assignedWorkerId: 3,
      contractId: 7,
      scheduledAt: "2026-08-25T06:30:00.000Z",
    }));
    expect(mocks.dispatchCustomer).toHaveBeenCalledOnce();
    expect(mocks.notifyWorker).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      notification: "sent",
      customerNotification: "sent",
      workerNotification: "sent",
    });
  });

  it("does not accept a schedule without an employee", async () => {
    const response = await POST(new Request("http://localhost/api/admin/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: 7, scheduledLocal: "2026-08-25T08:30" }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.createWorkOrder).not.toHaveBeenCalled();
  });
});
