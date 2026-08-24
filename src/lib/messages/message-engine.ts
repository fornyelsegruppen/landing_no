import type { Payload } from "payload";
import type { AiProvider, EmailProvider } from "@/lib/providers/contracts";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { sanitizeJobError } from "@/lib/jobs/job-policy";
import { generateLeadReplyDraft } from "@/lib/leads/lead-ai";
import { assertMessageCanDeliver } from "./message-policy";
import { readPrivateMediaContent } from "@/lib/private-media-content";

function relationId(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") {
    return (value as { id: number }).id;
  }
  return undefined;
}

function photoCount(value: string | null | undefined) {
  return (value || "").split(/\r?\n/).filter(Boolean).length;
}

function receiptCopy(language: string) {
  if (language === "en") {
    return {
      subject: "We have received your roof enquiry",
      text: "Thank you for contacting Takfornyelse. We have received your enquiry and will review the information. We will contact you if we need more details before we can suggest the next step.\n\nRegards,\nTakfornyelse\n47 73 58 88",
    };
  }
  return {
    subject: "Vi har mottatt henvendelsen din",
    text: "Takk for at du kontaktet Takfornyelse. Vi har mottatt henvendelsen og går gjennom opplysningene. Vi tar kontakt dersom vi trenger mer informasjon før vi kan foreslå neste steg.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88",
  };
}

async function findMessageByKey(payload: Payload, idempotencyKey: string) {
  const result = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { idempotencyKey: { equals: idempotencyKey } },
  });
  return result.docs[0] || null;
}

export async function enqueueMessageJob(payload: Payload, messageId: number, correlationId: string) {
  const idempotencyKey = makeIdempotencyKey("message.delivery", { messageId });
  const existing = await payload.find({
    collection: "operational-jobs",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { idempotencyKey: { equals: idempotencyKey } },
  });
  if (existing.docs[0]) {
    const job = existing.docs[0];
    if (["attention", "failed", "cancelled"].includes(job.status)) {
      return payload.update({
        collection: "operational-jobs",
        id: job.id,
        overrideAccess: true,
        data: { status: "pending", attempts: 0, availableAt: new Date().toISOString(), lastErrorCode: null, lastErrorMessage: null },
      });
    }
    return job;
  }
  return payload.create({
    collection: "operational-jobs",
    overrideAccess: true,
    data: {
      type: "message.delivery",
      status: "pending",
      idempotencyKey,
      correlationId,
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date().toISOString(),
      payload: { messageId },
    },
  });
}

export async function enqueueLeadAiJob(payload: Payload, leadId: number, correlationId: string) {
  const idempotencyKey = makeIdempotencyKey("lead.ai.reply", { leadId });
  const existing = await payload.find({
    collection: "operational-jobs",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { idempotencyKey: { equals: idempotencyKey } },
  });
  if (existing.docs[0]) return existing.docs[0];
  return payload.create({
    collection: "operational-jobs",
    overrideAccess: true,
    data: {
      type: "lead.ai.draft",
      status: "pending",
      idempotencyKey,
      correlationId,
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date().toISOString(),
      payload: { leadId },
    },
  });
}

export async function createReceiptMessage(payload: Payload, leadId: number, correlationId: string) {
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (!lead.email) return { skipped: true as const, reason: "no_email" };
  const idempotencyKey = makeIdempotencyKey("lead.receipt", { leadId });
  const duplicate = await findMessageByKey(payload, idempotencyKey);
  if (duplicate) return { skipped: false as const, duplicate: true as const, message: duplicate };
  const copy = receiptCopy(lead.language);
  const now = new Date().toISOString();
  const message = await payload.create({
    collection: "messages",
    overrideAccess: true,
    data: {
      lead: lead.id,
      direction: "outbound",
      category: "receipt",
      channel: "email",
      subject: copy.subject,
      bodyText: copy.text,
      status: "queued",
      idempotencyKey,
      aiAssisted: false,
      approvedAt: now,
      queuedAt: now,
    },
  });
  await enqueueMessageJob(payload, message.id, correlationId);
  return { skipped: false as const, duplicate: false as const, message };
}

export async function createLeadAiReply(payload: Payload, provider: AiProvider, leadId: number, correlationId: string) {
  const idempotencyKey = makeIdempotencyKey("lead.ai.reply", { leadId });
  const duplicate = await findMessageByKey(payload, idempotencyKey);
  if (duplicate) return { duplicate: true as const, message: duplicate };
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (lead.status === "converted" || lead.status === "closed") {
    throw new TypeError("AI draft cannot be generated for a converted or closed lead");
  }
  const generated = await generateLeadReplyDraft({
    provider,
    correlationId,
    lead: {
      inquiryType: lead.inquiryType,
      postal: lead.postal,
      city: lead.city,
      approxSqm: lead.approxSqm,
      message: lead.message,
      hasAddress: Boolean(lead.address && lead.address !== "Ikke oppgitt"),
      photoCount: photoCount(lead.photoUrls),
    },
  });
  const message = await payload.create({
    collection: "messages",
    overrideAccess: true,
    data: {
      lead: lead.id,
      direction: "outbound",
      category: "ai_reply",
      channel: lead.email ? "email" : "sms",
      subject: generated.result.subject,
      bodyText: generated.result.replyDraft,
      status: "draft",
      idempotencyKey,
      aiAssisted: true,
      aiAnalysis: generated.result,
      modelVersion: generated.model,
      promptVersion: generated.promptVersion,
    },
  });
  await payload.update({
    collection: "leads",
    id: lead.id,
    overrideAccess: true,
    data: {
      status: "draft_ready",
      qualification: generated.result,
      nextAction: "Kontroller AI-utkast og velg neste handling.",
      nextActionAt: new Date().toISOString(),
    },
  });
  return { duplicate: false as const, message, generated };
}

export async function deliverMessage(payload: Payload, provider: EmailProvider, messageId: number, correlationId: string) {
  const message = await payload.findByID({ collection: "messages", id: messageId, depth: 1, overrideAccess: true });
  if (["sent", "delivered"].includes(message.status)) return { duplicate: true as const, message };
  assertMessageCanDeliver(message);
  if (message.channel !== "email") throw new TypeError("SMS delivery is not enabled");
  const leadId = relationId(message.lead);
  if (!leadId) throw new TypeError("Message has no lead");
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (!lead.email) throw new TypeError("Lead has no email address");
  try {
    const attachments = [];
    for (const relation of message.attachments ?? []) {
      const mediaId = relationId(relation);
      if (!mediaId) continue;
      const media = await payload.findByID({ collection: "private-media", id: mediaId, depth: 0, overrideAccess: true });
      const content = await readPrivateMediaContent(media);
      attachments.push({ filename: content.filename, contentType: content.contentType, contentBase64: content.data.toString("base64") });
    }
    const result = await provider.send({
      template: message.category,
      to: lead.email,
      subject: message.subject,
      text: message.bodyText,
      ...(message.bodyHtml ? { html: message.bodyHtml } : {}),
      replyTo: process.env.LEAD_TO_EMAIL || "post@takfornyelse.as",
      idempotencyKey: message.idempotencyKey,
      correlationId,
      ...(attachments.length ? { attachments } : {}),
    });
    const updated = await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: {
        status: "sent",
        sentAt: result.acceptedAt,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        failureCode: null,
        failureMessage: null,
      },
    });
    const analysis = message.aiAnalysis && typeof message.aiAnalysis === "object"
      ? message.aiAnalysis as { recommendedNextAction?: string; quoteId?: number }
      : {};
    if (message.category === "quote" && typeof analysis.quoteId === "number") {
      const quote = await payload.findByID({ collection: "quotes", id: analysis.quoteId, depth: 0, overrideAccess: true });
      if (quote.status === "approved") {
        await payload.update({ collection: "quotes", id: quote.id, overrideAccess: true, data: { status: "sent", sentAt: result.acceptedAt } });
      }
    }
    const followUp = message.category === "completion"
      ? {
          status: "converted" as const,
          nextAction: "Oppdrag fullført og dokumentert.",
          nextActionAt: null,
        }
      : ["receipt", "contract", "change_confirmation"].includes(message.category)
      ? {}
      : message.category === "information_request" || analysis.recommendedNextAction === "request_information"
        ? {
            status: "waiting_customer" as const,
            nextAction: "Følg opp dersom kunden ikke svarer.",
            nextActionAt: new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString(),
          }
        : analysis.recommendedNextAction === "start_measurement"
          ? {
              status: "qualified" as const,
              nextAction: "Start kontrollert takmåling.",
              nextActionAt: new Date().toISOString(),
            }
          : {
              status: "contacted" as const,
              nextAction: "Kontroller henvendelsen og velg neste steg.",
              nextActionAt: new Date().toISOString(),
            };
    await payload.update({
      collection: "leads",
      id: lead.id,
      overrideAccess: true,
      data: { lastContactAt: result.acceptedAt, ...followUp },
    });
    return { duplicate: false as const, message: updated };
  } catch (error) {
    const sanitized = sanitizeJobError(error);
    await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: { status: "queued", failureCode: sanitized.code, failureMessage: sanitized.message },
    });
    throw error;
  }
}
