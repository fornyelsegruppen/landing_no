import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { WebhookEventPayload } from "resend";
import { applyResendWebhookEvent } from "./resend-webhook";

function payloadWithMessage(status = "sent") {
  const message = { id: 7, lead: 11, status, providerMessageId: "email_123" };
  const lead = {
    id: 11,
    status: "contacted",
    phone: "+47 900 00 000",
    caseRevision: 1,
  };
  const update = vi.fn(
    async ({
      collection,
      data,
    }: {
      collection: string;
      data: Record<string, unknown>;
    }) => Object.assign(collection === "messages" ? message : lead, data),
  );
  const payload = {
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "messages" ? [message] : [],
    })),
    findByID: vi.fn(async () => lead),
    update,
  } as unknown as Payload;
  return { payload, lead, message, update };
}

function payloadWithQuestionReply(
  options: { anotherUnresolved?: boolean } = {},
) {
  const lead = {
    caseRevision: 1,
    id: 11,
    nextActionBlocker: "CUSTOMER_QUESTION_PENDING",
    phone: "+47 900 00 000",
    status: "customer_waiting",
  };
  const question = {
    category: "customer_question",
    createdAt: "2026-08-24T18:00:00.000Z",
    direction: "inbound",
    id: 6,
    lead: 11,
    status: "delivered",
  };
  const reply = {
    category: "ai_reply",
    createdAt: "2026-08-24T19:00:00.000Z",
    direction: "outbound",
    id: 7,
    lead: 11,
    providerMessageId: "email_123",
    replyToMessage: 6,
    status: "sent",
  };
  const messages: Array<Record<string, unknown> & { id: number }> = [
    question,
    reply,
  ];
  if (options.anotherUnresolved) {
    messages.push({
      category: "customer_question",
      createdAt: "2026-08-24T19:30:00.000Z",
      direction: "inbound",
      id: 8,
      lead: 11,
      status: "delivered",
    });
  }
  const update = vi.fn(
    async ({
      collection,
      data,
      id,
    }: {
      collection: string;
      data: Record<string, unknown>;
      id: number;
    }) => {
      const target =
        collection === "messages"
          ? messages.find((item) => item.id === id)
          : lead;
      if (!target) throw new Error("not found");
      return Object.assign(target, data);
    },
  );
  const payload = {
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where?: Record<string, unknown>;
      }) => {
        if (collection !== "messages") return { docs: [] };
        return JSON.stringify(where).includes("providerMessageId")
          ? { docs: [reply] }
          : { docs: messages };
      },
    ),
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: number }) =>
        collection === "messages"
          ? messages.find((item) => item.id === id)
          : lead,
    ),
    update,
  } as unknown as Payload;
  return { lead, messages, payload, question, reply, update };
}

function event(
  type: "email.delivered" | "email.bounced" | "email.delivery_delayed",
): WebhookEventPayload {
  return {
    type,
    created_at: "2026-08-24T20:00:00.000Z",
    data: {
      email_id: "email_123",
      created_at: "2026-08-24T20:00:00.000Z",
      from: "post@takfornyelse.as",
      to: ["kunde@example.test"],
      subject: "Test",
      ...(type === "email.bounced"
        ? {
            bounce: {
              message: "rejected",
              subType: "General",
              type: "Permanent",
            },
          }
        : {}),
    },
  } as WebhookEventPayload;
}

describe("Resend delivery events", () => {
  it("marks a matching message delivered idempotently", async () => {
    const state = payloadWithMessage();
    const result = await applyResendWebhookEvent(
      state.payload,
      event("email.delivered"),
    );
    expect(result).toMatchObject({
      matched: true,
      messageId: 7,
      status: "delivered",
    });
    expect(state.message).toMatchObject({
      status: "delivered",
      deliveredAt: "2026-08-24T20:00:00.000Z",
    });

    await applyResendWebhookEvent(state.payload, event("email.delivered"));
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it("clears the signing blocker only after the question reply is delivered", async () => {
    const state = payloadWithQuestionReply();

    await applyResendWebhookEvent(state.payload, event("email.delivered"));

    expect(state.reply).toMatchObject({ status: "delivered" });
    expect(state.lead).toMatchObject({
      nextActionBlocker: null,
      nextActionOwner: "customer",
      status: "waiting_customer",
    });
  });

  it("keeps the blocker when another customer question is still unanswered", async () => {
    const state = payloadWithQuestionReply({ anotherUnresolved: true });

    await applyResendWebhookEvent(state.payload, event("email.delivered"));

    expect(state.lead).toMatchObject({
      nextActionBlocker: "CUSTOMER_QUESTION_PENDING",
      nextActionOwner: "administrator",
      status: "customer_waiting",
    });
  });

  it("keeps a bounced question reply unresolved and routes it to attention", async () => {
    const state = payloadWithQuestionReply();

    await applyResendWebhookEvent(state.payload, event("email.bounced"));

    expect(state.reply).toMatchObject({
      failureCode: "EMAIL_BOUNCED",
      status: "attention",
    });
    expect(state.lead).toMatchObject({
      nextActionBlocker: "EMAIL_HARD_BOUNCE",
      nextActionOwner: "administrator",
    });
  });

  it("moves permanent provider failures to the attention queue without persisting provider PII", async () => {
    const state = payloadWithMessage();
    await applyResendWebhookEvent(state.payload, event("email.bounced"));
    expect(state.message).toMatchObject({
      status: "attention",
      failureCode: "EMAIL_BOUNCED",
    });
    expect(state.lead).toMatchObject({
      nextActionOwner: "administrator",
      nextActionBlocker: "EMAIL_HARD_BOUNCE",
    });
    expect(JSON.stringify(state.message)).not.toContain("kunde@example.test");
    expect(JSON.stringify(state.message)).not.toContain("rejected");
  });

  it("records a delay without claiming delivery failure", async () => {
    const state = payloadWithMessage();
    await applyResendWebhookEvent(
      state.payload,
      event("email.delivery_delayed"),
    );
    expect(state.message).toMatchObject({
      status: "sent",
      failureCode: "EMAIL_DELIVERY_DELAYED",
    });
  });
});
