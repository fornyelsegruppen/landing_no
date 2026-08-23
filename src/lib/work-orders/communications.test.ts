import type { Payload } from "payload";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChannelUnavailableError, CommunicationCancelledError, enqueueCompletionCommunication, processWorkOrderCommunicationJob, syncWorkOrderCommunicationJobs } from "./communications";

type Row = Record<string, unknown> & { id: number };

function fakePayload(seed: { jobs?: Row[]; messages?: Row[]; order?: Row; lead?: Row; contract?: Row } = {}) {
  const rows = { jobs: seed.jobs || [], messages: seed.messages || [] };
  let nextId = 100;
  const payload = {
    async find(args: Record<string, unknown>) {
      const collection = args.collection;
      const where = args.where as Record<string, unknown> | undefined;
      if (collection === "operational-jobs") {
        const key = (where?.idempotencyKey as Record<string, unknown> | undefined)?.equals;
        return { docs: key ? rows.jobs.filter((job) => job.idempotencyKey === key) : rows.jobs };
      }
      if (collection === "messages") {
        const key = (where?.idempotencyKey as Record<string, unknown> | undefined)?.equals;
        return { docs: key ? rows.messages.filter((message) => message.idempotencyKey === key) : rows.messages };
      }
      return { docs: [] };
    },
    async findByID(args: { collection: string }) {
      if (args.collection === "work-orders") return seed.order;
      if (args.collection === "leads") return seed.lead;
      if (args.collection === "contracts") return seed.contract;
      throw new Error(`Unexpected ${args.collection}`);
    },
    async create(args: { collection: string; data: Record<string, unknown> }) {
      const row = { id: nextId++, ...args.data };
      if (args.collection === "operational-jobs") rows.jobs.push(row);
      if (args.collection === "messages") rows.messages.push(row);
      return row;
    },
    async update(args: { collection: string; id: number; data: Record<string, unknown> }) {
      const list = args.collection === "operational-jobs" ? rows.jobs : rows.messages;
      const row = list.find((item) => item.id === args.id);
      if (!row) throw new Error("Missing row");
      Object.assign(row, args.data); return row;
    },
  };
  return { payload: payload as unknown as Payload, rows };
}

describe("work-order communications", () => {
  beforeEach(() => {
    process.env.FEATURE_AUTOMATED_REMINDERS = "1";
    process.env.RESEND_API_KEY = "test";
    process.env.CRON_SECRET = "test";
  });
  afterEach(() => {
    delete process.env.FEATURE_AUTOMATED_REMINDERS;
    delete process.env.RESEND_API_KEY;
    delete process.env.CRON_SECRET;
  });

  it("creates each reminder once and cancels the old schedule on reschedule", async () => {
    const { payload, rows } = fakePayload(); const now = new Date("2026-08-23T08:00:00Z");
    await syncWorkOrderCommunicationJobs(payload, { id: 7, status: "scheduled", scheduledAt: "2026-08-27T10:00:00Z" }, "correlation-1", now);
    await syncWorkOrderCommunicationJobs(payload, { id: 7, status: "scheduled", scheduledAt: "2026-08-27T10:00:00Z" }, "correlation-1", now);
    expect(rows.jobs).toHaveLength(3);
    await syncWorkOrderCommunicationJobs(payload, { id: 7, status: "scheduled", scheduledAt: "2026-08-28T10:00:00Z" }, "correlation-2", now);
    expect(rows.jobs.filter((job) => job.status === "cancelled")).toHaveLength(3);
    expect(rows.jobs.filter((job) => job.status === "pending")).toHaveLength(3);
  });

  it("cancels pending reminders when the order is cancelled", async () => {
    const { payload, rows } = fakePayload(); const now = new Date("2026-08-23T08:00:00Z");
    await syncWorkOrderCommunicationJobs(payload, { id: 8, status: "scheduled", scheduledAt: "2026-08-27T10:00:00Z" }, "correlation-1", now);
    await syncWorkOrderCommunicationJobs(payload, { id: 8, status: "cancelled", scheduledAt: "2026-08-27T10:00:00Z" }, "correlation-2", now);
    expect(rows.jobs.every((job) => job.status === "cancelled")).toBe(true);
  });

  it("only creates completion communication for documented work", async () => {
    const { payload, rows } = fakePayload();
    await expect(enqueueCompletionCommunication(payload, { id: 9, status: "completed", documentationSubmittedAt: null }, "correlation-1")).rejects.toBeInstanceOf(CommunicationCancelledError);
    await enqueueCompletionCommunication(payload, { id: 9, status: "documented", documentationSubmittedAt: "2026-08-23T10:00:00Z" }, "correlation-1");
    expect(rows.jobs).toHaveLength(1);
  });

  it("requires attention instead of silently changing an SMS preference", async () => {
    const { payload } = fakePayload({ order: { id: 9, lead: 4, contract: 3, status: "scheduled", scheduledAt: "2026-08-27T10:00:00Z", afterPhotos: [] }, lead: { id: 4, name: "Kunde", email: "kunde@example.no", preferredChannel: "sms" } });
    await expect(processWorkOrderCommunicationJob(payload, { workOrderId: 9, kind: "reminder_48h", scheduleVersion: "2026-08-27T10:00:00Z" }, "correlation-1")).rejects.toBeInstanceOf(ChannelUnavailableError);
  });
});
