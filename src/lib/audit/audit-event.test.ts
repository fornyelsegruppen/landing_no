import { describe, expect, it, vi } from "vitest";
import { prepareAuditEvent, recordAuditEvent } from "./audit-event";

describe("audit events", () => {
  it("stores hashes and field names instead of raw snapshots", () => {
    const event = prepareAuditEvent({
      actorId: 1,
      action: "quote.approved",
      entityType: "quote",
      entityId: 42,
      correlationId: "corr-12345678",
      changedFields: ["status", "amount", "status"],
      before: { status: "draft", customer: "Private" },
      after: { status: "approved", customer: "Private" },
      metadata: { version: 3 },
    });

    expect(event.changedFields).toEqual(["amount", "status"]);
    expect(event.beforeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.afterHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(event)).not.toContain("Private");
  });

  it("blocks sensitive metadata keys", () => {
    expect(() =>
      prepareAuditEvent({
        action: "lead.read",
        entityType: "lead",
        entityId: 1,
        correlationId: "corr-12345678",
        metadata: { customerEmail: "private@example.com" },
      }),
    ).toThrow(/forbidden/);
  });

  it("passes prepared data to the storage adapter", async () => {
    const writer = vi.fn(async () => undefined);
    await recordAuditEvent(writer, {
      action: "worker.assigned",
      entityType: "work-order",
      entityId: "work-1",
      correlationId: "corr-12345678",
    });
    expect(writer).toHaveBeenCalledOnce();
  });
});
