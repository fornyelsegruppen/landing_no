import type { Payload } from "payload";
import type { AiProvider, EmailProvider } from "@/lib/providers/contracts";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { sanitizeJobError } from "@/lib/jobs/job-policy";
import { generateLeadReplyDraft } from "@/lib/leads/lead-ai";
import { assertMessageCanDeliver } from "./message-policy";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import {
  buildBrandedEmailHtml,
  secureCustomerLinkLabel,
} from "./email-template";
import { updateCaseState } from "@/lib/cases/case-command";
import { caseReplyAddress } from "./case-reply";
import { enqueueQuoteFollowUps } from "@/lib/quotes/follow-up-schedule";
import { featureReadiness } from "@/lib/platform/features";
import {
  customerReplyContextFromAnalysis,
  generateCustomerReplyDraft,
  type CustomerReplyPurpose,
} from "./customer-reply";
import {
  assertCustomerReplySourcesCurrent,
  loadCustomerReplySourceBundle,
} from "./customer-reply-sources";
import { reserveCustomerReplyAiRequest } from "@/lib/ai/payload-usage-limit";

export const manualQuestionReplyPlaceholder =
  "Skriv et kontrollert svar til kunden her før utsending.";

export function assertCustomerReplyDeliveryTrackingReady(
  provider: EmailProvider,
  purpose: CustomerReplyPurpose | null | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (
    purpose === "question" &&
    provider.health().provider === "resend" &&
    !environment.RESEND_WEBHOOK_SECRET?.trim()
  ) {
    throw new TypeError(
      "Confirmed delivery requires the Resend delivery webhook to be configured",
    );
  }
}

function relationId(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  ) {
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

export async function enqueueMessageJob(
  payload: Payload,
  messageId: number,
  correlationId: string,
) {
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
        data: {
          status: "pending",
          attempts: 0,
          availableAt: new Date().toISOString(),
          lastErrorCode: null,
          lastErrorMessage: null,
        },
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

export async function enqueueLeadAiJob(
  payload: Payload,
  leadId: number,
  correlationId: string,
) {
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

export async function enqueueCustomerReplyDraft(
  payload: Payload,
  input: {
    correlationId: string;
    leadId: number;
    purpose: CustomerReplyPurpose;
    sourceMessageId: number;
  },
) {
  const idempotencyKey = makeIdempotencyKey("customer.reply.draft", {
    sourceMessageId: input.sourceMessageId,
    purpose: input.purpose,
  });
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
      type: "customer.reply.draft",
      status: "pending",
      idempotencyKey,
      correlationId: input.correlationId,
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date().toISOString(),
      payload: {
        leadId: input.leadId,
        purpose: input.purpose,
        sourceMessageId: input.sourceMessageId,
      },
    },
  });
}

export async function createReceiptMessage(
  payload: Payload,
  leadId: number,
  correlationId: string,
) {
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  if (!lead.email) return { skipped: true as const, reason: "no_email" };
  const idempotencyKey = makeIdempotencyKey("lead.receipt", { leadId });
  const duplicate = await findMessageByKey(payload, idempotencyKey);
  if (duplicate)
    return {
      skipped: false as const,
      duplicate: true as const,
      message: duplicate,
    };
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
      bodyHtml: buildBrandedEmailHtml({
        subject: copy.subject,
        text: copy.text,
      }),
      status: "queued",
      idempotencyKey,
      aiAssisted: false,
      approvedAt: now,
      queuedAt: now,
    },
  });
  const job = await enqueueMessageJob(payload, message.id, correlationId);
  return { skipped: false as const, duplicate: false as const, message, job };
}

export async function createLeadAiReply(
  payload: Payload,
  provider: AiProvider,
  leadId: number,
  correlationId: string,
) {
  const idempotencyKey = makeIdempotencyKey("lead.ai.reply", { leadId });
  const duplicate = await findMessageByKey(payload, idempotencyKey);
  if (duplicate) return { duplicate: true as const, message: duplicate };
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  if (lead.status === "converted" || lead.status === "closed") {
    throw new TypeError(
      "AI draft cannot be generated for a converted or closed lead",
    );
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
  await updateCaseState(payload, {
    leadId: lead.id,
    command: "ai_reply_drafted",
    idempotencyKey,
    patch: {
      status: "draft_ready",
      qualification: generated.result,
      nextActionOwner: "administrator",
      nextAction: "Kontroller AI-utkast og velg neste handling.",
      nextActionAt: new Date().toISOString(),
    },
  });
  return { duplicate: false as const, message, generated };
}

export async function createCustomerReplyDraft(
  payload: Payload,
  provider: AiProvider,
  input: {
    correlationId: string;
    generationKey?: string;
    leadId: number;
    purpose: CustomerReplyPurpose;
    sourceMessageId: number;
  },
) {
  const source = await payload.findByID({
    collection: "messages",
    id: input.sourceMessageId,
    depth: 0,
    overrideAccess: true,
  });
  if (
    relationId(source.lead) !== input.leadId ||
    source.direction !== "inbound"
  ) {
    throw new TypeError(
      "Reply source must be an inbound message in the same customer case",
    );
  }
  const idempotencyKey = makeIdempotencyKey("customer.reply", {
    generationKey: input.generationKey || "initial",
    sourceMessageId: source.id,
  });
  const duplicate = await findMessageByKey(payload, idempotencyKey);
  if (duplicate && duplicate.status !== "cancelled") {
    return { duplicate: true as const, message: duplicate };
  }

  const lead = await payload.findByID({
    collection: "leads",
    id: input.leadId,
    depth: 0,
    overrideAccess: true,
  });
  if (lead.status === "closed" || lead.recordState !== "active")
    throw new TypeError(
      "A reply draft cannot be generated for a closed or archived case",
    );
  const sourceBundle = await loadCustomerReplySourceBundle(payload, {
    leadId: input.leadId,
    purpose: input.purpose,
    sourceMessageId: input.sourceMessageId,
  });
  const generated = await generateCustomerReplyDraft({
    provider,
    context: sourceBundle.context,
    correlationId: input.correlationId,
    beforeGenerate: ({ attempt, correlationId }) =>
      reserveCustomerReplyAiRequest(payload, {
        attempt,
        correlationId,
        sourceMessageId: source.id,
      }).then(() => undefined),
  });
  const factWarnings = [
    ...generated.result.factWarnings,
    ...(!sourceBundle.context.measurement
      ? ["Ingen godkjent takmåling er tilgjengelig."]
      : []),
    ...(!sourceBundle.context.quote && input.purpose !== "cancellation"
      ? ["Ingen aktiv tilbudssnapshot er tilgjengelig."]
      : []),
    ...(input.purpose === "cancellation"
      ? [
          "Kanselleringsforespørselen krever administratorbeslutning og må ikke bekreftes automatisk.",
        ]
      : []),
  ];
  const data = {
    lead: lead.id,
    replyToMessage: source.id,
    direction: "outbound" as const,
    category: "ai_reply" as const,
    channel: lead.email ? ("email" as const) : ("sms" as const),
    subject: generated.result.subject,
    bodyText: generated.result.replyDraft,
    bodyHtml: null,
    status: "draft" as const,
    idempotencyKey,
    aiAssisted: true,
    aiAnalysis: {
      ...generated.result,
      factWarnings,
      purpose: input.purpose,
      sourceMessageId: source.id,
      replyFactContext: generated.context,
      replySourceFingerprint: sourceBundle.fingerprint,
      replySourceSnapshot: sourceBundle.snapshot,
    },
    modelVersion: generated.model,
    promptVersion: generated.promptVersion,
    approvedBy: null,
    approvedAt: null,
    queuedAt: null,
    sentAt: null,
    deliveredAt: null,
    provider: null,
    providerMessageId: null,
    failureCode: null,
    failureMessage: null,
  };
  let message;
  if (duplicate) {
    const reactivated = await payload.update({
      collection: "messages",
      overrideAccess: true,
      where: {
        and: [
          { id: { equals: duplicate.id } },
          { status: { equals: "cancelled" } },
          { updatedAt: { equals: duplicate.updatedAt } },
        ],
      },
      data,
    });
    message = reactivated.docs?.[0];
    if (!message) {
      const winner = await payload.findByID({
        collection: "messages",
        id: duplicate.id,
        depth: 0,
        overrideAccess: true,
      });
      if (winner.status !== "cancelled") {
        return { duplicate: true as const, message: winner };
      }
      throw new TypeError(
        "The cancelled reply changed while a new draft was generated. Retry from the current case state.",
      );
    }
  } else {
    message = await payload.create({
      collection: "messages",
      overrideAccess: true,
      data,
    });
  }
  await updateCaseState(payload, {
    leadId: lead.id,
    command: "customer_reply_drafted",
    idempotencyKey,
    patch: {
      status: "customer_waiting",
      nextActionOwner: "administrator",
      nextAction:
        input.purpose === "decline"
          ? "Kontroller avslagsårsaken og AI-utkastet. Send oppfølging, lag et revidert tilbud eller avslutt saken."
          : input.purpose === "cancellation"
            ? "Vurder kundens kanselleringsforespørsel. Ikke start eller opprett arbeid før administrator har besluttet saken."
            : "Kontroller kundens spørsmål, faktavarsler og AI-utkast før utsending.",
      nextActionAt: new Date().toISOString(),
    },
  });
  return { duplicate: false as const, message, generated, factWarnings };
}

export async function createManualCustomerQuestionReplyDraft(
  payload: Payload,
  input: {
    correlationId: string;
    generationKey?: string;
    leadId: number;
    sourceMessageId: number;
  },
) {
  const source = await payload.findByID({
    collection: "messages",
    id: input.sourceMessageId,
    depth: 0,
    overrideAccess: true,
  });
  if (
    relationId(source.lead) !== input.leadId ||
    source.direction !== "inbound" ||
    source.category !== "customer_question"
  ) {
    throw new TypeError(
      "Manual question replies require an exact customer-question source in the same case",
    );
  }
  const idempotencyKey = makeIdempotencyKey(
    "customer.question.manual-reply",
    input.generationKey
      ? { generationKey: input.generationKey, sourceMessageId: source.id }
      : { sourceMessageId: source.id },
  );
  const duplicate = await findMessageByKey(payload, idempotencyKey);
  if (duplicate && duplicate.status !== "cancelled") {
    return { duplicate: true as const, message: duplicate };
  }

  const lead = await payload.findByID({
    collection: "leads",
    id: input.leadId,
    depth: 0,
    overrideAccess: true,
  });
  if (lead.status === "closed" || lead.recordState !== "active") {
    throw new TypeError(
      "A reply draft cannot be generated for a closed or archived case",
    );
  }
  const sourceBundle = await loadCustomerReplySourceBundle(payload, {
    leadId: input.leadId,
    purpose: "question",
    sourceMessageId: source.id,
  });
  const subject = `Svar: ${source.subject || "Spørsmål om tilbudet"}`.slice(
    0,
    160,
  );
  const data = {
    lead: lead.id,
    replyToMessage: source.id,
    direction: "outbound" as const,
    category: "follow_up" as const,
    channel: lead.email ? ("email" as const) : ("sms" as const),
    subject,
    bodyText: manualQuestionReplyPlaceholder,
    status: "draft" as const,
    idempotencyKey,
    aiAssisted: false,
    aiAnalysis: {
      purpose: "question",
      sourceMessageId: source.id,
      manualQuestionReply: true,
      manualReplyRequiresEditing: true,
      replyFactContext: sourceBundle.context,
      replySourceFingerprint: sourceBundle.fingerprint,
      replySourceSnapshot: sourceBundle.snapshot,
    },
  };
  const message = duplicate
    ? await payload.update({
        collection: "messages",
        id: duplicate.id,
        overrideAccess: true,
        data,
      })
    : await payload.create({
        collection: "messages",
        overrideAccess: true,
        data,
      });
  await updateCaseState(payload, {
    leadId: lead.id,
    command: "manual_customer_question_reply_drafted",
    idempotencyKey: `${idempotencyKey}:${message.id}`,
    patch: {
      status: "customer_waiting",
      nextActionOwner: "administrator",
      nextAction:
        "Skriv, kontroller og send et manuelt svar på kundens spørsmål.",
      nextActionAt: new Date().toISOString(),
      nextActionBlocker: "CUSTOMER_QUESTION_PENDING",
    },
  });
  return { duplicate: false as const, message };
}

export async function deliverMessage(
  payload: Payload,
  provider: EmailProvider,
  messageId: number,
  correlationId: string,
) {
  const message = await payload.findByID({
    collection: "messages",
    id: messageId,
    depth: 1,
    overrideAccess: true,
  });
  if (["sent", "delivered"].includes(message.status))
    return { duplicate: true as const, message };
  assertMessageCanDeliver(message);
  if (message.channel !== "email")
    throw new TypeError("SMS delivery is not enabled");
  const leadId = relationId(message.lead);
  if (!leadId) throw new TypeError("Message has no lead");
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  const deliveryEmail = lead.communicationEmail || lead.email;
  if (!deliveryEmail) throw new TypeError("Lead has no email address");
  try {
    const attachments = [];
    for (const relation of message.attachments ?? []) {
      const mediaId = relationId(relation);
      if (!mediaId) continue;
      const media = await payload.findByID({
        collection: "private-media",
        id: mediaId,
        depth: 0,
        overrideAccess: true,
      });
      const content = await readPrivateMediaContent(media);
      attachments.push({
        filename: content.filename,
        contentType: content.contentType,
        contentBase64: content.data.toString("base64"),
      });
    }
    const currentSources = await assertCustomerReplySourcesCurrent(
      payload,
      message,
    );
    assertCustomerReplyDeliveryTrackingReady(
      provider,
      currentSources?.context.purpose,
    );
    const result = await provider.send({
      template: message.category,
      to: deliveryEmail,
      subject: message.subject,
      text: message.bodyText,
      html:
        message.bodyHtml ||
        buildBrandedEmailHtml({
          subject: message.subject,
          text: message.bodyText,
          secureLinkLabel: secureCustomerLinkLabel(message.category),
        }),
      replyTo:
        (featureReadiness("communicationRoutingV2").ready
          ? caseReplyAddress(lead.id)
          : null) ||
        process.env.LEAD_TO_EMAIL ||
        "post@takfornyelse.as",
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
    const analysis =
      message.aiAnalysis && typeof message.aiAnalysis === "object"
        ? (message.aiAnalysis as {
            alternativeQuoteId?: number;
            cancellationDecision?: string;
            recommendedNextAction?: string;
            quoteId?: number;
            officialInvoiceId?: number;
          })
        : {};
    if (
      message.category === "invoice" &&
      typeof analysis.officialInvoiceId === "number"
    ) {
      const invoice = await payload.findByID({
        collection: "official-invoices",
        id: analysis.officialInvoiceId,
        depth: 0,
        overrideAccess: true,
      });
      if (invoice.status === "issued") {
        await payload.update({
          collection: "official-invoices",
          id: invoice.id,
          depth: 0,
          overrideAccess: true,
          data: { status: "sent", sentAt: result.acceptedAt },
        });
        await payload.update({
          collection: "official-invoices",
          id: invoice.id,
          depth: 0,
          overrideAccess: true,
          data: { status: "awaiting_payment" },
        });
      }
      const invoiceRecordId = relationId(invoice.invoiceRecord);
      if (invoiceRecordId) {
        const basis = await payload.findByID({
          collection: "invoice-records",
          id: invoiceRecordId,
          depth: 0,
          overrideAccess: true,
        });
        if (basis.status === "exported")
          await payload.update({
            collection: "invoice-records",
            id: basis.id,
            depth: 0,
            overrideAccess: true,
            data: { status: "sent" },
          });
      }
    }
    const replyContext = customerReplyContextFromAnalysis(message.aiAnalysis);
    if (message.category === "quote" && typeof analysis.quoteId === "number") {
      const quoteIds = [analysis.quoteId, analysis.alternativeQuoteId].filter(
        (value): value is number => typeof value === "number",
      );
      for (const quoteId of quoteIds) {
        const quote = await payload.findByID({
          collection: "quotes",
          id: quoteId,
          depth: 0,
          overrideAccess: true,
        });
        if (quote.status === "approved") {
          await payload.update({
            collection: "quotes",
            id: quote.id,
            overrideAccess: true,
            data: { status: "sent", sentAt: result.acceptedAt },
          });
        }
      }
      const primary = await payload.findByID({
        collection: "quotes",
        id: analysis.quoteId,
        depth: 0,
        overrideAccess: true,
      });
      await enqueueQuoteFollowUps(
        payload,
        {
          quoteId: primary.id,
          leadId: lead.id,
          validUntil: primary.validUntil,
        },
        correlationId,
      );
    }
    const isCustomerQuestionReply =
      replyContext?.purpose === "question" ||
      (analysis as Record<string, unknown>).manualQuestionReply === true;
    const followUp =
      lead.status === "closed" || analysis.cancellationDecision
        ? {}
        : isCustomerQuestionReply
          ? {}
          : replyContext?.purpose === "cancellation"
            ? {
                status: "customer_waiting" as const,
                nextAction:
                  "Vurder kundens kanselleringsforespørsel før arbeid kan startes.",
                nextActionAt: new Date().toISOString(),
              }
            : replyContext
              ? {
                  status: "waiting_customer" as const,
                  nextAction:
                    "Vent på kundens svar og følg opp dersom kunden ikke svarer.",
                  nextActionAt: new Date(
                    Date.now() + 3 * 24 * 60 * 60_000,
                  ).toISOString(),
                  nextActionBlocker: null,
                }
              : message.category === "completion"
                ? {
                    status: "converted" as const,
                    nextAction: "Oppdrag fullført og dokumentert.",
                    nextActionAt: null,
                  }
                : ["receipt", "contract", "change_confirmation"].includes(
                      message.category,
                    )
                  ? {}
                  : message.category === "information_request" ||
                      analysis.recommendedNextAction === "request_information"
                    ? {
                        status: "waiting_customer" as const,
                        nextAction: "Følg opp dersom kunden ikke svarer.",
                        nextActionAt: new Date(
                          Date.now() + 2 * 24 * 60 * 60_000,
                        ).toISOString(),
                      }
                    : analysis.recommendedNextAction === "start_measurement"
                      ? {
                          status: "qualified" as const,
                          nextAction: "Start kontrollert takmåling.",
                          nextActionAt: new Date().toISOString(),
                        }
                      : {
                          status: "contacted" as const,
                          nextAction:
                            "Kontroller henvendelsen og velg neste steg.",
                          nextActionAt: new Date().toISOString(),
                        };
    const nextActionOwner =
      replyContext?.purpose === "decline"
        ? ("customer" as const)
        : message.category === "completion"
          ? ("system" as const)
          : ("administrator" as const);
    await updateCaseState(payload, {
      leadId: lead.id,
      command: "message_delivered",
      idempotencyKey: `message-delivered:${message.id}:${result.providerMessageId}`,
      patch: {
        lastContactAt: result.acceptedAt,
        ...followUp,
        ...(isCustomerQuestionReply ? {} : { nextActionOwner }),
      },
    });
    return { duplicate: false as const, message: updated };
  } catch (error) {
    const sanitized = sanitizeJobError(error);
    await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: {
        status: "queued",
        failureCode: sanitized.code,
        failureMessage: sanitized.message,
      },
    });
    throw error;
  }
}
