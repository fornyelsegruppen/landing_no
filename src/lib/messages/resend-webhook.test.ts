import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { WebhookEventPayload } from "resend";
import { applyResendWebhookEvent } from "./resend-webhook";

function payloadWithMessage(status = "sent") {
  const message = { id: 7, lead: 11, status, providerMessageId: "email_123" };
  const lead = { id: 11, status: "contacted", phone: "+47 900 00 000", caseRevision: 1 };
  const update = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => Object.assign(collection === "messages" ? message : lead, data));
  const payload = {
    find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === "messages" ? [message] : [] })),
    findByID: vi.fn(async () => lead),
    update,
  } as unknown as Payload;
  return { payload, lead, message, update };
}

function event(type: "email.delivered" | "email.bounced" | "email.delivery_delayed"): WebhookEventPayload {
  return {
    type,
    created_at: "2026-08-24T20:00:00.000Z",
    data: {
      email_id: "email_123",
      created_at: "2026-08-24T20:00:00.000Z",
      from: "post@takfornyelse.as",
      to: ["kunde@example.test"],
      subject: "Test",
      ...(type === "email.bounced" ? { bounce: { message: "rejected", subType: "General", type: "Permanent" } } : {}),
    },
  } as WebhookEventPayload;
}

describe("Resend delivery events", () => {
  it("marks a matching message delivered idempotently", async () => {
    const state = payloadWithMessage();
    const result = await applyResendWebhookEvent(state.payload, event("email.delivered"));
    expect(result).toMatchObject({ matched: true, messageId: 7, status: "delivered" });
    expect(state.message).toMatchObject({ status: "delivered", deliveredAt: "2026-08-24T20:00:00.000Z" });

    await applyResendWebhookEvent(state.payload, event("email.delivered"));
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it("moves permanent provider failures to the attention queue without persisting provider PII", async () => {
    const state = payloadWithMessage();
    await applyResendWebhookEvent(state.payload, event("email.bounced"));
    expect(state.message).toMatchObject({ status: "attention", failureCode: "EMAIL_BOUNCED" });
    expect(state.lead).toMatchObject({ nextActionOwner: "administrator", nextActionBlocker: "EMAIL_HARD_BOUNCE" });
    expect(JSON.stringify(state.message)).not.toContain("kunde@example.test");
    expect(JSON.stringify(state.message)).not.toContain("rejected");
  });

  it("records a delay without claiming delivery failure", async () => {
    const state = payloadWithMessage();
    await applyResendWebhookEvent(state.payload, event("email.delivery_delayed"));
    expect(state.message).toMatchObject({ status: "sent", failureCode: "EMAIL_DELIVERY_DELAYED" });
  });
});
