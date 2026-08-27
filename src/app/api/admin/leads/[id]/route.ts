import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { createCustomerReplyDraft, createLeadAiReply, deliverMessage, enqueueMessageJob } from "@/lib/messages/message-engine";
import { assertMessageCanQueue } from "@/lib/messages/message-policy";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { userIsAdmin } from "@/payload/access/roles";
import { approveAndSendPreparedLeadPackage, prepareAutomaticLeadPackage } from "@/lib/leads/automatic-package";
import { CaseCommandConflictError, updateCaseState } from "@/lib/cases/case-command";
import { assertPayloadAiUsageAvailable } from "@/lib/ai/payload-usage-limit";
import { customerReplyContextFromAnalysis } from "@/lib/messages/customer-reply";
import { markLeadReviewed } from "@/lib/admin-v2/mark-lead-reviewed";

export const maxDuration = 60;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate_reply") }),
  z.object({ action: z.literal("prepare_package") }),
  z.object({ action: z.literal("approve_package") }),
  z.object({ action: z.literal("approve_send"), messageId: z.number().int().positive() }),
  z.object({ action: z.literal("cancel_draft"), messageId: z.number().int().positive() }),
  z.object({ action: z.literal("retry_send"), messageId: z.number().int().positive() }),
  z.object({ action: z.literal("save_draft"), messageId: z.number().int().positive(), subject: z.string().trim().min(5).max(160), bodyText: z.string().trim().min(20).max(3_000) }),
  z.object({ action: z.literal("regenerate_reply"), messageId: z.number().int().positive() }),
  z.object({ action: z.literal("resolve_cancellation"), decision: z.enum(["cancel", "continue"]), reason: z.string().trim().min(10).max(1_000) }),
  z.object({ action: z.literal("request_information") }),
  z.object({ action: z.literal("start_measurement") }),
  z.object({ action: z.literal("mark_reviewed") }),
  z.object({ action: z.literal("update_intake"), expectedRevision: z.number().int().positive(), address: z.string().trim().min(2).max(200), postal: z.string().regex(/^\d{4}$/), city: z.string().trim().max(100).optional(), inquiryType: z.enum(["takvask", "takvask_impregnering", "impregnering", "takmaling", "nytt_tak", "usikker"]) }),
  z.object({ action: z.literal("close") }),
]).and(z.object({ expectedRevision: z.number().int().positive().optional() }));

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

async function auth(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!userIsAdmin(user)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { payload, user };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await auth(request);
  if ("response" in authorization) return authorization.response;
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid lead" }, { status: 400 });
  const messages = await authorization.payload.find({
    collection: "messages",
    depth: 0,
    limit: 100,
    sort: "createdAt",
    overrideAccess: true,
    where: { lead: { equals: Number(id) } },
  });
  return NextResponse.json({ messages: messages.docs.map((message) => ({
    id: message.id,
    category: message.category,
    channel: message.channel,
    subject: message.subject,
    bodyText: message.bodyText,
    status: message.status,
    aiAssisted: message.aiAssisted,
    createdAt: message.createdAt,
    sentAt: message.sentAt,
    failureMessage: message.failureMessage,
  })) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const authorization = await auth(request);
    if ("response" in authorization) return authorization.response;
    const { payload, user } = authorization;
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid lead" }, { status: 400 });
    const leadId = Number(id);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
    const currentRevision = typeof lead.caseRevision === "number" ? lead.caseRevision : 1;
    if (parsed.data.expectedRevision !== undefined && parsed.data.expectedRevision !== currentRevision) {
      return NextResponse.json({
        error: "Case was changed by another administrator. Refresh before continuing.",
        code: "CASE_REVISION_CONFLICT",
        expected: parsed.data.expectedRevision,
        actual: currentRevision,
      }, { status: 409 });
    }
    let result: Record<string, unknown> = {};
    let recordGenericAudit = true;

    if (parsed.data.action === "generate_reply") {
      assertFeatureReady("aiDrafts");
      const generated = await createLeadAiReply(payload, new GeminiAiProvider(), leadId, correlationId);
      result = { messageId: generated.message.id, duplicate: generated.duplicate };
    } else if (parsed.data.action === "prepare_package") {
      assertFeatureReady("roofMeasurement");
      assertFeatureReady("customerQuotes");
      result = await prepareAutomaticLeadPackage(payload, leadId);
    } else if (parsed.data.action === "approve_package") {
      assertFeatureReady("customerQuotes");
      assertFeatureReady("contractSigning");
      result = await approveAndSendPreparedLeadPackage(payload, leadId, user.id, correlationId);
    } else if (parsed.data.action === "save_draft") {
      const message = await payload.findByID({ collection: "messages", id: parsed.data.messageId, depth: 0, overrideAccess: true });
      if (relationId(message.lead) !== leadId || message.status !== "draft") throw new TypeError("Only a draft in this customer case can be edited");
      assertMessageCanQueue({ ...message, subject: parsed.data.subject, bodyText: parsed.data.bodyText, status: "draft" });
      const updated = await payload.update({ collection: "messages", id: message.id, overrideAccess: true, data: { subject: parsed.data.subject, bodyText: parsed.data.bodyText, bodyHtml: null } });
      result = { messageId: updated.id, saved: true };
    } else if (parsed.data.action === "regenerate_reply") {
      assertFeatureReady("aiDrafts");
      const message = await payload.findByID({ collection: "messages", id: parsed.data.messageId, depth: 0, overrideAccess: true });
      if (relationId(message.lead) !== leadId || message.status !== "draft" || message.category !== "ai_reply") throw new TypeError("Only an active AI reply draft can be regenerated");
      const sourceMessageId = relationId(message.replyToMessage);
      const factContext = customerReplyContextFromAnalysis(message.aiAnalysis);
      if (!sourceMessageId || !factContext) throw new TypeError("The reply draft has no verified source message context");
      await assertPayloadAiUsageAvailable(payload);
      const regenerated = await createCustomerReplyDraft(payload, new GeminiAiProvider(), {
        correlationId,
        generationKey: `regenerate-${message.id}-${Date.now()}`,
        leadId,
        purpose: factContext.purpose,
        sourceMessageId,
      });
      await payload.update({ collection: "messages", id: message.id, overrideAccess: true, data: { status: "cancelled" } });
      result = { messageId: regenerated.message.id, regenerated: true };
    } else if (parsed.data.action === "cancel_draft") {
      const message = await payload.findByID({ collection: "messages", id: parsed.data.messageId, depth: 0, overrideAccess: true });
      if (relationId(message.lead) !== leadId || message.status !== "draft") {
        throw new TypeError("Only a draft in this customer case can be cancelled");
      }
      const cancelled = await payload.update({
        collection: "messages",
        id: message.id,
        overrideAccess: true,
        data: { status: "cancelled" },
      });
      result = { messageId: cancelled.id, cancelled: true };
    } else if (parsed.data.action === "approve_send" || parsed.data.action === "retry_send") {
      const message = await payload.findByID({ collection: "messages", id: parsed.data.messageId, depth: 0, overrideAccess: true });
      if (relationId(message.lead) !== leadId) return NextResponse.json({ error: "Message does not belong to lead" }, { status: 409 });
      if (parsed.data.action === "approve_send") {
        assertMessageCanQueue(message);
      } else if (!message.approvedAt || !["attention", "failed", "queued"].includes(message.status)) {
        throw new TypeError("Only an approved failed or queued message can be retried");
      }
      const now = new Date().toISOString();
      const queued = await payload.update({
        collection: "messages",
        id: message.id,
        overrideAccess: true,
        data: {
          status: "queued",
          approvedBy: parsed.data.action === "approve_send" ? user.id : message.approvedBy,
          approvedAt: parsed.data.action === "approve_send" ? now : message.approvedAt,
          queuedAt: now,
        },
      });
      await enqueueMessageJob(payload, queued.id, correlationId);
      const provider = createEmailProvider();
      if (provider.health().status === "ready") {
        try {
          await deliverMessage(payload, provider, queued.id, correlationId);
          result = { messageId: queued.id, sent: true };
        } catch (error) {
          captureException(error, { route: "POST /api/admin/leads/[id]", operation: "inline-delivery", correlationId });
          result = { messageId: queued.id, sent: false, queued: true };
        }
      } else {
        result = { messageId: queued.id, sent: false, configurationRequired: true };
      }
    } else if (parsed.data.action === "resolve_cancellation") {
      if (lead.nextActionBlocker !== "CUSTOMER_CANCELLATION_REQUEST") throw new TypeError("This case has no pending cancellation request");
      const now = new Date().toISOString();
      const workOrders = await payload.find({ collection: "work-orders", depth: 1, limit: 1, sort: "-createdAt", overrideAccess: true, where: { lead: { equals: leadId } } });
      const workOrder = workOrders.docs[0];
      if (workOrder && workOrder.status === "blocked" && Array.isArray(workOrder.blockingReasons) && workOrder.blockingReasons.includes("CUSTOMER_CANCELLATION_REQUEST")) {
        const previousStatus = workOrder.statusBeforeCustomerCancellation;
        const restored: "unassigned" | "assigned" | "scheduled" | "on_way" = previousStatus && ["unassigned", "assigned", "scheduled", "on_way"].includes(previousStatus)
          ? previousStatus as "unassigned" | "assigned" | "scheduled" | "on_way"
          : "unassigned";
        await payload.update({ collection: "work-orders", id: workOrder.id, overrideAccess: true, data: {
          status: parsed.data.decision === "cancel" ? "cancelled" : restored,
          blockingReasons: workOrder.blockingReasons.filter((item) => item !== "CUSTOMER_CANCELLATION_REQUEST"),
          customerCancellationResolvedAt: now,
          customerCancellationResolution: `${parsed.data.decision}: ${parsed.data.reason}`,
        } });
      }
      let sourceMessageId = workOrder ? relationId(workOrder.cancellationRequestMessage) : null;
      if (!sourceMessageId) {
        const cancellationMessages = await payload.find({ collection: "messages", depth: 0, limit: 1, sort: "-createdAt", overrideAccess: true, where: { and: [
          { lead: { equals: leadId } },
          { direction: { equals: "inbound" } },
          { subject: { contains: "kansellering" } },
        ] } });
        sourceMessageId = cancellationMessages.docs[0]?.id || null;
      }
      const confirmation = await payload.create({ collection: "messages", overrideAccess: true, data: {
        lead: leadId,
        ...(sourceMessageId ? { replyToMessage: sourceMessageId } : {}),
        direction: "outbound",
        category: "follow_up",
        channel: lead.email ? "email" : "sms",
        subject: parsed.data.decision === "cancel" ? "Avklaring av kanselleringsforespørselen" : "Avklaring – avtalen fortsetter",
        bodyText: parsed.data.decision === "cancel"
          ? `Hei ${lead.name},\n\nTakfornyelse har vurdert forespørselen din. Vi bekrefter at bestillingen avsluttes i tråd med administrators skriftlige vurdering.\n\nBegrunnelse: ${parsed.data.reason}\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`
          : `Hei ${lead.name},\n\nTakfornyelse har vurdert forespørselen din. Etter avklaring fortsetter avtalen og videre planlegging.\n\nAvklaring: ${parsed.data.reason}\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`,
        status: "draft",
        idempotencyKey: makeIdempotencyKey("cancellation.resolution", { decision: parsed.data.decision, leadId, revision: lead.caseRevision }),
        aiAssisted: false,
        aiAnalysis: { cancellationDecision: parsed.data.decision, administratorReason: parsed.data.reason, sourceMessageId },
      } });
      await updateCaseState(payload, { leadId, actorId: user.id, command: "resolve_cancellation", idempotencyKey: `${correlationId}:resolve-cancellation`, patch: parsed.data.decision === "cancel" ? {
        status: "closed", nextActionOwner: "administrator", nextActionBlocker: null, nextAction: "Kontroller og send kanselleringsbekreftelsen. Arkiver deretter saken med korrekt klassifisering.", nextActionAt: now, closedAt: now,
      } : {
        status: "converted", nextActionOwner: "administrator", nextActionBlocker: null, nextAction: workOrder ? "Kontroller gjenopptatt arbeidsplan og informer kunden." : "Opprett arbeid når begge parter har signert.", nextActionAt: now, closedAt: null,
      } });
      result = { decision: parsed.data.decision, messageId: confirmation.id };
    } else if (parsed.data.action === "request_information") {
      const key = makeIdempotencyKey("lead.information-request", { leadId, minute: new Date().toISOString().slice(0, 16) });
      const missingNo = [
        !lead.address || lead.address === "Ikke oppgitt" ? "nøyaktig adresse til boligen" : null,
        !lead.approxSqm ? "omtrentlig takareal dersom du kjenner det" : null,
        !lead.photoUrls?.trim() ? "oversiktsbilder av taket tatt trygt fra bakken" : null,
      ].filter(Boolean);
      const english = lead.language === "en";
      const missing = missingNo.length ? missingNo.join(", ") : "en kort beskrivelse av takets tilstand og hva du ønsker hjelp med";
      const message = await payload.create({
        collection: "messages",
        overrideAccess: true,
        data: {
          lead: leadId,
          direction: "outbound",
          category: "information_request",
          channel: lead.email ? "email" : "sms",
          subject: english ? "We need a little more information" : "Vi trenger noen flere opplysninger",
          bodyText: english
            ? "Thank you for your enquiry. To assess the right next step, please send us the property address, an approximate roof area if known, and overview photos taken safely from the ground. We will review the information before making a recommendation."
            : `Takk for henvendelsen. For å kunne vurdere riktig neste steg trenger vi ${missing}. Send dette når det passer, så går vi gjennom opplysningene før vi gir en anbefaling.`,
          status: "draft",
          idempotencyKey: key,
          aiAssisted: false,
        },
      });
      result = { messageId: message.id };
    } else if (parsed.data.action === "update_intake") {
      const updated = await updateCaseState(payload, { leadId, actorId: user.id, expectedRevision: parsed.data.expectedRevision, command: "update_intake", idempotencyKey: `${correlationId}:update-intake`, patch: { address: parsed.data.address, postal: parsed.data.postal, city: parsed.data.city || null, inquiryType: parsed.data.inquiryType, nextAction: "Finn og kontroller riktig bygning.", nextActionOwner: "administrator", nextActionAt: new Date().toISOString() } });
      const updatedLead = "lead" in updated ? updated.lead : updated;
      result = { updated: true, lead: { id: updatedLead.id, address: updatedLead.address, postal: updatedLead.postal, city: updatedLead.city, inquiryType: updatedLead.inquiryType } };
    } else if (parsed.data.action === "mark_reviewed") {
      result = await markLeadReviewed(payload, {
        actorId: Number(user.id),
        lead,
        leadId,
      });
      recordGenericAudit = false;
    } else if (parsed.data.action === "start_measurement") {
      await updateCaseState(payload, { leadId, actorId: user.id, command: "start_measurement", idempotencyKey: `${correlationId}:start-measurement`, patch: { status: "measuring", nextActionOwner: "administrator", nextAction: "Start kontrollert takmåling.", nextActionAt: new Date().toISOString() } });
      result = { status: "measuring" };
    } else {
      await updateCaseState(payload, { leadId, actorId: user.id, command: "close", idempotencyKey: `${correlationId}:close`, patch: { status: "closed", nextActionOwner: "administrator", nextAction: null, nextActionAt: null, closedAt: new Date().toISOString() } });
      result = { status: "closed" };
    }

    if (recordGenericAudit) await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: `lead.${parsed.data.action}`,
      entityType: "lead",
      entityId: leadId,
      correlationId,
      changedFields: ["approve_send", "cancel_draft", "retry_send", "save_draft", "regenerate_reply"].includes(parsed.data.action)
        ? ["message.status", "message.approvedAt"]
        : parsed.data.action === "resolve_cancellation"
          ? ["nextActionBlocker", "workOrder.status", "message.status"]
        : parsed.data.action === "update_intake"
          ? ["address", "postal", "city", "inquiryType"]
          : parsed.data.action === "mark_reviewed"
            ? ["adminReviewedAt", "adminReviewedBy"]
          : ["status", "nextAction"],
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    if (error instanceof CaseCommandConflictError) return NextResponse.json({ error: "Case was changed by another administrator. Refresh before saving.", code: "CASE_REVISION_CONFLICT", expected: error.expected, actual: error.actual }, { status: 409 });
    captureException(error, { route: "POST /api/admin/leads/[id]", correlationId });
    return NextResponse.json({ error: error instanceof TypeError ? error.message : "Lead action failed", correlationId }, { status: error instanceof TypeError ? 409 : 500 });
  }
}
