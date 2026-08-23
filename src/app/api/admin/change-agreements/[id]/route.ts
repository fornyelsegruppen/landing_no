import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { changeDocumentHash } from "@/lib/change-agreements/document";
import { issueChangeAgreement } from "@/lib/change-agreements/engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";

const schema = z.object({ action: z.enum(["approve", "issue", "revoke"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const payload = await getPayload(); const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params; if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid agreement" }, { status: 400 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  try {
    const agreement = await payload.findByID({ collection: "change-agreements", id: Number(id), depth: 0, overrideAccess: true }); let result: Record<string, unknown> = {};
    if (parsed.data.action === "approve") {
      if (agreement.status !== "draft" || changeDocumentHash(agreement.snapshot) !== agreement.documentHash) throw new Error("Only an unchanged draft can be approved");
      await payload.update({ collection: "change-agreements", id: agreement.id, overrideAccess: true, context: { trustedChangeApproval: true }, data: { status: "approved", approvedBy: user.id, approvedAt: new Date().toISOString() } });
    } else if (parsed.data.action === "issue") {
      const origin = process.env.PUBLIC_SITE_URL || new URL(request.url).origin;
      const issued = await issueChangeAgreement(payload, agreement.id, origin, correlationIdFromHeaders(request.headers), Number(user.id)); result = { messageId: issued.message.id, previewUrl: issued.url };
    } else {
      if (!["draft", "approved", "sent", "viewed"].includes(agreement.status)) throw new Error("This agreement cannot be revoked");
      await payload.update({ collection: "change-agreements", id: agreement.id, overrideAccess: true, data: { status: "revoked" } });
      await payload.update({ collection: "access-tokens", overrideAccess: true, where: { and: [{ subjectType: { equals: "change-agreement" } }, { subjectId: { equals: String(agreement.id) } }, { revokedAt: { exists: false } }] }, data: { revokedAt: new Date().toISOString() } });
      const messages = await payload.find({ collection: "messages", depth: 0, limit: 10, overrideAccess: true, where: { idempotencyKey: { equals: `change-agreement:${agreement.id}:v${agreement.version}` } } });
      for (const message of messages.docs) {
        if (["draft", "approved", "queued", "attention"].includes(message.status)) await payload.update({ collection: "messages", id: message.id, overrideAccess: true, data: { status: "cancelled" } });
        const jobKey = makeIdempotencyKey("message.delivery", { messageId: message.id });
        const jobs = await payload.find({ collection: "operational-jobs", depth: 0, limit: 5, overrideAccess: true, where: { idempotencyKey: { equals: jobKey } } });
        for (const job of jobs.docs) if (["pending", "retry", "attention"].includes(job.status)) await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "cancelled", completedAt: new Date().toISOString() } });
      }
    }
    await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: `change-agreement.${parsed.data.action}`, entityType: "change-agreement", entityId: agreement.id, correlationId: correlationIdFromHeaders(request.headers), changedFields: ["status"] });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Change agreement action failed" }, { status: 409 }); }
}
