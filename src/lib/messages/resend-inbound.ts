import type { Payload } from "payload";
import { updateCaseState } from "@/lib/cases/case-command";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { bareEmail, leadIdFromCaseReply } from "./case-reply";

type InboundEvent = { email_id: string; from: string; to: string[]; subject?: string; created_at?: string };
type InboundContent = { text?: string | null; html?: string | null };

class ResendInboundStageError extends Error {
  constructor(stage: "lead" | "deduplication" | "content" | "message" | "case-state", cause: unknown) {
    super(`Resend inbound processing failed at ${stage}`, { cause });
    this.name = `ResendInbound${stage.replace("-", "_")}Error`;
  }
}

async function atStage<T>(
  stage: "lead" | "deduplication" | "content" | "message" | "case-state",
  operation: () => Promise<T>,
) {
  try {
    return await operation();
  } catch (error) {
    throw new ResendInboundStageError(stage, error);
  }
}

export async function applyResendInboundEmail(
  payload: Payload,
  event: InboundEvent,
  retrieve: (emailId: string) => Promise<InboundContent>,
  correlationId: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const leadId = leadIdFromCaseReply(event.to, environment);
  if (!leadId) return { matched: false as const, reason: "unsigned-recipient" };
  const lead = await atStage("lead", () => payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true })).catch(() => null);
  if (!lead || !lead.email || bareEmail(event.from) !== bareEmail(lead.email)) return { matched: false as const, reason: "sender-mismatch" };
  const idempotencyKey = makeIdempotencyKey("resend.inbound", { emailId: event.email_id });
  const existing = await atStage("deduplication", () => payload.find({ collection: "messages", depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: idempotencyKey } } }));
  if (existing.docs[0]) return { matched: true as const, duplicate: true as const, messageId: existing.docs[0].id };
  const content = await atStage("content", () => retrieve(event.email_id));
  const body = (content.text || content.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") || "").trim().slice(0, 20_000);
  if (!body) throw new ResendInboundStageError("content", new Error("Inbound email contains no readable text"));
  const receivedAt = event.created_at || new Date().toISOString();
  const message = await atStage("message", () => payload.create({ collection: "messages", overrideAccess: true, data: {
    lead: lead.id, direction: "inbound", category: "customer_question", channel: "email",
    subject: (event.subject || "Svar fra kunde").slice(0, 500), bodyText: body, status: "delivered", deliveredAt: receivedAt,
    idempotencyKey, aiAssisted: false, provider: "resend", providerMessageId: event.email_id,
    aiAnalysis: { inbound: true, correlationId },
  } }));
  await atStage("case-state", () => updateCaseState(payload, { leadId: lead.id, command: "inbound_email_received", idempotencyKey, patch: {
    status: "draft_ready", nextActionOwner: "administrator", nextAction: "Kontroller kundens e-postsvar og godkjenn et svar.", nextActionAt: new Date().toISOString(), lastContactAt: receivedAt,
  } }));
  return { matched: true as const, duplicate: false as const, messageId: message.id, leadId: lead.id };
}
