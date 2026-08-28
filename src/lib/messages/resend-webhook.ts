import type { Payload } from "payload";
import type { WebhookEventPayload } from "resend";
import { updateCaseState } from "@/lib/cases/case-command";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { loadUnresolvedCustomerQuestion } from "./customer-question-state";

type EmailWebhookEvent = Extract<
  WebhookEventPayload,
  { data: { email_id: string } }
>;

function isEmailEvent(event: WebhookEventPayload): event is EmailWebhookEvent {
  return Boolean(
    event.data && typeof event.data === "object" && "email_id" in event.data,
  );
}

function failureCode(type: EmailWebhookEvent["type"]) {
  return type.replace("email.", "EMAIL_").replaceAll(".", "_").toUpperCase();
}

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  ) {
    return (value as { id: number }).id;
  }
  return null;
}

async function applyDeliveredQuestionReplyState(
  payload: Payload,
  message: { id: number; lead?: unknown; replyToMessage?: unknown },
  deliveredAt: string,
  providerMessageId: string,
) {
  const leadId = relationId(message.lead);
  const sourceMessageId = relationId(message.replyToMessage);
  if (!leadId || !sourceMessageId) return;
  const source = await payload.findByID({
    collection: "messages",
    id: sourceMessageId,
    depth: 0,
    overrideAccess: true,
  });
  if (
    relationId(source.lead) !== leadId ||
    source.direction !== "inbound" ||
    source.category !== "customer_question"
  ) {
    return;
  }
  const unresolved = await loadUnresolvedCustomerQuestion(payload, leadId);
  await updateCaseState(payload, {
    leadId,
    command: "customer_question_reply_delivered",
    idempotencyKey: makeIdempotencyKey("customer.question.reply-delivered", {
      messageId: message.id,
      providerMessageId,
    }),
    patch: unresolved
      ? {
          status: "customer_waiting",
          nextActionOwner: "administrator",
          nextAction:
            "Kunden har flere ubesvarte spørsmål. Kontroller og send neste svar.",
          nextActionAt: deliveredAt,
          nextActionBlocker: "CUSTOMER_QUESTION_PENDING",
          lastContactAt: deliveredAt,
        }
      : {
          status: "waiting_customer",
          nextActionOwner: "customer",
          nextAction:
            "Vent på kundens svar og følg opp dersom kunden ikke svarer.",
          nextActionAt: new Date(
            new Date(deliveredAt).getTime() + 3 * 24 * 60 * 60_000,
          ).toISOString(),
          nextActionBlocker: null,
          lastContactAt: deliveredAt,
        },
  });
}

export async function applyResendWebhookEvent(
  payload: Payload,
  event: WebhookEventPayload,
) {
  if (!isEmailEvent(event))
    return { matched: false as const, reason: "not-email-event" };

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
    await applyDeliveredQuestionReplyState(
      payload,
      message,
      event.created_at,
      event.data.email_id,
    );
    return {
      matched: true as const,
      messageId: message.id,
      status: "delivered" as const,
    };
  }

  if (
    [
      "email.bounced",
      "email.complained",
      "email.failed",
      "email.suppressed",
    ].includes(event.type)
  ) {
    await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: {
        status: "attention",
        failureCode: failureCode(event.type),
        failureMessage:
          "Leverandøren avviste eller stoppet meldingen. Kontroller adressen og leveringsloggen.",
      },
    });
    const leadId =
      typeof message.lead === "number"
        ? message.lead
        : message.lead &&
            typeof message.lead === "object" &&
            "id" in message.lead
          ? Number(message.lead.id)
          : null;
    if (leadId && Number.isSafeInteger(leadId)) {
      const lead = await payload.findByID({
        collection: "leads",
        id: leadId,
        depth: 0,
        overrideAccess: true,
      });
      const hasPhone =
        typeof lead.phone === "string" && lead.phone.trim().length >= 8;
      await updateCaseState(payload, {
        leadId,
        command: "email_delivery_failed",
        idempotencyKey: makeIdempotencyKey("email.delivery-failed", {
          messageId: message.id,
          type: event.type,
        }),
        patch: {
          nextActionOwner: "administrator",
          nextActionAt: new Date().toISOString(),
          nextActionBlocker: "EMAIL_HARD_BOUNCE",
          nextAction: hasPhone
            ? "E-posten ble permanent avvist. Kontroller adressen og kontakt kunden manuelt på telefon. SMS-lenke kan først sendes når en godkjent SMS-leverandør er konfigurert."
            : "E-posten ble permanent avvist, og kunden har ikke et gyldig telefonnummer. Finn en trygg manuell kontaktkanal.",
        },
      });
    }
    return {
      matched: true as const,
      messageId: message.id,
      status: "attention" as const,
    };
  }

  if (event.type === "email.delivery_delayed") {
    await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: {
        failureCode: "EMAIL_DELIVERY_DELAYED",
        failureMessage:
          "Leverandøren har varslet forsinket levering. Meldingen følges opp automatisk.",
      },
    });
    return {
      matched: true as const,
      messageId: message.id,
      status: message.status,
    };
  }

  return {
    matched: true as const,
    messageId: message.id,
    status: message.status,
  };
}
