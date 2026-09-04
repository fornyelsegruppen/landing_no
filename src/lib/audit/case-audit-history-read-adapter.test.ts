import { describe, expect, it, vi } from "vitest";
import type { AuditHistorySourceEvent } from "./audit-history-projection";
import {
  adaptCanonicalCaseAuditHistory,
  createCaseAuditHistoryReadAdapter,
  type CaseAuditHistoryReadResult,
} from "./case-audit-history-read-adapter";

function auditEvent(
  overrides: Partial<AuditHistorySourceEvent> = {},
): AuditHistorySourceEvent {
  return {
    id: 1,
    actor: 7,
    action: "case.update_intake",
    entityType: "lead",
    entityId: "13",
    correlationId: "corr-case-13",
    changedFields: ["status"],
    createdAt: "2026-09-04T10:00:00.000Z",
    updatedAt: "2026-09-04T10:00:00.000Z",
    ...overrides,
  };
}

function ready(result: CaseAuditHistoryReadResult) {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error(result.reason);
  return result.value;
}

describe("case audit-history read adapter", () => {
  it("accepts a canonical Payload docs page and includes only the target case correlation group", () => {
    const value = ready(
      adaptCanonicalCaseAuditHistory(
        {
          docs: [
            auditEvent({ id: 1 }),
            auditEvent({
              id: 2,
              action: "quote.approved",
              entityType: "quote",
              entityId: "44",
            }),
            auditEvent({
              id: 3,
              action: "case.update_intake",
              entityType: "lead",
              entityId: "99",
              correlationId: "corr-case-99",
            }),
            auditEvent({
              id: 4,
              action: "quote.approved",
              entityType: "quote",
              entityId: "88",
              correlationId: "corr-case-99",
            }),
          ],
        },
        { leadId: 13 },
      ),
    );

    expect(value.order).toBe("newest_first");
    expect(value.items.map((item) => item.id)).toEqual([2, 1]);
    expect(value.items.map((item) => item.entity)).toEqual([
      { type: "quote", id: "44" },
      { type: "lead", id: "13" },
    ]);
  });

  it("recognizes the real RF case anchor and keeps UTC ordering deterministic", () => {
    const value = ready(
      adaptCanonicalCaseAuditHistory(
        {
          docs: [
            auditEvent({
              id: 8,
              action: "norge-i-bilder.captured",
              entityType: "case",
              entityId: "lead-13",
              correlationId: "corr-rf-13",
              createdAt: "2026-09-04T12:00:00+02:00",
            }),
            auditEvent({
              id: 9,
              action: "measurement.approved",
              entityType: "roof-measurement",
              entityId: "55",
              correlationId: "corr-rf-13",
              createdAt: "2026-09-04T10:00:00.000Z",
            }),
          ],
        },
        { leadId: 13 },
      ),
    );

    expect(value.items.map((item) => item.id)).toEqual([9, 8]);
    expect(value.items.map((item) => item.atUtc)).toEqual([
      "2026-09-04T10:00:00.000Z",
      "2026-09-04T10:00:00.000Z",
    ]);
  });

  it("accepts exact correlations resolved by a trusted case loader", () => {
    const value = ready(
      adaptCanonicalCaseAuditHistory(
        {
          docs: [
            auditEvent({
              id: 2,
              entityType: "work-order",
              entityId: "71",
              correlationId: "corr-work-order-71",
            }),
            auditEvent({
              id: 3,
              entityType: "work-order",
              entityId: "72",
              correlationId: "corr-work-order-72",
            }),
          ],
        },
        { leadId: 13, correlationIds: ["corr-work-order-71"] },
      ),
    );

    expect(value.items.map((item) => item.id)).toEqual([2]);
  });

  it("does not infer case membership from raw metadata or action text", () => {
    const value = ready(
      adaptCanonicalCaseAuditHistory(
        {
          docs: [
            auditEvent({
              id: 5,
              action: "case.13.approved",
              entityType: "quote",
              entityId: "91",
              correlationId: "unrelated-correlation",
              metadata: {
                leadId: 13,
                email: "private@example.invalid",
                body: "raw customer message",
              },
            }),
          ],
        },
        { leadId: 13 },
      ),
    );

    expect(value.items).toEqual([]);
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain("private@example.invalid");
    expect(serialized).not.toContain("raw customer message");
    expect(serialized).not.toContain('"metadata"');
  });

  it("fails closed when one correlation group contains a different case anchor", () => {
    const value = ready(
      adaptCanonicalCaseAuditHistory(
        {
          docs: [
            auditEvent({ id: 1 }),
            auditEvent({
              id: 2,
              entityType: "quote",
              entityId: "44",
            }),
            auditEvent({
              id: 3,
              entityType: "lead",
              entityId: "99",
            }),
          ],
        },
        { leadId: 13 },
      ),
    );

    expect(value.items).toEqual([]);
  });

  it("returns only privacy-safe projection fields without invented before/after values", () => {
    const value = ready(
      adaptCanonicalCaseAuditHistory(
        {
          docs: [
            auditEvent({
              actor: {
                id: 7,
                displayName: "Aistė Operatorė",
                email: "private@example.invalid",
              } as AuditHistorySourceEvent["actor"],
              beforeHash: "a".repeat(64),
              afterHash: "b".repeat(64),
              metadata: {
                result: "succeeded",
                source: "admin-api",
              },
            }),
          ],
        },
        { leadId: 13 },
      ),
    );

    expect(value.items[0]).toMatchObject({
      actor: { kind: "user", id: "7", display: "Aistė Operatorė" },
      result: "succeeded",
      source: "admin-api",
      integrity: {
        beforeHash: "a".repeat(64),
        afterHash: "b".repeat(64),
        hashStatus: "recorded_unverified",
        tamperStatus: "not_assessable",
      },
    });
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain("private@example.invalid");
    expect(serialized).not.toContain('"email"');
    expect(serialized).not.toContain('"body"');
    expect(serialized).not.toContain('"metadata"');
    expect(serialized).not.toContain('"before"');
    expect(serialized).not.toContain('"after"');
    expect(serialized).not.toContain('"from"');
    expect(serialized).not.toContain('"to"');
  });

  it("distinguishes an empty canonical timeline from an unavailable loader result", () => {
    expect(
      adaptCanonicalCaseAuditHistory({ docs: [] }, { leadId: 13 }),
    ).toEqual({
      status: "ready",
      source: "canonical",
      value: { order: "newest_first", items: [], rejectedCount: 0 },
    });
    expect(adaptCanonicalCaseAuditHistory(null, { leadId: 13 })).toEqual({
      status: "unavailable",
      source: "canonical",
      reason: "canonical_audit_unavailable",
    });
  });

  it.each([
    { leadId: 0 },
    { leadId: Number.NaN },
    { leadId: 13, correlationIds: ["https://other.invalid/case/13"] },
    { leadId: 13, correlationIds: ["corr valid with spaces"] },
  ])("rejects an invalid case scope before reading", async (scope) => {
    const loader = vi.fn(async () => ({ docs: [] }));
    const result = await createCaseAuditHistoryReadAdapter(loader).load(scope);

    expect(result).toEqual({
      status: "unavailable",
      source: "canonical",
      reason: "invalid_case_scope",
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("collapses loader absence and failures to unavailable without leaking errors", async () => {
    const missing = createCaseAuditHistoryReadAdapter(async () => null);
    const failed = createCaseAuditHistoryReadAdapter(async () => {
      throw new Error("database private@example.invalid failed");
    });

    const missingResult = await missing.load({ leadId: 13 });
    const failedResult = await failed.load({ leadId: 13 });
    expect(missingResult).toEqual({
      status: "unavailable",
      source: "canonical",
      reason: "canonical_audit_unavailable",
    });
    expect(failedResult).toEqual(missingResult);
    expect(JSON.stringify(failedResult)).not.toContain(
      "private@example.invalid",
    );
  });
});
