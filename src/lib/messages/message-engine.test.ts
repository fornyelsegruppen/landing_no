import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  DeterministicAiProvider,
  LogEmailProvider,
} from "@/lib/providers/safe-providers";
import {
  createCustomerReplyDraft,
  createLeadAiReply,
  createManualCustomerQuestionReplyDraft,
  createReceiptMessage,
  deliverMessage,
  enqueueMessageJob,
  manualQuestionReplyPlaceholder,
} from "./message-engine";
import { loadCustomerReplySourceBundle } from "./customer-reply-sources";

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
    beforeConditionalMessageUpdate?: (
      messages: TestDocument[],
      nextTimestamp: () => string,
    ) => void | Promise<void>;
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
      where?: { idempotencyKey?: { equals?: string } };
    }) {
      const docs = collections[collection] || [];
      const key = where?.idempotencyKey?.equals;
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
    await deliverMessage(state.payload, provider, 1, "receipt-test");
    await deliverMessage(state.payload, provider, 1, "receipt-test-repeat");
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
    );
    expect(recipients).toEqual(["confirmed@example.no"]);
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
    await enqueueMessageJob(state.payload, 1, "receipt-retry-again");
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({ status: "pending", attempts: 0 });
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
      generationKey: "regenerate-44",
      leadId: 1,
      sourceMessageId: source.id,
    });
    const retry = await createManualCustomerQuestionReplyDraft(state.payload, {
      correlationId: "manual-question-replacement-retry",
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
