import { describe, expect, it } from "vitest";
import {
  projectAuditHistory,
  projectAuditHistoryEvent,
  type AuditHistorySourceEvent,
} from "./audit-history-projection";

function auditEvent(
  overrides: Partial<AuditHistorySourceEvent> = {},
): AuditHistorySourceEvent {
  return {
    id: 1,
    actor: 7,
    action: "quote.approved",
    entityType: "quote",
    entityId: "42",
    correlationId: "corr-12345678",
    changedFields: ["status"],
    createdAt: "2026-09-04T10:00:00.000Z",
    ...overrides,
  };
}

function projected(overrides: Partial<AuditHistorySourceEvent> = {}) {
  const result = projectAuditHistoryEvent(auditEvent(overrides));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

describe("privacy-safe audit history projection", () => {
  it("projects only allowlisted real audit fields without email or body", () => {
    const item = projected({
      actor: {
        id: 7,
        displayName: "Aistė Operatorė",
        email: "private@example.invalid",
        body: "private message",
      } as AuditHistorySourceEvent["actor"],
      changedFields: ["status", "approvedAt", "status"],
      metadata: {
        result: "succeeded",
        reason: "message_already_finished",
        version: 3,
        source: "admin-api",
      },
      beforeHash: "a".repeat(64),
      afterHash: "b".repeat(64),
    });

    expect(item).toMatchObject({
      id: 1,
      actor: { kind: "user", id: "7", display: "Aistė Operatorė" },
      action: "quote.approved",
      entity: { type: "quote", id: "42" },
      atUtc: "2026-09-04T10:00:00.000Z",
      changedFields: ["approvedAt", "status"],
      result: "succeeded",
      reason: "message_already_finished",
      version: 3,
      source: "admin-api",
      metadataStatus: "projected",
      correlationId: "corr-12345678",
      integrity: {
        hashStatus: "recorded_unverified",
        tamperStatus: "not_assessable",
      },
    });
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain("private@example.invalid");
    expect(serialized).not.toContain("private message");
    expect(serialized).not.toContain('"email"');
    expect(serialized).not.toContain('"body"');
    expect(serialized).not.toContain('"from"');
    expect(serialized).not.toContain('"to"');
    expect(serialized).not.toContain('"produced"');
  });

  it("rejects the entire metadata block on unknown or PII-bearing keys", () => {
    const item = projected({
      metadata: {
        result: "succeeded",
        customerEmail: "private@example.invalid",
      },
    });

    expect(item).toMatchObject({
      result: null,
      reason: null,
      version: null,
      source: null,
      metadataStatus: "rejected",
    });
    expect(JSON.stringify(item)).not.toContain("private@example.invalid");
    expect(JSON.stringify(item)).not.toContain("customerEmail");
  });

  it("projects only typed trace references for the two Preview case events", () => {
    const address = projected({
      action: "case.address_corrected",
      metadata: {
        caseRevision: 8,
        revision: 2,
        idempotencyDigest: "c".repeat(64),
        rfInvalidated: true,
        quoteDraftsInvalidated: 1,
        contractDraftsInvalidated: 1,
      },
    });
    const offer = projected({
      action: "roof-fusion.offer-draft-created",
      metadata: {
        caseRevision: 8,
        sourceRevision: 2,
        snapshotRevision: 4,
        measurementId: 31,
        quoteId: 41,
        contractId: 51,
        customerSideEffects: false,
      },
    });

    expect(address.trace).toEqual({
      kind: "case_address_corrected",
      caseRevision: 8,
      addressRevision: 2,
      invalidatedQuoteDrafts: 1,
      invalidatedContractDrafts: 1,
    });
    expect(offer.trace).toEqual({
      kind: "roof_fusion_offer_draft_created",
      caseRevision: 8,
      addressRevision: 2,
      snapshotRevision: 4,
      measurementId: 31,
      quoteId: 41,
      contractId: 51,
    });
    expect(JSON.stringify([address, offer])).not.toContain(
      "idempotencyDigest",
    );
  });

  it("rejects free-text reason and URL source values instead of leaking them", () => {
    const reason = projected({
      metadata: { reason: "Call Kari at private@example.invalid" },
    });
    const source = projected({
      metadata: { source: "https://provider.invalid/private-token" },
    });
    const unknownSource = projected({ metadata: { source: "Kari" } });

    expect(reason.metadataStatus).toBe("rejected");
    expect(reason.reason).toBeNull();
    expect(source.metadataStatus).toBe("rejected");
    expect(source.source).toBeNull();
    expect(unknownSource.metadataStatus).toBe("rejected");
    expect(JSON.stringify(unknownSource)).not.toContain("Kari");
  });

  it("does not fall back to actor email when display is missing or email-shaped", () => {
    expect(
      projected({
        actor: {
          id: 8,
          displayName: "worker@example.invalid",
          email: "worker@example.invalid",
        } as AuditHistorySourceEvent["actor"],
      }).actor,
    ).toEqual({ kind: "user", id: "8", display: null });
    expect(projected({ actor: 9 }).actor).toEqual({
      kind: "user",
      id: "9",
      display: null,
    });
  });

  it.each([
    [
      "missing",
      { actor: null, action: "quote.approved", entityType: "quote" },
      { kind: "unknown", id: null, display: null },
    ],
    [
      "system",
      { actor: null, action: "lead.retention_purge", entityType: "lead" },
      { kind: "system", id: null, display: null },
    ],
    [
      "job",
      {
        actor: null,
        action: "operational_job.cancel_stale_delivery",
        entityType: "operational-job",
        entityId: "job-21",
      },
      { kind: "job", id: "job-21", display: null },
    ],
    [
      "webhook",
      {
        actor: null,
        action: "webhook.delivery_received",
        entityType: "message",
      },
      { kind: "webhook", id: null, display: null },
    ],
  ])(
    "projects an explicit %s actor kind without inventing display",
    (_label, input, expected) => {
      expect(projected(input).actor).toEqual(expected);
    },
  );

  it("normalizes UTC and orders deterministically without mutating the input", () => {
    const events = [
      auditEvent({ id: 2, createdAt: "2026-09-04T12:00:00+02:00" }),
      auditEvent({ id: 1, createdAt: "2026-09-04T09:00:00.000Z" }),
      auditEvent({ id: 3, createdAt: "2026-09-04T10:00:00.000Z" }),
    ];
    const originalOrder = events.map((event) => event.id);
    const timeline = projectAuditHistory(events);

    expect(timeline.order).toBe("newest_first");
    expect(timeline.items.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(timeline.items[1].atUtc).toBe("2026-09-04T10:00:00.000Z");
    expect(events.map((event) => event.id)).toEqual(originalOrder);
  });

  it("exposes hash presence without claiming verification or reconstructing a diff", () => {
    const recorded = projected({
      beforeHash: "a".repeat(64),
      afterHash: "a".repeat(64),
    });
    const invalid = projected({
      beforeHash: "tampered",
      afterHash: "b".repeat(64),
    });
    const absent = projected();

    expect(recorded.integrity).toEqual({
      beforeHash: "a".repeat(64),
      afterHash: "a".repeat(64),
      hashStatus: "recorded_unverified",
      tamperStatus: "not_assessable",
    });
    expect(invalid.integrity).toEqual({
      beforeHash: null,
      afterHash: null,
      hashStatus: "invalid",
      tamperStatus: "not_assessable",
    });
    expect(absent.integrity.hashStatus).toBe("not_recorded");
    expect(recorded).not.toHaveProperty("from");
    expect(recorded).not.toHaveProperty("to");
  });

  it("fails closed malformed fields and rejects malformed core events", () => {
    const fields = projected({ changedFields: ["status", "private value"] });
    const invalidTime = projectAuditHistoryEvent(
      auditEvent({ id: 2, createdAt: "not-a-date" }),
    );
    const timeline = projectAuditHistory([
      auditEvent({ id: 3 }),
      auditEvent({ id: 2, createdAt: "not-a-date" }),
      auditEvent({ id: 0 }),
    ]);

    expect(fields.changedFields).toEqual([]);
    expect(fields.changedFieldsStatus).toBe("rejected");
    expect(invalidTime).toEqual({ ok: false, reason: "invalid_time" });
    expect(timeline.items.map((item) => item.id)).toEqual([3]);
    expect(timeline.rejectedCount).toBe(2);
  });
});
