import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { archiveCase, assertCaseCanBePurged, purgeCase, restoreCase, trashCase } from "./case-lifecycle";

function fixture(overrides: Record<string, unknown> = {}) {
  const lead = { id: 8, status: "new", recordState: "active", ...overrides };
  const rows: Record<string, Array<Record<string, unknown>>> = {
    leads: [lead], quotes: [], contracts: [], "work-orders": [], "invoice-records": [], warranties: [], messages: [], "change-agreements": [],
  };
  const update = vi.fn(async (args: { collection: string; id?: number; data: Record<string, unknown> }) => {
    if (args.id) {
      const row = rows[args.collection]?.find((item) => item.id === args.id);
      if (row) Object.assign(row, args.data);
      return row || { id: args.id, ...args.data };
    }
    return { docs: [] };
  });
  const remove = vi.fn(async (args: { collection: string; id: number }) => {
    rows[args.collection] = (rows[args.collection] || []).filter((item) => item.id !== args.id);
    return { id: args.id };
  });
  const payload = {
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) => rows[collection].find((item) => item.id === id)),
    find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      let docs = rows[collection] || [];
      const leadId = (where?.lead as { equals?: number } | undefined)?.equals;
      if (leadId) docs = docs.filter((item) => item.lead === leadId);
      const quoteIds = (where?.quote as { in?: number[] } | undefined)?.in;
      if (quoteIds) docs = docs.filter((item) => quoteIds.includes(Number(item.quote)));
      const contractIds = (where?.contract as { in?: number[] } | undefined)?.in;
      if (contractIds) docs = docs.filter((item) => contractIds.includes(Number(item.contract)));
      return { docs };
    }),
    update,
    delete: remove,
  } as unknown as Pick<Payload, "delete" | "find" | "findByID" | "update">;
  return { lead, payload, remove, rows, update };
}

describe("customer case lifecycle", () => {
  it("archives a disposable enquiry, closes open drafts and removes it from active work", async () => {
    const state = fixture();
    state.rows.messages.push({ id: 20, lead: 8, status: "draft" });
    state.rows.quotes.push({ id: 30, lead: 8, status: "approved" });
    state.rows.contracts.push({ id: 40, quote: 30, status: "draft" });
    const archived = await archiveCase(state.payload, 8, { actorId: 2, classification: "invalid", reason: "Test enquiry without a real customer", now: new Date("2026-08-25T10:00:00Z") });
    expect(archived).toMatchObject({ recordState: "archived", archiveClassification: "invalid", status: "closed" });
    expect(state.rows.messages[0].status).toBe("cancelled");
    expect(state.rows.quotes[0].status).toBe("revoked");
    expect(state.rows.contracts[0].status).toBe("revoked");
  });

  it("blocks archiving while a work order still needs operational resolution", async () => {
    const state = fixture();
    state.rows["work-orders"].push({ id: 70, lead: 8, status: "scheduled" });
    await expect(archiveCase(state.payload, 8, { actorId: 2, classification: "lost", reason: "Customer stopped responding" })).rejects.toThrow(/work order/);
  });

  it("moves a case to 30-day trash and restores it without deleting documents", async () => {
    const state = fixture();
    const trashed = await trashCase(state.payload, 8, { actorId: 2, classification: "spam", reason: "Automated spam enquiry", now: new Date("2026-08-25T10:00:00Z") });
    expect(trashed).toMatchObject({ recordState: "trashed", purgeAfter: "2026-09-24T10:00:00.000Z" });
    const restored = await restoreCase(state.payload, 8, { actorId: 2, reason: "Confirmed that this is a real customer", now: new Date("2026-08-26T10:00:00Z") });
    expect(restored).toMatchObject({ recordState: "active", purgeAfter: null });
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("never purges a signed or documented commercial case", async () => {
    const state = fixture({ recordState: "trashed", purgeAfter: "2026-08-01T00:00:00Z" });
    state.rows.quotes.push({ id: 30, lead: 8, status: "accepted" });
    state.rows.contracts.push({ id: 40, quote: 30, status: "signed" });
    await expect(assertCaseCanBePurged(state.payload, 8, new Date("2026-09-01T00:00:00Z"))).rejects.toThrow(/signed contract/);
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("requires retention expiry and the exact case number before permanent deletion", async () => {
    const state = fixture({ recordState: "trashed", purgeAfter: "2026-08-20T00:00:00Z" });
    await expect(purgeCase(state.payload, 8, { confirmation: "9", reason: "Expired disposable test data", now: new Date("2026-09-01T00:00:00Z") })).rejects.toThrow(/exact case number/);
    await expect(purgeCase(state.payload, 8, { confirmation: "8", reason: "Expired disposable test data", now: new Date("2026-09-01T00:00:00Z") })).resolves.toEqual({ deleted: true, id: 8 });
    expect(state.remove).toHaveBeenCalledWith(expect.objectContaining({ collection: "leads", context: { trustedLeadPurge: true } }));
  });
});
