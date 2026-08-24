import type { Payload } from "payload";
import type { WebhookEventPayload } from "resend";

type EmailWebhookEvent = Extract<WebhookEventPayload, { data: { email_id: string } }>;

function isEmailEvent(event: WebhookEventPayload): event is EmailWebhookEvent {
  return Boolean(event.data && typeof event.data === "object" && "email_id" in event.data);
}

function failureCode(type: EmailWebhookEvent["type"]) {
  return type.replace("email.", "EMAIL_").replaceAll(".", "_").toUpperCase();
}

export async function applyResendWebhookEvent(payload: Payload, event: WebhookEventPayload) {
  if (!isEmailEvent(event)) return { matched: false as const, reason: "not-email-event" };

  const result = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { providerMessageId: { equals: event.data.email_id } },
  });
  const message = result.docs[0];
  if (!message) return { matched: false as const, reason: "message-not-found" };

  if (event.type === "email.delivered") {
    if (message.status !== "delivered") {
      await payload.update({
        collection: "messages",
        id: message.id,
        overrideAccess: true,
        data: {
          status: "delivered",
          deliveredAt: event.created_at,
          failureCode: null,
          failureMessage: null,
        },
      });
    }
    return { matched: true as const, messageId: message.id, status: "delivered" as const };
  }

  if (["email.bounced", "email.complained", "email.failed", "email.suppressed"].includes(event.type)) {
    await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: {
        status: "attention",
        failureCode: failureCode(event.type),
        failureMessage: "Leverandøren avviste eller stoppet meldingen. Kontroller adressen og leveringsloggen.",
      },
    });
    return { matched: true as const, messageId: message.id, status: "attention" as const };
  }

  if (event.type === "email.delivery_delayed") {
    await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: {
        failureCode: "EMAIL_DELIVERY_DELAYED",
        failureMessage: "Leverandøren har varslet forsinket levering. Meldingen følges opp automatisk.",
      },
    });
    return { matched: true as const, messageId: message.id, status: message.status };
  }

  return { matched: true as const, messageId: message.id, status: message.status };
}
