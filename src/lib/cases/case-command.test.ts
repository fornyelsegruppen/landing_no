import { describe, expect, it, vi } from "vitest";
import { CaseCommandConflictError, executeCaseCommand } from "./case-command";

function payloadMock(revision = 1) {
  const lead = { id: 7, caseRevision: revision, status: "new" };
  const audit: Array<Record<string, unknown>> = [];
  return {
    audit,
    payload: {
      find: vi.fn(async ({ collection, where }: { collection: string; where?: unknown }) => ({ docs: collection === "audit-events" && where && audit.length ? audit : [] })),
      findByID: vi.fn(async () => lead),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(lead, data)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { audit.push(data); return { id: 1, ...data }; }),
    },
    lead,
  };
}

describe("central case command", () => {
  it("applies one revisioned update and records a safe audit event", async () => {
    const state = payloadMock();
    const result = await executeCaseCommand(state.payload as never, {
      leadId: 7, command: "start_measurement", idempotencyKey: "admin:7:start:1", expectedRevision: 1,
      patch: { status: "measuring", nextAction: "Review measurement", nextActionOwner: "administrator" },
    });
    expect(result).toMatchObject({ duplicate: false, revision: 2 });
    expect(state.lead).toMatchObject({ status: "measuring", caseRevision: 2 });
    expect(state.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      context: { trustedCaseCommand: true, expectedCaseRevision: 1 },
      req: { context: { trustedCaseCommand: true, expectedCaseRevision: 1 }, payloadAPI: "local" },
    }));
    expect(state.audit[0]).toMatchObject({ action: "case.start_measurement", entityId: "7" });
  });

  it("rejects a stale optimistic revision", async () => {
    const state = payloadMock(4);
    await expect(executeCaseCommand(state.payload as never, {
      leadId: 7, command: "close", idempotencyKey: "admin:7:close:1", expectedRevision: 3, patch: { status: "closed" },
    })).rejects.toBeInstanceOf(CaseCommandConflictError);
    expect(state.payload.update).not.toHaveBeenCalled();
  });

  it("returns the existing result for a repeated idempotency key", async () => {
    const state = payloadMock(2);
    state.audit.push({ id: 1 });
    const result = await executeCaseCommand(state.payload as never, {
      leadId: 7, command: "close", idempotencyKey: "admin:7:close:1", patch: { status: "closed" },
    });
    expect(result.duplicate).toBe(true);
    expect(state.payload.update).not.toHaveBeenCalled();
  });

  it("maps a write-time revision race to an explicit conflict", async () => {
    const state = payloadMock(2);
    state.payload.update.mockRejectedValueOnce(new Error("CASE_REVISION_CONFLICT:2:3"));
    await expect(executeCaseCommand(state.payload as never, {
      leadId: 7, command: "close", idempotencyKey: "admin:7:close:race", expectedRevision: 2, patch: { status: "closed" },
    })).rejects.toMatchObject({ expected: 2, actual: 3 });
  });
});
