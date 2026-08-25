import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  recordAudit: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ auth: mocks.auth, findByID: mocks.findByID, update: mocks.update })) }));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
vi.mock("@/lib/audit/payload-audit-writer", () => ({ createPayloadAuditWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.recordAudit }));

import { PATCH } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/work-orders/12", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("admin work-order planning", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.findByID.mockReset().mockResolvedValue({ id: 12, status: "unassigned", assignedWorker: null, scheduledAt: null });
    mocks.update.mockReset().mockResolvedValue({ id: 12, status: "scheduled", assignedWorker: { id: 3 }, scheduledAt: "2026-08-25T06:30:00.000Z", arrivalWindow: "08:00–10:00" });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
  });

  it("assigns and schedules in one audited update", async () => {
    const response = await PATCH(request({ action: "save", assignedWorkerId: 3, scheduledLocal: "2026-08-25T08:30", arrivalWindow: "08:30–10:00" }), { params: Promise.resolve({ id: "12" }) });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedWorker: 3, scheduledAt: "2026-08-25T06:30:00.000Z" }) }));
    expect(mocks.recordAudit).toHaveBeenCalled();
  });

  it("refuses to clear the date of an already scheduled order", async () => {
    mocks.findByID.mockResolvedValue({ id: 12, status: "scheduled", assignedWorker: 3, scheduledAt: "2026-08-25T06:30:00.000Z" });
    const response = await PATCH(request({ action: "save", assignedWorkerId: 3, scheduledLocal: "" }), { params: Promise.resolve({ id: "12" }) });
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
