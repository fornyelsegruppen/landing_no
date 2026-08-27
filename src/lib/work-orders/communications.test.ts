import type { Payload } from "payload";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChannelUnavailableError, CommunicationCancelledError, enqueueCompletionCommunication, processWorkOrderCommunicationJob, syncWorkOrderCommunicationJobs, workOrderScheduleVersion } from "./communications";
import { dispatchCompletionCommunicationNow } from "./communications";
import { LogEmailProvider } from "@/lib/providers/safe-providers";

type Row = Record<string, unknown> & { id: number };

function fakePayload(seed: { jobs?: Row[]; messages?: Row[]; order?: Row; lead?: Row; contract?: Row; worker?: Row } = {}) {
  const rows = {
    jobs: seed.jobs || [],
    messages: seed.messages || [],
    leads: seed.lead ? [seed.lead] : [],
  };
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
    async findByID(args: { collection: string; id: number }) {
      if (args.collection === "work-orders") return seed.order;
      if (args.collection === "leads") return rows.leads[0];
      if (args.collection === "contracts") return seed.contract;
      if (args.collection === "users") return seed.worker;
      if (args.collection === "messages") {
        return rows.messages.find((message) => message.id === args.id);
      }
      throw new Error(`Unexpected ${args.collection}`);
    },
    async create(args: { collection: string; data: Record<string, unknown> }) {
      const row = { id: nextId++, ...args.data };
      if (args.collection === "operational-jobs") rows.jobs.push(row);
      if (args.collection === "messages") rows.messages.push(row);
      return row;
    },
    async update(args: { collection: string; id: number; data: Record<string, unknown> }) {
      const list = args.collection === "operational-jobs"
        ? rows.jobs
        : args.collection === "messages"
          ? rows.messages
          : rows.leads;
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
    delete process.env.VERCEL_ENV;
    delete process.env.AUTOMATION_EMERGENCY_PAUSE;
  });

  it("does not create automatic communication jobs while the Production pause is active", async () => {
    process.env.VERCEL_ENV = "production";
    const { payload, rows } = fakePayload();
    const result = await syncWorkOrderCommunicationJobs(
      payload,
      { id: 7, status: "scheduled", scheduledAt: "2026-08-27T10:00:00Z" },
      "correlation-paused",
      new Date("2026-08-23T08:00:00Z"),
    );

    expect(result).toMatchObject({ skipped: true, created: 0 });
    expect(rows.jobs).toHaveLength(0);
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

  it("delivers completion communication immediately and closes both queue jobs", async () => {
    const { payload, rows } = fakePayload({
      order: {
        id: 9,
        lead: 4,
        contract: null,
        status: "documented",
        documentationSubmittedAt: "2026-08-23T10:00:00Z",
        afterPhotos: [],
      },
      lead: {
        id: 4,
        name: "Kunde",
        email: "kunde@example.no",
        preferredChannel: "email",
        status: "converted",
      },
    });
    const provider = new LogEmailProvider();

    const result = await dispatchCompletionCommunicationNow(
      payload,
      {
        id: 9,
        status: "documented",
        documentationSubmittedAt: "2026-08-23T10:00:00Z",
      },
      "correlation-1",
      provider,
    );

    expect(result).toMatchObject({ delivered: true });
    expect(provider.deliveries).toHaveLength(1);
    expect(rows.messages[0]).toMatchObject({ status: "sent", category: "completion" });
    expect(rows.jobs).toHaveLength(2);
    expect(rows.jobs.every((job) => job.status === "completed")).toBe(true);
    expect(rows.leads[0]).toMatchObject({ status: "converted" });
  });

  it("requires attention instead of silently changing an SMS preference", async () => {
    const order = { id: 9, lead: 4, contract: 3, assignedWorker: 5, status: "scheduled", scheduledAt: "2026-08-27T10:00:00Z", arrivalWindow: "12:00–14:00", afterPhotos: [] };
    const { payload } = fakePayload({ order, lead: { id: 4, name: "Kunde", email: "kunde@example.no", preferredChannel: "sms" } });
    await expect(processWorkOrderCommunicationJob(
      payload,
      { workOrderId: 9, kind: "reminder_48h", scheduleVersion: workOrderScheduleVersion(order) },
      "correlation-1",
      new Date("2026-08-25T10:00:00Z"),
    )).rejects.toBeInstanceOf(ChannelUnavailableError);
  });

  it("includes the assigned worker, phone and selected arrival interval", async () => {
    const order = { id: 10, lead: 4, assignedWorker: 5, status: "scheduled", scheduledAt: "2026-08-27T06:00:00Z", arrivalWindow: "08:00–10:00", afterPhotos: [] };
    const { payload, rows } = fakePayload({
      order,
      lead: { id: 4, name: "Ola", email: "ola@example.no", preferredChannel: "email" },
      worker: { id: 5, displayName: "Kari Nordmann", email: "kari@example.no", phone: "+47 900 00 000" },
    });
    await processWorkOrderCommunicationJob(payload, { workOrderId: 10, kind: "schedule_confirmation", scheduleVersion: workOrderScheduleVersion(order) }, "correlation-2");
    expect(rows.messages[0]).toMatchObject({ category: "schedule_confirmation", status: "queued" });
    expect(rows.messages[0].bodyText).toContain("Kari Nordmann");
    expect(rows.messages[0].bodyText).toContain("+47 900 00 000");
    expect(rows.messages[0].bodyText).toContain("08:00–10:00");
    expect(rows.messages[0].bodyHtml).toContain("Takfornyelse");
  });

  it("never sends a same-day reminder after the visit has started", async () => {
    const order = { id: 11, lead: 4, assignedWorker: 5, status: "scheduled", scheduledAt: "2026-08-27T06:00:00Z", arrivalWindow: "08:00–10:00", afterPhotos: [] };
    const { payload, rows } = fakePayload({ order, lead: { id: 4, name: "Ola", email: "ola@example.no", preferredChannel: "email" }, worker: { id: 5, displayName: "Kari", phone: "+47 900 00 000" } });
    await expect(processWorkOrderCommunicationJob(payload, { workOrderId: 11, kind: "same_day", scheduleVersion: workOrderScheduleVersion(order) }, "correlation-late", new Date("2026-08-27T06:00:01Z"))).rejects.toBeInstanceOf(CommunicationCancelledError);
    expect(rows.messages).toHaveLength(0);
  });

  it("creates one clear rescheduling message with the old plan, new plan and reason", async () => {
    const order = { id: 12, lead: 4, assignedWorker: 5, status: "scheduled", scheduledAt: "2026-08-29T06:00:00Z", arrivalWindow: "08:00–10:00", afterPhotos: [] };
    const { payload, rows } = fakePayload({ order, lead: { id: 4, name: "Ola", email: "ola@example.no", preferredChannel: "email" }, worker: { id: 5, displayName: "Kari", phone: "+47 900 00 000" } });
    await processWorkOrderCommunicationJob(payload, {
      workOrderId: 12,
      kind: "reschedule_confirmation",
      scheduleVersion: workOrderScheduleVersion(order),
      previousScheduledAt: "2026-08-28T06:00:00Z",
      previousArrivalWindow: "10:00–12:00",
      planningReason: "Kraftig regn",
    }, "correlation-reschedule", new Date("2026-08-25T06:00:00Z"));
    expect(rows.messages).toHaveLength(1);
    expect(rows.messages[0].bodyText).toContain("Kraftig regn");
    expect(rows.messages[0].bodyText).toContain("10:00–12:00");
    expect(rows.messages[0].bodyText).toContain("08:00–10:00");
  });
});
