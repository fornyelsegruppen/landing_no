import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  deliver: vi.fn(),
  enqueue: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  recordAudit: vi.fn(),
  update: vi.fn(),
  userIsAdmin: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    create: mocks.create,
    find: mocks.find,
    findByID: mocks.findByID,
    update: mocks.update,
  })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.userIsAdmin }));
vi.mock("@/lib/audit/payload-audit-writer", () => ({ createPayloadAuditWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.recordAudit }));
vi.mock("@/lib/messages/message-engine", () => ({ deliverMessage: mocks.deliver, enqueueMessageJob: mocks.enqueue }));
vi.mock("@/lib/providers/email-provider", () => ({ createEmailProvider: vi.fn(() => ({ health: () => ({ status: "ready" }) })) }));

import { PATCH } from "./route";

function request(action: Record<string, unknown>) {
  return new Request("https://www.takfornyelse.as/api/admin/official-invoices/4", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 4,
    lead: 1,
    invoiceRecord: 2,
    invoiceNumber: "1004",
    status: "overdue",
    dueAt: "2026-01-01T12:00:00.000Z",
    totalIncVatOre: 125_000,
    bankCheckedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("official invoice reminders", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.userIsAdmin.mockReset().mockReturnValue(true);
    mocks.findByID.mockReset().mockResolvedValueOnce(invoice()).mockResolvedValueOnce({ id: 2, status: "sent" });
    mocks.find.mockReset().mockResolvedValue({ docs: [] });
    mocks.create.mockReset().mockResolvedValue({ id: 7, status: "draft" });
    mocks.update.mockReset().mockResolvedValue({ id: 4, status: "overdue" });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
    mocks.deliver.mockReset();
    mocks.enqueue.mockReset();
  });

  it("refuses to prepare a reminder without a bank check from today", async () => {
    mocks.findByID.mockReset().mockResolvedValueOnce(invoice({ bankCheckedAt: null }));

    const response = await PATCH(request({ action: "draft_reminder" }), { params: Promise.resolve({ id: "4" }) });

    expect(response.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("creates a draft only and never sends it automatically", async () => {
    const response = await PATCH(request({ action: "draft_reminder" }), { params: Promise.resolve({ id: "4" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "draft", messageId: 7, duplicate: false });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "messages",
      data: expect.objectContaining({ status: "draft", category: "reminder", aiAssisted: false }),
    }));
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("reuses the same daily reminder draft", async () => {
    mocks.find.mockResolvedValue({ docs: [{ id: 8, status: "draft" }] });

    const response = await PATCH(request({ action: "draft_reminder" }), { params: Promise.resolve({ id: "4" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ duplicate: true, messageId: 8 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});
