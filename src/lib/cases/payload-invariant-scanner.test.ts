import { describe, expect, it, vi } from "vitest";
import { scanCaseInvariants } from "./payload-invariant-scanner";

describe("payload invariant scanner", () => {
  it("persists one attention item per issue and resolves it idempotently", async () => {
    const collections: Record<string, Array<Record<string, unknown>>> = {
      leads: [{ id: 1, status: "converted", recordState: "active", nextAction: "Create work", nextActionAt: "2026-08-25T12:00:00Z", nextActionOwner: "administrator" }],
      quotes: [{ id: 2, lead: 1, status: "accepted" }],
      contracts: [{ id: 3, quote: 2, status: "signed", companySignedAt: "2026-08-25T10:00:00Z" }],
      "work-orders": [], messages: [], "operational-jobs": [],
    };
    const payload = {
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
        const records = collections[collection] || [];
        if (collection === "operational-jobs" && where && JSON.stringify(where).includes("message.delivery")) return { docs: [] };
        return { docs: records };
      }),
      create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        const created = { id: (collections[collection]?.length || 0) + 10, ...data };
        collections[collection] ??= [];
        collections[collection].push(created);
        return created;
      }),
      update: vi.fn(async ({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) => {
        const found = collections[collection]?.find((item) => item.id === id);
        Object.assign(found || {}, data);
        return found;
      }),
    };

    const first = await scanCaseInvariants(payload as never, { persist: true, now: new Date("2026-08-25T12:00:00Z") });
    expect(first).toMatchObject({ cases: 1, issues: 1, created: 1, byCode: { FULLY_SIGNED_WITHOUT_WORK: 1 } });
    expect(collections["operational-jobs"]?.[0]).toMatchObject({ type: "case.invariant", status: "attention", payload: { leadId: 1, code: "FULLY_SIGNED_WITHOUT_WORK" } });

    collections["work-orders"].push({ id: 4, lead: 1, contract: 3, status: "scheduled", assignedWorker: 5, scheduledAt: "2026-08-30T06:00:00Z", arrivalWindow: "08:00–10:00" });
    const second = await scanCaseInvariants(payload as never, { persist: true, now: new Date("2026-08-25T12:05:00Z") });
    expect(second).toMatchObject({ issues: 0, created: 0, resolved: 1 });
    expect(collections["operational-jobs"]?.[0]).toMatchObject({ status: "completed", result: { resolved: true } });
  });
});
