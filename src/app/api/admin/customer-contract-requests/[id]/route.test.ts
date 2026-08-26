import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn(), find: vi.fn(), findByID: vi.fn(), update: vi.fn(), updateCase: vi.fn() }));
vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ auth: mocks.auth, create: mocks.create, find: mocks.find, findByID: mocks.findByID, update: mocks.update })) }));
vi.mock("@/lib/cases/case-command", () => ({ updateCaseState: mocks.updateCase }));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/customer-contract-requests/10", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("administrator customer contract request decision", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 3, role: "admin", active: true } });
    mocks.findByID.mockReset().mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === "customer-contract-requests") return { id: 10, reference: "ANG-2-TEST", lead: 2, kind: "withdrawal", status: "admin_review", sourceMessage: 9 };
      if (collection === "leads") return { id: 2, name: "Test Kunde", email: "test@example.test" };
      throw new Error(`Unexpected collection ${collection}`);
    });
    mocks.find.mockReset().mockResolvedValue({ docs: [{ id: 7, status: "blocked", statusBeforeCustomerCancellation: "scheduled", blockingReasons: ["CUSTOMER_CANCELLATION_REQUEST"] }] });
    mocks.update.mockReset().mockImplementation(async ({ id, data }: { id: number; data: Record<string, unknown> }) => ({ id, ...data }));
    mocks.create.mockReset().mockImplementation(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => ({ id: collection === "messages" ? 20 : 21, ...data }));
    mocks.updateCase.mockReset().mockResolvedValue({});
  });

  it("closes the order, clears the work hold and creates a reviewable customer confirmation", async () => {
    const internalDecision = "Sutartis ir darbų būsena patikrinta administratoriaus.";
    const response = await POST(request({ decision: "close", reason: internalDecision }), { params: Promise.resolve({ id: "10" }) });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "work-orders", id: 7, data: expect.objectContaining({ status: "cancelled", blockingReasons: [] }) }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "customer-contract-requests", id: 10, data: expect.objectContaining({ status: "closed", reviewedBy: 3, administratorDecision: internalDecision }) }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ collection: "messages", data: expect.objectContaining({
      status: "draft",
      subject: "Bekreftelse på behandlet angremelding",
      bodyText: expect.stringContaining("bekrefter at avtalen er avsluttet"),
    }) }));
    const customerMessage = mocks.create.mock.calls.find(([input]) => input.collection === "messages")?.[0].data.bodyText;
    expect(customerMessage).not.toContain(internalDecision);
    expect(mocks.updateCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ leadId: 2, patch: expect.objectContaining({ status: "closed", nextActionBlocker: null }) }));
  });

  it("keeps work frozen while a consented follow-up is scheduled", async () => {
    const response = await POST(request({ decision: "schedule_follow_up", reason: "Kunden ønsker kontakt på valgt dato.", followUpAt: "2026-11-26T10:00:00.000Z" }), { params: Promise.resolve({ id: "10" }) });
    expect(response.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "work-orders" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "customer-contract-requests", data: expect.objectContaining({ status: "follow_up_scheduled", followUpAt: "2026-11-26T10:00:00.000Z" }) }));
    expect(mocks.updateCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ patch: expect.objectContaining({ nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST" }) }));
  });
});
