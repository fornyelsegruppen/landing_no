import { afterEach, describe, expect, it } from "vitest";
import type { Payload } from "payload";
import {
  automaticPreparationScope,
  processOperationalJobs,
} from "./operational-job-processor";

type Row = Record<string, unknown> & { id: number };

function repository(
  overrides: {
    lead?: Record<string, unknown>;
    message?: Record<string, unknown>;
    job?: Record<string, unknown>;
  } = {},
) {
  const lead: Row = { id: 1, email: "kunde@example.test", status: "new" };
  const message: Row = {
    id: 2,
    lead: 1,
    direction: "outbound",
    category: "receipt",
    channel: "email",
    subject: "Takk",
    bodyText: "Vi har mottatt henvendelsen.",
    status: "queued",
    approvedAt: "2026-08-24T19:00:00.000Z",
    idempotencyKey: "lead.receipt:1",
    attachments: [],
  };
  const job: Row = {
    id: 3,
    type: "message.delivery",
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    availableAt: "2026-08-24T19:00:00.000Z",
    correlationId: "correlation-123",
    payload: { messageId: 2 },
  };
  Object.assign(lead, overrides.lead);
  Object.assign(message, overrides.message);
  Object.assign(job, overrides.job);
  const collections: Record<string, Row[]> = {
    leads: [lead],
    messages: [message],
    "operational-jobs": [job],
  };
  const payload = {
    async find({ collection, where }: { collection: string; where?: unknown }) {
      if (
        collection === "operational-jobs" &&
        JSON.stringify(where).includes('"running"')
      )
        return { docs: [] };
      return { docs: collections[collection] || [] };
    },
    async findByID({ collection, id }: { collection: string; id: number }) {
      const row = collections[collection]?.find((item) => item.id === id);
      if (!row) throw new Error("not found");
      return structuredClone(row);
    },
    async update({
      collection,
      id,
      data,
    }: {
      collection: string;
      id: number;
      data: Record<string, unknown>;
    }) {
      const row = collections[collection]?.find((item) => item.id === id);
      if (!row) throw new Error("not found");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  } as unknown as Payload;
  return { payload, lead, message, job };
}

describe("operational job processor", () => {
  const originalEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    ALLOW_PREVIEW_EMAIL_LOG: process.env.ALLOW_PREVIEW_EMAIL_LOG,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  };

  it("keeps the first Production wave measurement-only until quote readiness is enabled", () => {
    expect(automaticPreparationScope(false, false)).toBe("none");
    expect(automaticPreparationScope(true, false)).toBe("measurement-only");
    expect(automaticPreparationScope(true, true)).toBe("commercial-package");
  });

  afterEach(() => {
    if (originalEnvironment.VERCEL_ENV === undefined)
      delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalEnvironment.VERCEL_ENV;
    if (originalEnvironment.ALLOW_PREVIEW_EMAIL_LOG === undefined)
      delete process.env.ALLOW_PREVIEW_EMAIL_LOG;
    else
      process.env.ALLOW_PREVIEW_EMAIL_LOG =
        originalEnvironment.ALLOW_PREVIEW_EMAIL_LOG;
    if (originalEnvironment.RESEND_API_KEY === undefined)
      delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalEnvironment.RESEND_API_KEY;
  });

  it("delivers a referenced message immediately and completes its durable job", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_PREVIEW_EMAIL_LOG = "true";
    delete process.env.RESEND_API_KEY;
    const state = repository();

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(
      result,
      JSON.stringify({
        job: state.job,
        message: state.message,
        lead: state.lead,
      }),
    ).toMatchObject({ completed: [3], attention: [], retried: [] });
    expect(state.job.status).toBe("completed");
    expect(state.message.status).toBe("sent");
    expect(state.lead.lastContactAt).toBeTruthy();
    expect(state.job.payload).toEqual({ messageId: 2 });
    expect(JSON.stringify(state.job.payload)).not.toContain(
      "kunde@example.test",
    );
  });

  it("keeps the lead and moves an unconfigured delivery to attention", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.ALLOW_PREVIEW_EMAIL_LOG;
    delete process.env.RESEND_API_KEY;
    const state = repository();

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result.attention).toEqual([3]);
    expect(state.job).toMatchObject({
      status: "attention",
      lastErrorCode: "Error",
    });
    expect(state.message.status).toBe("attention");
    expect(JSON.stringify(state.job)).not.toContain("kunde@example.test");
  });

  it("leaves automatic operational delivery pending while the Production pause is active", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.RESEND_API_KEY = "configured-for-test";
    const state = repository({
      message: {
        category: "reminder",
        aiAnalysis: { workOrderId: 7, communicationKind: "on_way" },
      },
    });

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({ paused: [3], completed: [], attention: [] });
    expect(state.job).toMatchObject({ status: "pending", attempts: 0 });
    expect(state.message).toMatchObject({ status: "queued" });
  });

  it("cancels a stale intake AI retry after the commercial journey has started", async () => {
    const state = repository({
      lead: { status: "quoted" },
      job: {
        type: "lead.ai.draft",
        status: "retry",
        payload: { leadId: 1 },
      },
    });

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({ cancelled: [3], completed: [] });
    expect(state.job).toMatchObject({
      status: "cancelled",
      result: { processed: false, reason: "lead-intake-finished" },
    });
  });
});
