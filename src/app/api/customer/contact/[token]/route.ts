import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import {
  normalizeCommunicationEmail,
  resolveManualContactRecoveryToken,
  withManualRecoveryState,
} from "@/lib/manual-contact/recovery";
import {
  deliverMessage,
  enqueueMessageJob,
} from "@/lib/messages/message-engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashOpaqueToken } from "@/lib/security/opaque-token";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";

const schema = z.object({
  email: z.string().trim().pipe(z.email().max(320)),
  emailConfirmation: z.string().trim().pipe(z.email().max(320)),
});

function relationIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "number") return item;
      if (
        item &&
        typeof item === "object" &&
        "id" in item &&
        typeof (item as { id?: unknown }).id === "number"
      ) {
        return (item as { id: number }).id;
      }
      return null;
    })
    .filter((item): item is number => typeof item === "number");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenKey = hashOpaqueToken("manual-contact-recovery", token).slice(
    0,
    24,
  );
  const limited = await rateLimit(
    "manual-contact-email",
    `${tokenKey}:${clientIp(request)}`,
    { limit: 5, windowSec: 15 * 60 },
  );
  if (!limited.success) {
    return NextResponse.json(
      { error: "For mange forsøk. Vent litt og prøv igjen." },
      { status: 429 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Skriv inn en gyldig e-postadresse i begge feltene." },
      { status: 400 },
    );
  }
  const email = normalizeCommunicationEmail(parsed.data.email);
  if (email !== normalizeCommunicationEmail(parsed.data.emailConfirmation)) {
    return NextResponse.json(
      { error: "E-postadressene er ikke like." },
      { status: 400 },
    );
  }

  const payload = await getPayload();
  const recovery = await resolveManualContactRecoveryToken(payload, token);
  if (!recovery || recovery.lead.recordState !== "active") {
    return NextResponse.json(
      { error: "Lenken er utløpt eller er allerede brukt." },
      { status: 404 },
    );
  }
  const now = new Date().toISOString();
  const correlationId = correlationIdFromHeaders(request.headers);
  const source = recovery.sourceMessage;
  const resendKey = makeIdempotencyKey("manual-contact.recovery-resend", {
    accessRecordId: recovery.record.id,
    sourceMessageId: source.id,
  });

  await payload.update({
    collection: "leads",
    id: recovery.lead.id,
    overrideAccess: true,
    data: {
      communicationEmail: email,
      communicationEmailUpdatedAt: now,
      communicationEmailSourceMessage: source.id,
      preferredChannel: "email",
    },
  });

  const existing = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { idempotencyKey: { equals: resendKey } },
  });
  const sourceAnalysis =
    source.aiAnalysis && typeof source.aiAnalysis === "object"
      ? (source.aiAnalysis as Record<string, unknown>)
      : {};
  const resendAnalysis = { ...sourceAnalysis };
  delete resendAnalysis.manualRecovery;
  const resend =
    existing.docs[0] ||
    (await payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: recovery.lead.id,
        replyToMessage: source.id,
        direction: "outbound",
        category: source.category,
        channel: "email",
        subject: source.subject,
        bodyText: source.bodyText,
        bodyHtml: source.bodyHtml || null,
        attachments: relationIds(source.attachments),
        status: "queued",
        idempotencyKey: resendKey,
        aiAssisted: Boolean(source.aiAssisted),
        aiAnalysis: {
          ...resendAnalysis,
          adminApprovedTransactional: true,
          manualRecoveryResend: true,
          sourceMessageId: source.id,
        },
        modelVersion: source.modelVersion || null,
        promptVersion: source.promptVersion || null,
        approvedAt: now,
        queuedAt: now,
      },
    }));

  let delivery: "sent" | "queued" = "sent";
  try {
    await deliverMessage(
      payload,
      createEmailProvider(),
      resend.id,
      correlationId,
    );
  } catch {
    delivery = "queued";
    await enqueueMessageJob(payload, resend.id, correlationId);
  }

  await payload.update({
    collection: "messages",
    id: source.id,
    overrideAccess: true,
    data: {
      status: delivery === "sent" ? "sent" : "attention",
      failureCode: delivery === "sent" ? null : "MANUAL_RECOVERY_RETRY_QUEUED",
      failureMessage:
        delivery === "sent"
          ? null
          : "Kunden har oppgitt ny e-postadresse. Den valgte meldingen venter på nytt leveringsforsøk.",
      aiAnalysis: withManualRecoveryState(source.aiAnalysis, {
        status: delivery === "sent" ? "resent" : "retry_queued",
        communicationEmailUpdatedAt: now,
        recoveryMessageId: resend.id,
        resentAt: now,
      }),
    },
  });
  await payload.update({
    collection: "access-tokens",
    id: recovery.record.id,
    overrideAccess: true,
    data: { usedAt: now },
  });
  await recordAuditEvent(createPayloadAuditWriter(payload), {
    action: "lead.communication-email-updated",
    entityType: "lead",
    entityId: recovery.lead.id,
    correlationId,
    changedFields: [
      "communicationEmail",
      "communicationEmailSourceMessage",
      "communicationEmailUpdatedAt",
      "preferredChannel",
    ],
    before: { communicationEmail: recovery.lead.communicationEmail || null },
    after: { communicationEmail: email },
    metadata: {
      recoveryMessageId: resend.id,
      sourceMessageId: source.id,
    },
  });
  return NextResponse.json({ ok: true, delivery });
}
