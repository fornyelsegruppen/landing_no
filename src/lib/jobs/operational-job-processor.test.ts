import { afterEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  automaticPreparationScope,
  processOperationalJobs,
} from "./operational-job-processor";
import { loadCustomerReplySourceBundle } from "@/lib/messages/customer-reply-sources";
import { ResendEmailProvider } from "@/lib/providers/resend-email-provider";
import { LogEmailProvider } from "@/lib/providers/safe-providers";

type Row = Record<string, unknown> & { id: number };

function repository(
  overrides: {
    lead?: Record<string, unknown>;
    message?: Record<string, unknown>;
    job?: Record<string, unknown>;
    sourceMessage?: Record<string, unknown>;
  } = {},
) {
  const lead: Row = {
    id: 1,
    email: "kunde@example.test",
    inquiryType: "takvask",
    recordState: "active",
    status: "new",
  };
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
    payload: { messageId: 2, deliveryClass: "admin_approved" },
  };
  Object.assign(lead, overrides.lead);
  Object.assign(message, overrides.message);
  Object.assign(job, overrides.job);
  const sourceMessage: Row | null = overrides.sourceMessage
    ? {
        id: 4,
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbudet",
        bodyText: "Hva gjelder?",
        status: "delivered",
        createdAt: "2026-08-24T18:00:00.000Z",
        updatedAt: "2026-08-24T18:00:00.000Z",
        ...overrides.sourceMessage,
      }
    : null;
  const collections: Record<string, Row[]> = {
    leads: [lead],
    messages: sourceMessage ? [sourceMessage, message] : [message],
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
      where,
      data,
    }: {
      collection: string;
      id?: number;
      where?: unknown;
      data: Record<string, unknown>;
    }) {
      const row = id
        ? collections[collection]?.find((item) => item.id === id)
        : collection === "operational-jobs" &&
            where &&
            ["pending", "retry"].includes(String(job.status))
          ? job
          : undefined;
      if (!row) throw new Error("not found");
      Object.assign(row, structuredClone(data));
      return id ? structuredClone(row) : { docs: [structuredClone(row)] };
    },
  } as unknown as Payload;
  return { payload, lead, message, job, sourceMessage };
}

describe("operational job processor", () => {
  const originalEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    ALLOW_PREVIEW_EMAIL_LOG: process.env.ALLOW_PREVIEW_EMAIL_LOG,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTOMATION_EMERGENCY_PAUSE: process.env.AUTOMATION_EMERGENCY_PAUSE,
    AUTOMATION_RECIPIENT_ALLOWLIST: process.env.AUTOMATION_RECIPIENT_ALLOWLIST,
  };

  it("keeps the first Production wave measurement-only until quote readiness is enabled", () => {
    expect(automaticPreparationScope(false, false)).toBe("none");
    expect(automaticPreparationScope(true, false)).toBe("measurement-only");
    expect(automaticPreparationScope(true, true)).toBe("commercial-package");
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    if (originalEnvironment.AUTOMATION_EMERGENCY_PAUSE === undefined)
      delete process.env.AUTOMATION_EMERGENCY_PAUSE;
    else
      process.env.AUTOMATION_EMERGENCY_PAUSE =
        originalEnvironment.AUTOMATION_EMERGENCY_PAUSE;
    if (originalEnvironment.AUTOMATION_RECIPIENT_ALLOWLIST === undefined)
      delete process.env.AUTOMATION_RECIPIENT_ALLOWLIST;
    else
      process.env.AUTOMATION_RECIPIENT_ALLOWLIST =
        originalEnvironment.AUTOMATION_RECIPIENT_ALLOWLIST;
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
    expect(state.job.payload).toEqual({
      messageId: 2,
      deliveryClass: "admin_approved",
    });
    expect(JSON.stringify(state.job.payload)).not.toContain(
      "kunde@example.test",
    );
  });

  it.each(["sent", "delivered"])(
    "reconciles an already %s message without invoking the provider",
    async (messageStatus) => {
      process.env.VERCEL_ENV = "production";
      delete process.env.RESEND_API_KEY;
      const providerHealth = vi.spyOn(ResendEmailProvider.prototype, "health");
      const providerSend = vi.spyOn(ResendEmailProvider.prototype, "send");
      const state = repository({
        job: { payload: { messageId: 2 } },
        message: {
          status: messageStatus,
          aiAnalysis: { workOrderId: 7, reminder: true },
        },
      });

      const result = await processOperationalJobs(state.payload, {
        jobIds: [3],
        now: new Date("2026-08-24T20:00:00.000Z"),
        rescueStale: false,
      });

      expect(result).toMatchObject({
        completed: [3],
        attention: [],
        retried: [],
        paused: [],
      });
      expect(state.job).toMatchObject({
        status: "completed",
        result: {
          processed: true,
          duplicate: true,
          noSend: true,
          reason: "message-already-terminal",
          messageId: 2,
          messageStatus,
        },
      });
      expect(state.message.status).toBe(messageStatus);
      expect(providerHealth).not.toHaveBeenCalled();
      expect(providerSend).not.toHaveBeenCalled();
    },
  );

  it("moves a nonterminal legacy delivery without a class to attention without sending", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_PREVIEW_EMAIL_LOG = "true";
    delete process.env.RESEND_API_KEY;
    const providerHealth = vi.spyOn(LogEmailProvider.prototype, "health");
    const providerSend = vi.spyOn(LogEmailProvider.prototype, "send");
    const state = repository({
      job: { payload: { messageId: 2 } },
      message: { status: "queued" },
    });

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({
      completed: [],
      attention: [3],
      retried: [],
    });
    expect(state.job).toMatchObject({
      status: "attention",
      lastErrorCode: "MessageDeliveryClassRequiredError",
    });
    expect(state.message).toMatchObject({
      status: "attention",
      failureCode: "MessageDeliveryClassRequiredError",
    });
    expect(providerHealth).not.toHaveBeenCalled();
    expect(providerSend).not.toHaveBeenCalled();
  });

  it("keeps a concurrent duplicate no-send when the message becomes sent after the job claim", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_PREVIEW_EMAIL_LOG = "true";
    delete process.env.RESEND_API_KEY;
    const providerHealth = vi.spyOn(LogEmailProvider.prototype, "health");
    const providerSend = vi.spyOn(LogEmailProvider.prototype, "send");
    const state = repository();
    const originalFindByID = (
      state.payload as unknown as {
        findByID: (args: { collection: string; id: number }) => Promise<Row>;
      }
    ).findByID.bind(state.payload);
    let messageReads = 0;
    (
      state.payload as unknown as {
        findByID: (args: { collection: string; id: number }) => Promise<Row>;
      }
    ).findByID = async (args) => {
      if (args.collection === "messages" && ++messageReads === 2)
        state.message.status = "sent";
      return originalFindByID(args);
    };

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({
      completed: [3],
      attention: [],
      retried: [],
    });
    expect(state.job).toMatchObject({
      status: "completed",
      result: {
        duplicate: true,
        noSend: true,
        reason: "message-already-terminal",
        messageStatus: "sent",
      },
    });
    expect(providerHealth).not.toHaveBeenCalled();
    expect(providerSend).not.toHaveBeenCalled();
  });

  it("rechecks a queued reply source and refuses stale delivery", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_PREVIEW_EMAIL_LOG = "true";
    delete process.env.RESEND_API_KEY;
    const state = repository({
      job: { status: "retry" },
      message: {
        aiAssisted: true,
        category: "ai_reply",
        replyToMessage: 4,
      },
      sourceMessage: {},
    });
    const bundle = await loadCustomerReplySourceBundle(state.payload, {
      leadId: 1,
      purpose: "question",
      sourceMessageId: 4,
    });
    state.message.aiAnalysis = {
      purpose: "question",
      replyFactContext: bundle.context,
      replySourceFingerprint: bundle.fingerprint,
      sourceMessageId: 4,
    };
    state.sourceMessage!.updatedAt = "2026-08-24T19:30:00.000Z";

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({ completed: [], retried: [3] });
    expect(state.job.status).toBe("retry");
    expect(state.message.status).toBe("queued");
    expect(state.lead.lastContactAt).toBeUndefined();
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

  it("quarantines prior provider acceptance for reconciliation without resending", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.RESEND_API_KEY = "configured-for-test";
    const providerHealth = vi.spyOn(ResendEmailProvider.prototype, "health");
    const providerSend = vi.spyOn(ResendEmailProvider.prototype, "send");
    const state = repository({
      message: {
        status: "queued",
        sentAt: "2026-09-05T07:31:00.000Z",
        deliveredAt: null,
        provider: "resend",
        providerMessageId: "email_tf2",
        failureCode: "Error",
        failureMessage:
          "The operation failed. Review provider and correlation logs.",
      },
    });

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-09-05T07:35:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({
      attention: [3],
      completed: [],
      retried: [],
    });
    expect(state.job).toMatchObject({
      status: "attention",
      attempts: 1,
      lastErrorCode: "MessageDeliveryReconciliationRequiredError",
    });
    expect(state.message).toMatchObject({
      status: "attention",
      sentAt: "2026-09-05T07:31:00.000Z",
      deliveredAt: null,
      provider: "resend",
      providerMessageId: "email_tf2",
      failureCode: "MessageDeliveryReconciliationRequiredError",
    });
    expect(state.lead).toMatchObject({
      nextActionBlocker: "MESSAGE_DELIVERY_RECONCILIATION_REQUIRED",
      nextAction: expect.stringContaining("Avstem leverandørloggen"),
    });
    expect(providerHealth).not.toHaveBeenCalled();
    expect(providerSend).not.toHaveBeenCalled();
  });

  it("leaves automatic operational delivery pending while the Production pause is active", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.RESEND_API_KEY = "configured-for-test";
    const state = repository({
      job: { payload: { messageId: 2, deliveryClass: "automation" } },
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

  it("quarantines prior provider acceptance even while the automation pause is active", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.RESEND_API_KEY = "configured-for-test";
    const providerSend = vi.spyOn(ResendEmailProvider.prototype, "send");
    const state = repository({
      job: { payload: { messageId: 2, deliveryClass: "automation" } },
      message: {
        category: "reminder",
        status: "queued",
        sentAt: "2026-09-05T07:31:00.000Z",
        provider: "resend",
        providerMessageId: "email_paused_ambiguity",
        aiAnalysis: { workOrderId: 7, communicationKind: "on_way" },
      },
    });

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-09-05T07:35:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({
      paused: [],
      attention: [3],
      retried: [],
    });
    expect(state.job).toMatchObject({
      status: "attention",
      lastErrorCode: "MessageDeliveryReconciliationRequiredError",
    });
    expect(state.message).toMatchObject({
      status: "attention",
      sentAt: "2026-09-05T07:31:00.000Z",
      providerMessageId: "email_paused_ambiguity",
    });
    expect(providerSend).not.toHaveBeenCalled();
  });

  it("moves a non-allowlisted automatic delivery to attention without invoking Resend", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.AUTOMATION_EMERGENCY_PAUSE = "false";
    process.env.RESEND_API_KEY = "configured-for-test";
    delete process.env.AUTOMATION_RECIPIENT_ALLOWLIST;
    const providerHealth = vi.spyOn(ResendEmailProvider.prototype, "health");
    const providerSend = vi.spyOn(ResendEmailProvider.prototype, "send");
    const state = repository({
      job: { payload: { messageId: 2, deliveryClass: "automation" } },
      message: {
        category: "reminder",
        aiAnalysis: { workOrderId: 7, communicationKind: "same_day" },
      },
    });

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({
      attention: [3],
      completed: [],
      retried: [],
    });
    expect(state.job).toMatchObject({
      status: "attention",
      lastErrorCode: "AutomaticRecipientBlockedError",
      lastErrorMessage:
        "The operation failed. Review provider and correlation logs.",
    });
    expect(state.message).toMatchObject({
      status: "attention",
      failureCode: "AutomaticRecipientBlockedError",
    });
    expect(JSON.stringify(state.job)).not.toContain("kunde@example.test");
    expect(providerHealth).not.toHaveBeenCalled();
    expect(providerSend).not.toHaveBeenCalled();
  });

  it("keeps administrator-approved operational delivery outside the pilot allowlist", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_PREVIEW_EMAIL_LOG = "true";
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTOMATION_RECIPIENT_ALLOWLIST;
    const state = repository({
      job: { payload: { messageId: 2, deliveryClass: "admin_approved" } },
      message: {
        aiAnalysis: {
          workOrderId: 7,
          communicationKind: "schedule_confirmation",
          adminApprovedTransactional: true,
        },
      },
    });

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({ completed: [3], attention: [] });
    expect(state.message.status).toBe("sent");
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

  it("skips a job when another processor wins the atomic claim", async () => {
    const state = repository();
    const originalUpdate = (
      state.payload as unknown as {
        update: (args: Record<string, unknown>) => Promise<unknown>;
      }
    ).update.bind(state.payload);
    (
      state.payload as unknown as {
        update: (args: Record<string, unknown>) => Promise<unknown>;
      }
    ).update = async (args) => {
      if (args.collection === "operational-jobs" && args.where)
        return { docs: [] };
      return originalUpdate(args);
    };

    const result = await processOperationalJobs(state.payload, {
      jobIds: [3],
      now: new Date("2026-08-24T20:00:00.000Z"),
      rescueStale: false,
    });

    expect(result).toMatchObject({ completed: [], attention: [], retried: [] });
    expect(state.job).toMatchObject({ status: "pending", attempts: 0 });
    expect(state.message).toMatchObject({ status: "queued" });
  });

  it("keeps no-send UAT markers outside the processor selection", async () => {
    const requestedWheres: unknown[] = [];
    const payload = {
      find: async ({
        collection,
        where,
      }: {
        collection: string;
        where?: unknown;
      }) => {
        expect(collection).toBe("operational-jobs");
        requestedWheres.push(where);
        return { docs: [] };
      },
      update: async () => {
        throw new Error("no job should be claimed");
      },
    } as unknown as Payload;

    const result = await processOperationalJobs(payload, {
      now: new Date("2026-08-29T20:00:00.000Z"),
      rescueStale: false,
    });
    const serializedWhere =
      requestedWheres
        .map((where) => JSON.stringify(where))
        .find((where) => where.includes("message.delivery")) || "";

    expect(serializedWhere).not.toBe("");
    expect(serializedWhere).toContain("message.delivery");
    expect(serializedWhere).toContain("work-order.communication");
    expect(serializedWhere).not.toContain("uat.no-send");
    expect(result).toMatchObject({
      completed: [],
      attention: [],
      retried: [],
      cancelled: [],
      paused: [],
    });
  });
});
