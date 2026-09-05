import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  DeterministicAiProvider,
  LogEmailProvider,
} from "@/lib/providers/safe-providers";
import {
  createCustomerReplyDraft,
  createLeadAiReply,
  createManualLeadReplyDraft,
  createManualCustomerQuestionReplyDraft,
  createReceiptMessage,
  deliverMessage,
  enqueueCustomerReplyDraft,
  enqueueMessageJob,
  manualQuestionReplyPlaceholder,
  messageDeliveryRequiresReconciliation,
  MessageDeliveryReconciliationRequiredError,
} from "./message-engine";
import { loadCustomerReplySourceBundle } from "./customer-reply-sources";
import { PaymentOperationInProgressError } from "@/lib/invoices/payment-operation-lock";
import {
  assertAutomaticMessageRecipientAllowed,
  AutomaticRecipientBlockedError,
} from "./automation-recipient-policy";

it("recovers the single durable customer-reply job when concurrent submission loses the unique insert", async () => {
  let requestedKey = "";
  const winner = {
    id: 55,
    idempotencyKey: "",
    status: "pending",
    type: "customer.reply.draft",
  };
  const find = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const key = (where.idempotencyKey as { equals?: string } | undefined)
      ?.equals;
    if (!requestedKey) {
      requestedKey = key || "";
      winner.idempotencyKey = requestedKey;
      return { docs: [] };
    }
    expect(key).toBe(requestedKey);
    return { docs: [winner] };
  });
  const create = vi.fn().mockRejectedValue(new Error("unique constraint"));
  const payload = { create, find } as unknown as Payload;

  await expect(
    enqueueCustomerReplyDraft(payload, {
      correlationId: "question-double-click",
      leadId: 1,
      purpose: "question",
      sourceMessageId: 88,
    }),
  ).resolves.toBe(winner);

  expect(create).toHaveBeenCalledTimes(1);
  expect(find).toHaveBeenCalledTimes(2);
  expect(winner.idempotencyKey).toBe(requestedKey);
  expect(requestedKey).not.toBe("");
});

it("rethrows the original insert error when no concurrent customer-reply job exists", async () => {
  const insertError = new Error("database unavailable");
  const find = vi.fn().mockResolvedValue({ docs: [] });
  const create = vi.fn().mockRejectedValue(insertError);
  const payload = { create, find } as unknown as Payload;

  await expect(
    enqueueCustomerReplyDraft(payload, {
      correlationId: "question-insert-failure",
      leadId: 1,
      purpose: "question",
      sourceMessageId: 89,
    }),
  ).rejects.toBe(insertError);

  expect(create).toHaveBeenCalledTimes(1);
  expect(find).toHaveBeenCalledTimes(2);
});

type TestDocument = Record<string, unknown> & { id: number };
type TestWhere = {
  and?: Array<Record<string, { equals?: unknown }>>;
};

function matchesWhere(document: TestDocument, where?: TestWhere) {
  return (where?.and || []).every((condition) =>
    Object.entries(condition).every(
      ([field, comparison]) => document[field] === comparison.equals,
    ),
  );
}

function repository(
  options: {
    beforeLeadUpdate?: () => void | Promise<void>;
    beforeConditionalMessageUpdate?: (
      messages: TestDocument[],
      nextTimestamp: () => string,
    ) => void | Promise<void>;
    initialCollections?: Record<string, TestDocument[]>;
  } = {},
) {
  let revision = 0;
  const nextTimestamp = () =>
    new Date(Date.UTC(2026, 7, 28, 12, 0, revision++)).toISOString();
  const leads: TestDocument[] = [
    {
      id: 1,
      name: "Testkunde",
      email: "kunde@example.test",
      postal: "1182",
      city: "Oslo",
      address: "Ikke oppgitt",
      approxSqm: null,
      inquiryType: "takvask",
      language: "no",
      message: "Hva trenger dere av bilder?",
      photoUrls: "",
      recordState: "active",
      status: "new",
    },
  ];
  const messages: TestDocument[] = [];
  const jobs: TestDocument[] = [];
  const auditEvents: TestDocument[] = [];
  const collections: Record<string, TestDocument[]> = {
    leads,
    messages,
    "operational-jobs": jobs,
    "audit-events": auditEvents,
    ...options.initialCollections,
  };
  const payload = {
    async count({ collection }: { collection: string }) {
      return { totalDocs: (collections[collection] || []).length };
    },
    async find({
      collection,
      where,
    }: {
      collection: string;
      where?: {
        and?: Array<
          Record<
            string,
            { contains?: string; equals?: unknown; not_equals?: unknown }
          >
        >;
        idempotencyKey?: { equals?: string };
      };
    }) {
      let docs = collections[collection] || [];
      const key = where?.idempotencyKey?.equals;
      if (where?.and) {
        docs = docs.filter((document) =>
          where.and?.every((condition) =>
            Object.entries(condition).every(([field, comparison]) => {
              if (comparison.contains !== undefined) {
                return String(document[field] || "").includes(
                  comparison.contains,
                );
              }
              if (comparison.not_equals !== undefined) {
                return document[field] !== comparison.not_equals;
              }
              if (comparison.equals !== undefined) {
                return document[field] === comparison.equals;
              }
              return true;
            }),
          ),
        );
      }
      return {
        docs: key ? docs.filter((item) => item.idempotencyKey === key) : docs,
        totalDocs: docs.length,
      };
    },
    async findByID({ collection, id }: { collection: string; id: number }) {
      const item = (collections[collection] || []).find(
        (entry) => entry.id === id,
      );
      if (!item) throw new Error("not found");
      return structuredClone(item);
    },
    async create({
      collection,
      data,
    }: {
      collection: string;
      data: Record<string, unknown>;
    }) {
      const target = collections[collection] || (collections[collection] = []);
      const created = {
        id: target.length + 1,
        ...structuredClone(data),
        createdAt: nextTimestamp(),
        updatedAt: nextTimestamp(),
      };
      target.push(created);
      return structuredClone(created);
    },
    async update({
      collection,
      id,
      data,
      where,
    }: {
      collection: string;
      id?: number;
      data: Record<string, unknown>;
      where?: TestWhere;
    }) {
      const target = collections[collection] || [];
      if (collection === "leads") {
        await options.beforeLeadUpdate?.();
      }
      if (where && collection === "messages") {
        await options.beforeConditionalMessageUpdate?.(messages, nextTimestamp);
      }
      const matches = id
        ? target.filter((entry) => entry.id === id)
        : target.filter((entry) => matchesWhere(entry, where));
      if (id && !matches.length) throw new Error("not found");
      for (const item of matches) {
        Object.assign(item, structuredClone(data), {
          updatedAt: nextTimestamp(),
        });
      }
      const docs = matches.map((item) => structuredClone(item));
      return id ? docs[0] : { docs };
    },
  } as unknown as Payload;
  return { payload, leads, messages, jobs, auditEvents };
}

const validAiReply = {
  summary:
    "Kunden ønsker takvask og spør hvilke bilder som trengs for videre vurdering.",
  serviceCategory: "takvask",
  missingInformation: ["Bilder av hele takflaten"],
  riskFlags: [],
  recommendedNextAction: "request_information",
  subject: "Flere opplysninger om taket",
  replyDraft:
    "Takk for henvendelsen. Send gjerne oversiktsbilder av takflatene tatt trygt fra bakken. Vi kontrollerer materialet før vi foreslår riktig neste steg.",
};

const validCustomerQuestionReply = {
  subject: "Svar på spørsmålet ditt",
  replyDraft:
    "Takk for spørsmålet. Vi kontrollerer opplysningene og svarer ut fra dokumentene som er sendt til deg.",
  summary: "Kunden ber om en avklaring før signering.",
  intent: "question" as const,
  factWarnings: [],
  recommendedAdminAction: "review_and_reply" as const,
};

describe("message engine", () => {
  it("creates an idempotent human-only lead reply draft without sending", async () => {
    const state = repository();
    state.leads[0]!.caseRevision = 4;

    const first = await createManualLeadReplyDraft(state.payload, {
      correlationId: "manual-lead-reply",
      expectedRevision: 4,
      leadId: 1,
    });
    const duplicate = await createManualLeadReplyDraft(state.payload, {
      correlationId: "manual-lead-reply-double-click",
      expectedRevision: 4,
      leadId: 1,
    });

    expect(first).toMatchObject({ duplicate: false });
    expect(duplicate).toMatchObject({
      duplicate: true,
      message: { id: first.message.id },
    });
    expect(state.messages).toHaveLength(1);
    expect(state.jobs).toHaveLength(0);
    expect(first.message).toMatchObject({
      aiAssisted: false,
      category: "follow_up",
      channel: "email",
      status: "draft",
    });
    expect(first.message.aiAnalysis).toMatchObject({
      manualLeadReply: true,
      manualReplyDraft: true,
      manualReplyRequiresEditing: true,
      sourceLeadRevision: 4,
    });
    expect(first.message.modelVersion).toBeNull();
    expect(first.message.providerMessageId).toBeNull();
    expect(first.message.queuedAt).toBeNull();
    expect(first.message.sentAt).toBeNull();
  });

  it("rejects manual reply creation for a closed or archived lead", async () => {
    const closed = repository();
    closed.leads[0]!.status = "closed";
    await expect(
      createManualLeadReplyDraft(closed.payload, {
        correlationId: "manual-lead-reply-closed",
        expectedRevision: 1,
        leadId: 1,
      }),
    ).rejects.toThrow(/closed or archived/i);
    expect(closed.messages).toHaveLength(0);

    const archived = repository();
    archived.leads[0]!.recordState = "archived";
    await expect(
      createManualLeadReplyDraft(archived.payload, {
        correlationId: "manual-lead-reply-archived",
        expectedRevision: 1,
        leadId: 1,
      }),
    ).rejects.toThrow(/closed or archived/i);
    expect(archived.messages).toHaveLength(0);
  });

  it("cancels the new manual draft when the case CAS loses a concurrent update", async () => {
    const previousFeature = process.env.FEATURE_CASE_STATE_ENGINE_V2;
    process.env.FEATURE_CASE_STATE_ENGINE_V2 = "true";
    let rejectCaseUpdate = true;
    const state = repository({
      beforeLeadUpdate: () => {
        if (rejectCaseUpdate) {
          rejectCaseUpdate = false;
          throw new Error("CASE_REVISION_CONFLICT:4:5");
        }
      },
    });
    state.leads[0]!.caseRevision = 4;

    try {
      await expect(
        createManualLeadReplyDraft(state.payload, {
          correlationId: "manual-lead-reply-cas-conflict",
          expectedRevision: 4,
          leadId: 1,
        }),
      ).rejects.toThrow("Case revision conflict: expected 4, actual 5");
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toMatchObject({ status: "cancelled" });
      expect(state.jobs).toHaveLength(0);
    } finally {
      if (previousFeature === undefined) {
        delete process.env.FEATURE_CASE_STATE_ENGINE_V2;
      } else {
        process.env.FEATURE_CASE_STATE_ENGINE_V2 = previousFeature;
      }
    }
  });

  it("uses the canonical communication email when the original email is empty", async () => {
    const state = repository();
    state.leads[0]!.email = null;
    state.leads[0]!.communicationEmail = "confirmed@example.no";

    const result = await createManualLeadReplyDraft(state.payload, {
      correlationId: "manual-lead-reply-confirmed-recipient",
      expectedRevision: 1,
      leadId: 1,
    });

    expect(result.message).toMatchObject({ channel: "email" });
    expect(result.message).toMatchObject({
      approvedAt: null,
      queuedAt: null,
      sentAt: null,
      providerMessageId: null,
      status: "draft",
    });
  });

  it.each([
    ["provider message id", { status: "queued", providerMessageId: "email_1" }],
    [
      "acceptance timestamp",
      { status: "attention", sentAt: "2026-09-05T07:31:00.000Z" },
    ],
  ])(
    "requires reconciliation for nonterminal %s evidence",
    (_label, message) => {
      expect(messageDeliveryRequiresReconciliation(message)).toBe(true);
    },
  );

  it("rechecks unpaid status under the invoice lock immediately before sending", async () => {
    const state = repository({
      initialCollections: {
        "official-invoices": [
          {
            id: 4,
            lead: 1,
            status: "paid",
            dueAt: "2026-01-01T12:00:00.000Z",
            bankCheckedAt: new Date().toISOString(),
          },
        ],
      },
    });
    state.messages.push({
      id: 1,
      lead: 1,
      direction: "outbound",
      category: "reminder",
      channel: "email",
      subject: "Påminnelse",
      bodyText: "Kontrollert betalingspåminnelse.",
      status: "queued",
      idempotencyKey: "official-invoice-reminder:4:2026-08-20",
      approvedAt: new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString(),
      attachments: [],
      aiAnalysis: {
        financeAction: "payment_reminder",
        officialInvoiceId: 4,
      },
    });
    const provider = new LogEmailProvider();

    await expect(
      deliverMessage(
        state.payload,
        provider,
        1,
        "payment-paid",
        "admin_approved",
      ),
    ).rejects.toThrow(/unpaid/i);

    expect(provider.deliveries).toHaveLength(0);
    expect(state.messages[0]?.aiAnalysis).not.toMatchObject({
      paymentReminderSendClaimedAt: expect.any(String),
    });
  });

  it("allows only one of two old payment-reminder drafts to send", async () => {
    const invoice = {
      id: 4,
      lead: 1,
      status: "overdue",
      dueAt: "2026-01-01T12:00:00.000Z",
      bankCheckedAt: new Date().toISOString(),
    };
    const state = repository({
      initialCollections: { "official-invoices": [invoice] },
    });
    const oldTimestamp = new Date(
      Date.now() - 10 * 24 * 60 * 60_000,
    ).toISOString();
    for (const id of [1, 2]) {
      state.messages.push({
        id,
        lead: 1,
        direction: "outbound",
        category: "reminder",
        channel: "email",
        subject: `Påminnelse ${id}`,
        bodyText: "Kontrollert betalingspåminnelse.",
        status: "queued",
        idempotencyKey: `official-invoice-reminder:4:2026-08-${10 + id}`,
        approvedAt: oldTimestamp,
        createdAt: oldTimestamp,
        attachments: [],
        aiAnalysis: {
          financeAction: "payment_reminder",
          officialInvoiceId: 4,
        },
      });
    }
    const provider = new LogEmailProvider();

    const results = await Promise.allSettled([
      deliverMessage(
        state.payload,
        provider,
        1,
        "payment-race-1",
        "admin_approved",
      ),
      deliverMessage(
        state.payload,
        provider,
        2,
        "payment-race-2",
        "admin_approved",
      ),
    ]);

    expect(provider.deliveries).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.any(PaymentOperationInProgressError),
    });
    const sent = state.messages.filter((message) => message.status === "sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.aiAnalysis).toMatchObject({
      paymentReminderSendClaimedAt: expect.any(String),
    });
  });

  it("uses the durable invoice claim to block a second old reminder", async () => {
    const state = repository({
      initialCollections: {
        "official-invoices": [
          {
            id: 4,
            lead: 1,
            status: "overdue",
            dueAt: "2026-01-01T12:00:00.000Z",
            bankCheckedAt: new Date().toISOString(),
          },
        ],
      },
    });
    const oldTimestamp = new Date(
      Date.now() - 10 * 24 * 60 * 60_000,
    ).toISOString();
    state.messages.push(
      ...[1, 2].map((id) => ({
        id,
        lead: 1,
        direction: "outbound",
        category: "reminder",
        channel: "email",
        subject: `Påminnelse ${id}`,
        bodyText: "Kontrollert betalingspåminnelse.",
        status: "queued",
        idempotencyKey: `official-invoice-reminder:4:2026-08-${10 + id}`,
        approvedAt: oldTimestamp,
        createdAt: oldTimestamp,
        attachments: [],
        aiAnalysis: {
          financeAction: "payment_reminder",
          officialInvoiceId: 4,
        },
      })),
    );
    const provider = new LogEmailProvider();

    await deliverMessage(
      state.payload,
      provider,
      1,
      "payment-first",
      "admin_approved",
    );
    await expect(
      deliverMessage(
        state.payload,
        provider,
        2,
        "payment-second",
        "admin_approved",
      ),
    ).rejects.toThrow(/7 days/i);

    expect(provider.deliveries).toHaveLength(1);
  });

  it("creates and delivers the receipt exactly once", async () => {
    const state = repository();
    const first = await createReceiptMessage(state.payload, 1, "receipt-test");
    const second = await createReceiptMessage(
      state.payload,
      1,
      "receipt-test-repeat",
    );
    expect(first).toMatchObject({ skipped: false, duplicate: false });
    expect(second).toMatchObject({ skipped: false, duplicate: true });
    expect(state.messages).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
    expect(state.messages[0]?.bodyHtml).toContain(
      'src="https://www.takfornyelse.as/brand/logo.png"',
    );

    const provider = new LogEmailProvider();
    await deliverMessage(
      state.payload,
      provider,
      1,
      "receipt-test",
      "customer_initiated",
    );
    await deliverMessage(
      state.payload,
      provider,
      1,
      "receipt-test-repeat",
      "customer_initiated",
    );
    expect(provider.deliveries).toHaveLength(1);
    expect(state.messages[0]?.status).toBe("sent");
  });

  it("prefers the customer-confirmed communication email for future delivery", async () => {
    const state = repository();
    state.leads[0]!.communicationEmail = "confirmed@example.no";
    await createReceiptMessage(state.payload, 1, "communication-email");
    const recipients: string[] = [];
    await deliverMessage(
      state.payload,
      {
        health: () => ({ status: "ready", provider: "test" }),
        send: async (message) => {
          recipients.push(message.to);
          return {
            acceptedAt: new Date().toISOString(),
            provider: "test",
            providerMessageId: "delivery-1",
          };
        },
      },
      1,
      "communication-email",
      "customer_initiated",
    );
    expect(recipients).toEqual(["confirmed@example.no"]);
    expect(state.messages[0]).toMatchObject({
      aiAnalysis: { deliveryRecipient: "confirmed@example.no" },
    });
  });

  it("persists the exact Preview subject that the provider receives", async () => {
    const previousVercelEnvironment = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    try {
      const state = repository();
      await createReceiptMessage(state.payload, 1, "preview-subject");
      const subjects: string[] = [];
      await deliverMessage(
        state.payload,
        {
          health: () => ({ status: "ready", provider: "test" }),
          send: async (message) => {
            subjects.push(message.subject);
            return {
              acceptedAt: new Date().toISOString(),
              provider: "test",
              providerMessageId: "delivery-preview",
            };
          },
        },
        1,
        "preview-subject",
        "customer_initiated",
      );
      expect(subjects[0]).toMatch(/^\[PREVIEW TEST\] /u);
      expect(state.messages[0]?.subject).toBe(subjects[0]);
    } finally {
      if (previousVercelEnvironment === undefined)
        delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousVercelEnvironment;
    }
  });

  it("rechecks the current automation recipient immediately before provider send", async () => {
    const state = repository();
    state.leads[0]!.communicationEmail = "pilot@example.no";
    await createReceiptMessage(state.payload, 1, "recipient-toctou");
    await expect(
      assertAutomaticMessageRecipientAllowed(
        state.payload,
        { lead: state.messages[0]!.lead },
        "automation",
        { AUTOMATION_RECIPIENT_ALLOWLIST: "pilot@example.no" },
      ),
    ).resolves.toBeUndefined();

    state.leads[0]!.communicationEmail = "changed@example.no";
    const send = vi.fn();
    const previous = {
      mode: process.env.PLATFORM_OPERATING_MODE,
      leadReference: process.env.LEAD_INBOX_PILOT_REFERENCE,
      roofReference: process.env.ROOF_VALIDATION_REFERENCE,
      allowlist: process.env.AUTOMATION_RECIPIENT_ALLOWLIST,
    };
    process.env.PLATFORM_OPERATING_MODE = "controlled_pilot";
    delete process.env.LEAD_INBOX_PILOT_REFERENCE;
    delete process.env.ROOF_VALIDATION_REFERENCE;
    process.env.AUTOMATION_RECIPIENT_ALLOWLIST = "pilot@example.no";
    try {
      await expect(
        deliverMessage(
          state.payload,
          {
            health: () => ({ status: "ready", provider: "test" }),
            send,
          },
          1,
          "recipient-toctou-delivery",
          "automation",
        ),
      ).rejects.toBeInstanceOf(AutomaticRecipientBlockedError);
      expect(send).not.toHaveBeenCalled();
      expect(state.messages[0]?.status).toBe("queued");
    } finally {
      if (previous.mode === undefined)
        delete process.env.PLATFORM_OPERATING_MODE;
      else process.env.PLATFORM_OPERATING_MODE = previous.mode;
      if (previous.leadReference === undefined)
        delete process.env.LEAD_INBOX_PILOT_REFERENCE;
      else process.env.LEAD_INBOX_PILOT_REFERENCE = previous.leadReference;
      if (previous.roofReference === undefined)
        delete process.env.ROOF_VALIDATION_REFERENCE;
      else process.env.ROOF_VALIDATION_REFERENCE = previous.roofReference;
      if (previous.allowlist === undefined)
        delete process.env.AUTOMATION_RECIPIENT_ALLOWLIST;
      else process.env.AUTOMATION_RECIPIENT_ALLOWLIST = previous.allowlist;
    }
  });

  it("stores a validated AI reply as a draft and never sends it", async () => {
    const state = repository();
    const result = await createLeadAiReply(
      state.payload,
      new DeterministicAiProvider(validAiReply),
      1,
      "ai-test",
    );
    expect(result.message).toMatchObject({ status: "draft", aiAssisted: true });
    expect(state.leads[0]?.status).toBe("draft_ready");
    expect(state.jobs).toHaveLength(0);
  });

  it("reopens an exhausted delivery job without creating a duplicate", async () => {
    const state = repository();
    await createReceiptMessage(state.payload, 1, "receipt-retry");
    Object.assign(state.jobs[0]!, { status: "attention", attempts: 3 });
    await enqueueMessageJob(
      state.payload,
      1,
      "receipt-retry-again",
      "customer_initiated",
    );
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("refuses to silently upgrade a pending legacy job without a delivery class", async () => {
    const state = repository();
    await createReceiptMessage(state.payload, 1, "receipt-legacy-pending");
    state.jobs[0]!.payload = { messageId: 1 };

    await expect(
      enqueueMessageJob(
        state.payload,
        1,
        "receipt-legacy-pending-retry",
        "customer_initiated",
      ),
    ).rejects.toMatchObject({
      name: "MessageDeliveryClassRequiredError",
    });

    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.status).toBe("pending");
    expect(state.jobs[0]?.payload).toEqual({ messageId: 1 });
  });

  it("refuses to reclassify an existing nonterminal delivery job", async () => {
    const state = repository();
    await createReceiptMessage(state.payload, 1, "receipt-class-conflict");

    await expect(
      enqueueMessageJob(
        state.payload,
        1,
        "receipt-class-conflict-retry",
        "admin_approved",
      ),
    ).rejects.toMatchObject({ name: "MessageDeliveryClassConflictError" });
    expect(state.jobs[0]?.payload).toEqual({
      messageId: 1,
      deliveryClass: "customer_initiated",
    });
  });

  it("reopens a completed delivery job for an explicit retry", async () => {
    const state = repository();
    await createReceiptMessage(state.payload, 1, "receipt-completed-retry");
    Object.assign(state.jobs[0]!, {
      status: "completed",
      attempts: 1,
      startedAt: "2026-08-28T12:01:00.000Z",
      completedAt: "2026-08-28T12:02:00.000Z",
      result: { processed: true },
    });

    await enqueueMessageJob(
      state.payload,
      1,
      "receipt-completed-retry-again",
      "customer_initiated",
    );

    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({
      status: "pending",
      attempts: 0,
      startedAt: null,
      completedAt: null,
      result: null,
    });
  });

  it("blocks transport when a queued message retains prior provider acceptance", async () => {
    const state = repository();
    await createReceiptMessage(state.payload, 1, "receipt-reconciliation");
    const message = state.messages[0]!;
    Object.assign(message, {
      status: "queued",
      sentAt: "2026-08-28T12:15:00.000Z",
      deliveredAt: null,
      provider: "resend",
      providerMessageId: "email_tf2",
      failureCode: "Error",
      failureMessage:
        "The operation failed. Review provider and correlation logs.",
    });
    const send = vi.fn();

    await expect(
      deliverMessage(
        state.payload,
        {
          health: () => ({ status: "ready", provider: "resend" }),
          send,
        },
        message.id,
        "receipt-reconciliation-attempt",
        "customer_initiated",
      ),
    ).rejects.toBeInstanceOf(MessageDeliveryReconciliationRequiredError);

    expect(send).not.toHaveBeenCalled();
    expect(message).toMatchObject({
      status: "queued",
      sentAt: "2026-08-28T12:15:00.000Z",
      deliveredAt: null,
      provider: "resend",
      providerMessageId: "email_tf2",
      failureCode: "Error",
    });
  });

  it("uses a new provider idempotency key for each explicit delivery attempt", async () => {
    const state = repository();
    await createReceiptMessage(state.payload, 1, "receipt-attempt-key");
    const message = state.messages[0]!;
    const providerKeys: string[] = [];
    const provider = {
      health: () => ({ status: "ready" as const, provider: "test" }),
      send: async (delivery: { idempotencyKey: string }) => {
        providerKeys.push(delivery.idempotencyKey);
        return {
          acceptedAt: new Date().toISOString(),
          provider: "test",
          providerMessageId: `delivery-${providerKeys.length}`,
        };
      },
    };

    const originalMessageKey = String(message.idempotencyKey);
    await deliverMessage(
      state.payload,
      provider,
      1,
      "attempt-one",
      "admin_approved",
    );
    Object.assign(message, {
      aiAnalysis: { deliveryAttempt: 1 },
      status: "queued",
      queuedAt: "2026-08-28T12:20:00.000Z",
      sentAt: null,
      provider: null,
      providerMessageId: null,
    });
    await deliverMessage(
      state.payload,
      provider,
      1,
      "attempt-two",
      "admin_approved",
    );

    expect(providerKeys).toHaveLength(2);
    expect(providerKeys[0]).toBe(originalMessageKey);
    expect(providerKeys[1]).not.toBe(providerKeys[0]);
  });

  it("does not regress a converted lead when sending a signed contract copy", async () => {
    const state = repository();
    state.leads[0]!.status = "converted";
    await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "outbound",
        category: "contract",
        channel: "email",
        subject: "Signert kontrakt K-1-V1",
        bodyText: "Kontrakten er signert.",
        status: "queued",
        idempotencyKey: "contract-signed:1",
        aiAssisted: false,
        approvedAt: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
      },
    });

    await deliverMessage(
      state.payload,
      new LogEmailProvider(),
      1,
      "contract-confirmation",
      "admin_approved",
    );

    expect(state.messages[0]?.status).toBe("sent");
    expect(state.leads[0]?.status).toBe("converted");
  });

  it("keeps a completion message in the converted pipeline state", async () => {
    const state = repository();
    state.leads[0]!.status = "measuring";
    await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "outbound",
        category: "completion",
        channel: "email",
        subject: "Takarbeidet er dokumentert",
        bodyText: "Arbeidet er fullført og dokumentert.",
        status: "queued",
        idempotencyKey: "work-order-completion:1",
        aiAssisted: false,
        approvedAt: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
      },
    });

    await deliverMessage(
      state.payload,
      new LogEmailProvider(),
      1,
      "completion-message",
      "admin_approved",
    );

    expect(state.messages[0]?.status).toBe("sent");
    expect(state.leads[0]).toMatchObject({
      status: "converted",
      nextAction: "Oppdrag fullført og dokumentert.",
      nextActionAt: null,
    });
  });

  it("keeps an accepted customer-question reply blocked until provider delivery is confirmed", async () => {
    const state = repository();
    state.leads[0]!.status = "customer_waiting";
    await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "outbound",
        category: "ai_reply",
        channel: "email",
        subject: "Svar på spørsmålet ditt",
        bodyText:
          "Takk for spørsmålet. Vi har kontrollert opplysningene og venter gjerne på svaret ditt.",
        status: "queued",
        idempotencyKey: "customer-reply:1",
        aiAssisted: true,
        aiAnalysis: {
          replyFactContext: {
            purpose: "question",
            customerMessage: "Hva skjer videre?",
            service: "takvask",
          },
        },
        approvedAt: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
      },
    });
    await deliverMessage(
      state.payload,
      new LogEmailProvider(),
      1,
      "customer-reply",
      "admin_approved",
    );
    expect(state.leads[0]).toMatchObject({ status: "customer_waiting" });
  });

  it("refuses a Resend question reply when confirmed-delivery tracking is not configured", async () => {
    const state = repository();
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbud T-1-V1",
        bodyText: "Hva er inkludert i maksimalprisen?",
        status: "delivered",
        idempotencyKey: "question-source-webhook",
        aiAssisted: false,
      },
    });
    const sourceBundle = await loadCustomerReplySourceBundle(state.payload, {
      leadId: 1,
      purpose: "question",
      sourceMessageId: source.id,
    });
    const reply = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        replyToMessage: source.id,
        direction: "outbound",
        category: "ai_reply",
        channel: "email",
        subject: "Svar på spørsmålet ditt",
        bodyText:
          "Takk for spørsmålet. Vi har kontrollert hva maksimalprisen omfatter.",
        status: "queued",
        idempotencyKey: "customer-reply-webhook",
        aiAssisted: true,
        aiAnalysis: {
          purpose: "question",
          replySourceFingerprint: sourceBundle.fingerprint,
        },
        approvedAt: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
      },
    });
    const send = vi.fn();
    const previousSecret = process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      await expect(
        deliverMessage(
          state.payload,
          {
            health: () => ({ status: "ready", provider: "resend" }),
            send,
          },
          reply.id,
          "customer-reply-without-webhook",
          "admin_approved",
        ),
      ).rejects.toThrow(/delivery webhook/i);
    } finally {
      if (previousSecret === undefined)
        delete process.env.RESEND_WEBHOOK_SECRET;
      else process.env.RESEND_WEBHOOK_SECRET = previousSecret;
    }
    expect(send).not.toHaveBeenCalled();
    expect(state.messages[1]?.status).toBe("queued");
  });

  it("creates a human-only draft bound to the exact customer question", async () => {
    const state = repository();
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbud T-1-V1",
        bodyText: "Hva er inkludert i maksimalprisen?",
        status: "delivered",
        idempotencyKey: "question-source-1",
        aiAssisted: false,
      },
    });

    const result = await createManualCustomerQuestionReplyDraft(state.payload, {
      correlationId: "manual-question",
      expectedRevision: 1,
      leadId: 1,
      sourceMessageId: source.id,
    });

    expect(result).toMatchObject({ duplicate: false });
    expect(result.message).toMatchObject({
      aiAssisted: false,
      bodyText: manualQuestionReplyPlaceholder,
      category: "follow_up",
      replyToMessage: source.id,
      status: "draft",
    });
    expect(result.message.aiAnalysis).toMatchObject({
      manualQuestionReply: true,
      manualReplyRequiresEditing: true,
      purpose: "question",
      sourceMessageId: source.id,
    });
  });

  it("records the exact recipient used for a delivered customer-question reply", async () => {
    const state = repository();
    state.leads[0]!.communicationEmail = "confirmed@example.no";
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbud T-1-V1",
        bodyText: "Hvilken adresse sendes svaret til?",
        status: "delivered",
        idempotencyKey: "question-source-recipient",
        aiAssisted: false,
      },
    });
    const draft = await createManualCustomerQuestionReplyDraft(state.payload, {
      correlationId: "manual-question-recipient",
      expectedRevision: 1,
      leadId: 1,
      sourceMessageId: source.id,
    });
    await state.payload.update({
      collection: "messages",
      id: draft.message.id,
      overrideAccess: true,
      data: {
        approvedAt: "2026-08-29T13:20:00.000Z",
        bodyText: "Svaret sendes til den bekreftede kommunikasjonsadressen.",
        status: "queued",
      },
    });

    await deliverMessage(
      state.payload,
      new LogEmailProvider(),
      draft.message.id,
      "manual-question-recipient-delivery",
      "admin_approved",
    );

    expect(state.messages[1]?.aiAnalysis).toMatchObject({
      deliveryRecipient: "confirmed@example.no",
      manualQuestionReply: true,
      purpose: "question",
    });
  });

  it("reactivates a cancelled AI reply with freshly generated content", async () => {
    const state = repository();
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbud T-1-V1",
        bodyText: "Hva er inkludert før jeg signerer?",
        status: "delivered",
        idempotencyKey: "question-source-ai-reprepare",
        aiAssisted: false,
      },
    });
    const input = {
      correlationId: "ai-question-initial",
      generationKey: `admin-fallback-${source.id}`,
      leadId: 1,
      purpose: "question" as const,
      sourceMessageId: source.id,
    };
    const initialProvider = new DeterministicAiProvider(
      validCustomerQuestionReply,
    );
    const initialGenerate = vi.spyOn(initialProvider, "generate");
    const initial = await createCustomerReplyDraft(
      state.payload,
      initialProvider,
      input,
    );
    await state.payload.update({
      collection: "messages",
      id: initial.message.id,
      overrideAccess: true,
      data: {
        status: "cancelled",
        bodyHtml: "<p>Gammelt svar</p>",
        approvedBy: 9,
        approvedAt: "2026-08-28T12:10:00.000Z",
        queuedAt: "2026-08-28T12:11:00.000Z",
        sentAt: "2026-08-28T12:12:00.000Z",
        deliveredAt: "2026-08-28T12:13:00.000Z",
        provider: "old-provider",
        providerMessageId: "old-provider-message",
        failureCode: "OLD_FAILURE",
        failureMessage: "Gammel leveringsfeil",
      },
    });

    const freshBody =
      "Takk for spørsmålet. Dette er et nytt kontrollert svar basert på dokumentene som er sendt til deg.";
    const recreatedProvider = new DeterministicAiProvider({
      ...validCustomerQuestionReply,
      replyDraft: freshBody,
    });
    const recreatedGenerate = vi.spyOn(recreatedProvider, "generate");
    const recreated = await createCustomerReplyDraft(
      state.payload,
      recreatedProvider,
      { ...input, correlationId: "ai-question-after-cancel" },
    );
    const retryProvider = new DeterministicAiProvider({ invalid: true });
    const retryGenerate = vi.spyOn(retryProvider, "generate");
    const transportRetry = await createCustomerReplyDraft(
      state.payload,
      retryProvider,
      { ...input, correlationId: "ai-question-transport-retry" },
    );

    expect(recreated).toMatchObject({ duplicate: false });
    expect(recreated.message).toMatchObject({
      id: initial.message.id,
      bodyText: freshBody,
      status: "draft",
      bodyHtml: null,
      approvedBy: null,
      approvedAt: null,
      queuedAt: null,
      sentAt: null,
      deliveredAt: null,
      provider: null,
      providerMessageId: null,
      failureCode: null,
      failureMessage: null,
    });
    expect(transportRetry).toMatchObject({
      duplicate: true,
      message: { id: initial.message.id, bodyText: freshBody, status: "draft" },
    });
    expect(initialGenerate).toHaveBeenCalledTimes(1);
    expect(recreatedGenerate).toHaveBeenCalledTimes(1);
    expect(retryGenerate).not.toHaveBeenCalled();
    expect(state.auditEvents).toHaveLength(2);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]).toMatchObject({
      bodyText: freshBody,
      status: "draft",
    });

    await state.payload.update({
      collection: "messages",
      id: initial.message.id,
      overrideAccess: true,
      data: { status: "cancelled" },
    });
    const secondCycleBody =
      "Takk for spørsmålet. Dette er et nytt svar etter andre forkasting.";
    const secondCycleProvider = new DeterministicAiProvider({
      ...validCustomerQuestionReply,
      replyDraft: secondCycleBody,
    });
    const secondCycleGenerate = vi.spyOn(secondCycleProvider, "generate");
    const secondCycle = await createCustomerReplyDraft(
      state.payload,
      secondCycleProvider,
      { ...input, correlationId: "ai-question-second-cancel-cycle" },
    );

    expect(secondCycle).toMatchObject({
      duplicate: false,
      message: {
        id: initial.message.id,
        bodyText: secondCycleBody,
        status: "draft",
      },
    });
    expect(secondCycleGenerate).toHaveBeenCalledTimes(1);
    expect(state.auditEvents).toHaveLength(3);
  });

  it("leaves a cancelled AI reply untouched when fresh generation fails", async () => {
    const state = repository();
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbud T-1-V1",
        bodyText: "Hva er inkludert før jeg signerer?",
        status: "delivered",
        idempotencyKey: "question-source-ai-failure",
        aiAssisted: false,
      },
    });
    const input = {
      correlationId: "ai-question-before-failure",
      generationKey: `admin-fallback-${source.id}`,
      leadId: 1,
      purpose: "question" as const,
      sourceMessageId: source.id,
    };
    const initial = await createCustomerReplyDraft(
      state.payload,
      new DeterministicAiProvider(validCustomerQuestionReply),
      input,
    );
    await state.payload.update({
      collection: "messages",
      id: initial.message.id,
      overrideAccess: true,
      data: { status: "cancelled" },
    });
    const cancelled = structuredClone(state.messages[1]);
    const failedGenerate = vi.fn().mockRejectedValue(new Error("AI offline"));

    await expect(
      createCustomerReplyDraft(
        state.payload,
        {
          health: () => ({ provider: "failing-ai", status: "ready" }),
          generate: failedGenerate,
        },
        { ...input, correlationId: "ai-question-failed-recreation" },
      ),
    ).rejects.toThrow("AI offline");

    expect(failedGenerate).toHaveBeenCalledTimes(1);
    expect(state.auditEvents).toHaveLength(2);
    expect(state.messages[1]).toEqual(cancelled);
  });

  it.each(["draft", "queued", "sent"] as const)(
    "returns the active %s reply without regenerating or overwriting it",
    async (status) => {
      const state = repository();
      const source = await state.payload.create({
        collection: "messages",
        overrideAccess: true,
        data: {
          lead: 1,
          direction: "inbound",
          category: "customer_question",
          channel: "email",
          subject: "Spørsmål om tilbud T-1-V1",
          bodyText: "Hva er inkludert før jeg signerer?",
          status: "delivered",
          idempotencyKey: `question-source-active-${status}`,
          aiAssisted: false,
        },
      });
      const input = {
        correlationId: `ai-question-active-${status}`,
        generationKey: `admin-fallback-${source.id}`,
        leadId: 1,
        purpose: "question" as const,
        sourceMessageId: source.id,
      };
      const initial = await createCustomerReplyDraft(
        state.payload,
        new DeterministicAiProvider(validCustomerQuestionReply),
        input,
      );
      const administratorText = `Kontrollert administratorinnhold ${status}`;
      await state.payload.update({
        collection: "messages",
        id: initial.message.id,
        overrideAccess: true,
        data: { bodyText: administratorText, status },
      });
      const provider = new DeterministicAiProvider({ invalid: true });
      const generate = vi.spyOn(provider, "generate");

      const duplicate = await createCustomerReplyDraft(
        state.payload,
        provider,
        { ...input, correlationId: `${input.correlationId}-retry` },
      );

      expect(duplicate).toMatchObject({
        duplicate: true,
        message: {
          id: initial.message.id,
          bodyText: administratorText,
          status,
        },
      });
      expect(generate).not.toHaveBeenCalled();
      expect(state.auditEvents).toHaveLength(1);
      expect(state.messages[1]).toMatchObject({
        bodyText: administratorText,
        status,
      });
    },
  );

  it("returns the canonical active question draft across different generation keys", async () => {
    const state = repository();
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbud T-1-V1",
        bodyText: "Hva er inkludert før jeg signerer?",
        status: "delivered",
        idempotencyKey: "question-source-cross-generation",
        aiAssisted: false,
      },
    });
    const initial = await createManualCustomerQuestionReplyDraft(
      state.payload,
      {
        correlationId: "manual-question-cross-generation",
        expectedRevision: 1,
        generationKey: "manual-first",
        leadId: 1,
        sourceMessageId: source.id,
      },
    );
    const provider = new DeterministicAiProvider(validCustomerQuestionReply);
    const generate = vi.spyOn(provider, "generate");

    const aiDuplicate = await createCustomerReplyDraft(
      state.payload,
      provider,
      {
        correlationId: "ai-question-cross-generation",
        generationKey: "ai-second",
        leadId: 1,
        purpose: "question",
        sourceMessageId: source.id,
      },
    );
    const manualDuplicate = await createManualCustomerQuestionReplyDraft(
      state.payload,
      {
        correlationId: "manual-question-cross-generation-retry",
        expectedRevision: 999,
        generationKey: "manual-third",
        leadId: 1,
        sourceMessageId: source.id,
      },
    );

    expect(initial).toMatchObject({ duplicate: false });
    expect(aiDuplicate).toMatchObject({
      duplicate: true,
      message: { id: initial.message.id },
    });
    expect(manualDuplicate).toMatchObject({
      duplicate: true,
      message: { id: initial.message.id },
    });
    expect(generate).not.toHaveBeenCalled();
    expect(
      state.messages.filter((message) => message.status === "draft"),
    ).toHaveLength(1);
  });

  it.each(["draft", "queued", "sent"] as const)(
    "returns the active %s concurrency winner when cancelled reactivation loses CAS",
    async (winnerStatus) => {
      let raceArmed = false;
      const winnerBody =
        "Dette utkastet ble aktivert av en annen samtidig administratorhandling.";
      const state = repository({
        beforeConditionalMessageUpdate(messages, nextTimestamp) {
          if (!raceArmed) return;
          const reply = messages.find(
            (message) => message.status === "cancelled",
          );
          if (!reply) throw new Error("Expected a cancelled reply race target");
          Object.assign(reply, {
            bodyText: winnerBody,
            status: winnerStatus,
            updatedAt: nextTimestamp(),
          });
          raceArmed = false;
        },
      });
      const source = await state.payload.create({
        collection: "messages",
        overrideAccess: true,
        data: {
          lead: 1,
          direction: "inbound",
          category: "customer_question",
          channel: "email",
          subject: "Spørsmål om tilbud T-1-V1",
          bodyText: "Hva er inkludert før jeg signerer?",
          status: "delivered",
          idempotencyKey: `question-source-ai-race-${winnerStatus}`,
          aiAssisted: false,
        },
      });
      const input = {
        correlationId: `ai-question-race-initial-${winnerStatus}`,
        generationKey: `admin-fallback-${source.id}`,
        leadId: 1,
        purpose: "question" as const,
        sourceMessageId: source.id,
      };
      const initial = await createCustomerReplyDraft(
        state.payload,
        new DeterministicAiProvider(validCustomerQuestionReply),
        input,
      );
      await state.payload.update({
        collection: "messages",
        id: initial.message.id,
        overrideAccess: true,
        data: { status: "cancelled" },
      });
      const losingProvider = new DeterministicAiProvider({
        ...validCustomerQuestionReply,
        replyDraft:
          "Dette genererte utkastet taper CAS og skal aldri overskrive vinneren.",
      });
      const losingGenerate = vi.spyOn(losingProvider, "generate");
      raceArmed = true;

      const result = await createCustomerReplyDraft(
        state.payload,
        losingProvider,
        { ...input, correlationId: `ai-question-race-loser-${winnerStatus}` },
      );

      expect(result).toMatchObject({
        duplicate: true,
        message: {
          id: initial.message.id,
          bodyText: winnerBody,
          status: winnerStatus,
        },
      });
      expect(losingGenerate).toHaveBeenCalledTimes(1);
      expect(state.auditEvents).toHaveLength(2);
      expect(state.messages[1]).toMatchObject({
        bodyText: winnerBody,
        status: winnerStatus,
      });
    },
  );

  it("creates an idempotent replacement manual draft for a failed reply", async () => {
    const state = repository();
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "customer_question",
        channel: "email",
        subject: "Spørsmål om tilbud T-1-V1",
        bodyText: "Hva er inkludert i maksimalprisen?",
        status: "delivered",
        idempotencyKey: "question-source-replacement",
        aiAssisted: false,
      },
    });

    const first = await createManualCustomerQuestionReplyDraft(state.payload, {
      correlationId: "manual-question-replacement",
      expectedRevision: 1,
      generationKey: "regenerate-44",
      leadId: 1,
      sourceMessageId: source.id,
    });
    const retry = await createManualCustomerQuestionReplyDraft(state.payload, {
      correlationId: "manual-question-replacement-retry",
      expectedRevision: 1,
      generationKey: "regenerate-44",
      leadId: 1,
      sourceMessageId: source.id,
    });

    expect(first).toMatchObject({ duplicate: false });
    expect(retry).toMatchObject({
      duplicate: true,
      message: { id: first.message.id },
    });
  });

  it("rejects a manual reply source that is not the exact customer question", async () => {
    const state = repository();
    const source = await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "inbound",
        category: "follow_up",
        channel: "email",
        subject: "Annen melding",
        bodyText: "Dette er ikke et tilbudsspørsmål.",
        status: "delivered",
        idempotencyKey: "other-source-1",
        aiAssisted: false,
      },
    });

    await expect(
      createManualCustomerQuestionReplyDraft(state.payload, {
        correlationId: "manual-question-invalid",
        expectedRevision: 1,
        leadId: 1,
        sourceMessageId: source.id,
      }),
    ).rejects.toThrow(/exact customer-question source/);
  });

  it("does not reopen a closed case when the cancellation decision is sent", async () => {
    const state = repository();
    state.leads[0]!.status = "closed";
    await state.payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: 1,
        direction: "outbound",
        category: "follow_up",
        channel: "email",
        subject: "Avklaring av kanselleringsforespørselen",
        bodyText: "Vi bekrefter administrators vurdering av forespørselen.",
        status: "queued",
        idempotencyKey: "cancellation-resolution:1",
        aiAssisted: false,
        aiAnalysis: { cancellationDecision: "cancel" },
        approvedAt: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
      },
    });
    await deliverMessage(
      state.payload,
      new LogEmailProvider(),
      1,
      "cancellation-resolution",
      "admin_approved",
    );
    expect(state.leads[0]?.status).toBe("closed");
  });

  it("keeps the lead when AI validation fails", async () => {
    const state = repository();
    await expect(
      createLeadAiReply(
        state.payload,
        new DeterministicAiProvider({ invalid: true }),
        1,
        "ai-fail",
      ),
    ).rejects.toThrow();
    expect(state.leads).toHaveLength(1);
    expect(state.leads[0]?.status).toBe("new");
    expect(state.messages).toHaveLength(0);
  });

  it("does not generate an AI draft for a converted lead", async () => {
    const state = repository();
    state.leads[0]!.status = "converted";
    await expect(
      createLeadAiReply(
        state.payload,
        new DeterministicAiProvider(validAiReply),
        1,
        "stale-ai-job",
      ),
    ).rejects.toThrow("converted or closed");
    expect(state.messages).toHaveLength(0);
    expect(state.leads[0]?.status).toBe("converted");
  });
});
