import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import {
  issueManualContactRecoveryToken,
  manualRecoveryState,
  withManualRecoveryState,
} from "@/lib/manual-contact/recovery";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare") }),
  z.object({
    action: z.literal("record"),
    channel: z.enum(["sms", "whatsapp", "phone", "other"]),
  }),
]);

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
  return undefined;
}

function firstName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().split(/\s+/)[0] || "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid manual-contact action" },
      { status: 400 },
    );
  }

  const message = await payload.findByID({
    collection: "messages",
    id: Number(id),
    depth: 0,
    overrideAccess: true,
  });
  const leadId = relationId(message.lead);
  if (
    !leadId ||
    message.direction !== "outbound" ||
    message.channel !== "email" ||
    ["draft", "cancelled"].includes(message.status)
  ) {
    return NextResponse.json(
      { error: "Only an active outbound email can use manual recovery" },
      { status: 409 },
    );
  }
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  const now = new Date().toISOString();
  const correlationId = correlationIdFromHeaders(request.headers);

  if (parsed.data.action === "prepare") {
    const access = await issueManualContactRecoveryToken(payload, message.id, {
      leadId,
      sourceMessageId: message.id,
    });
    const secureUrl = `${new URL(request.url).origin}/kontakt/${encodeURIComponent(access.token)}`;
    const greeting = firstName(lead.name);
    const manualText = `${greeting ? `Hei ${greeting}. ` : "Hei! "}Oppdater e-post og motta meldingen fra Takfornyelse her:\n${secureUrl}`;
    await payload.update({
      collection: "messages",
      id: message.id,
      overrideAccess: true,
      data: {
        status: "attention",
        failureCode: "MANUAL_CONTACT_RECOVERY",
        failureMessage:
          "Manuell kontaktgjenoppretting er startet. Vent på kundens kontaktadresse eller registrer utført kontakt.",
        aiAnalysis: withManualRecoveryState(message.aiAnalysis, {
          status: "prepared",
          originalStatus:
            manualRecoveryState(message.aiAnalysis).originalStatus ||
            message.status,
          preparedAt: now,
          preparedBy: Number(user.id),
          accessRecordId: access.record.id,
          expiresAt: access.record.expiresAt,
        }),
      },
    });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: Number(user.id),
      action: "message.manual-contact-prepared",
      entityType: "message",
      entityId: message.id,
      correlationId,
      changedFields: ["aiAnalysis", "failureCode", "failureMessage", "status"],
      metadata: { leadId, sourceMessageId: message.id },
    });
    return NextResponse.json({
      ok: true,
      manualText,
      secureUrl,
      expiresAt: access.record.expiresAt,
    });
  }

  const recovery = manualRecoveryState(message.aiAnalysis);
  if (!recovery.accessRecordId) {
    return NextResponse.json(
      { error: "Prepare the secure contact message first" },
      { status: 409 },
    );
  }
  await payload.update({
    collection: "messages",
    id: message.id,
    overrideAccess: true,
    data: {
      aiAnalysis: withManualRecoveryState(message.aiAnalysis, {
        status: "contacted",
        channel: parsed.data.channel,
        contactedAt: now,
        contactedBy: Number(user.id),
      }),
    },
  });
  await payload.update({
    collection: "leads",
    id: lead.id,
    overrideAccess: true,
    data: { lastContactAt: now },
  });
  await recordAuditEvent(createPayloadAuditWriter(payload), {
    actorId: Number(user.id),
    action: "message.manual-contact-recorded",
    entityType: "message",
    entityId: message.id,
    correlationId,
    changedFields: ["aiAnalysis", "lastContactAt"],
    metadata: {
      channel: parsed.data.channel,
      leadId,
      sourceMessageId: message.id,
    },
  });
  return NextResponse.json({
    ok: true,
    channel: parsed.data.channel,
    contactedAt: now,
  });
}
