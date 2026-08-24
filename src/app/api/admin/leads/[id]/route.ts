import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { createLeadAiReply, deliverMessage, enqueueMessageJob } from "@/lib/messages/message-engine";
import { assertMessageCanQueue } from "@/lib/messages/message-policy";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { userIsAdmin } from "@/payload/access/roles";
import { approveAndSendPreparedLeadPackage, prepareAutomaticLeadPackage } from "@/lib/leads/automatic-package";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate_reply") }),
  z.object({ action: z.literal("prepare_package") }),
  z.object({ action: z.literal("approve_package") }),
  z.object({ action: z.literal("approve_send"), messageId: z.number().int().positive() }),
  z.object({ action: z.literal("retry_send"), messageId: z.number().int().positive() }),
  z.object({ action: z.literal("request_information") }),
  z.object({ action: z.literal("start_measurement") }),
  z.object({ action: z.literal("close") }),
]);

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
    let result: Record<string, unknown> = {};

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
    } else if (parsed.data.action === "start_measurement") {
      await payload.update({ collection: "leads", id: leadId, overrideAccess: true, data: { status: "measuring", nextAction: "Start kontrollert takmåling.", nextActionAt: new Date().toISOString() } });
      result = { status: "measuring" };
    } else {
      await payload.update({ collection: "leads", id: leadId, overrideAccess: true, data: { status: "closed", nextAction: null, nextActionAt: null, closedAt: new Date().toISOString() } });
      result = { status: "closed" };
    }

    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: `lead.${parsed.data.action}`,
      entityType: "lead",
      entityId: leadId,
      correlationId,
      changedFields: ["approve_send", "retry_send"].includes(parsed.data.action) ? ["message.status", "message.approvedAt"] : ["status", "nextAction"],
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    captureException(error, { route: "POST /api/admin/leads/[id]", correlationId });
    return NextResponse.json({ error: error instanceof TypeError ? error.message : "Lead action failed", correlationId }, { status: error instanceof TypeError ? 409 : 500 });
  }
}
