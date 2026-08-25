import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { archiveCase, archiveClassifications, assertCaseCanBePurged, purgeCase, restoreCase, trashCase } from "@/lib/leads/case-lifecycle";
import { captureException } from "@/lib/monitoring";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive"), classification: z.enum(archiveClassifications), reason: z.string().min(5).max(500) }),
  z.object({ action: z.literal("trash"), classification: z.enum(archiveClassifications).optional(), reason: z.string().min(5).max(500) }),
  z.object({ action: z.literal("restore"), reason: z.string().min(5).max(500) }),
  z.object({ action: z.literal("purge"), confirmation: z.string().max(30), reason: z.string().min(5).max(500) }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid case" }, { status: 400 });
    const leadId = Number(id);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid lifecycle action" }, { status: 400 });
    const before = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
    const common = { actorId: user.id, reason: parsed.data.reason, idempotencyKey: `${correlationId}:${parsed.data.action}` };
    let result: unknown;
    if (parsed.data.action === "archive") result = await archiveCase(payload, leadId, { ...common, classification: parsed.data.classification });
    else if (parsed.data.action === "trash") result = await trashCase(payload, leadId, { ...common, classification: parsed.data.classification });
    else if (parsed.data.action === "restore") result = await restoreCase(payload, leadId, common);
    else {
      if (parsed.data.confirmation.trim() !== id) throw new TypeError("Enter the exact case number to confirm permanent deletion");
      await assertCaseCanBePurged(payload, leadId);
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        action: "lead.purge_authorized",
        actorId: user.id,
        after: { deleted: true },
        before: { recordState: before.recordState, purgeAfter: before.purgeAfter },
        changedFields: ["deletedAt"],
        correlationId,
        entityId: leadId,
        entityType: "lead",
        metadata: { retentionConfirmed: true },
      });
      result = await purgeCase(payload, leadId, { confirmation: parsed.data.confirmation, reason: parsed.data.reason });
      return NextResponse.json({ ok: true, result });
    }
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      action: `lead.${parsed.data.action}`,
      actorId: user.id,
      after: result,
      before,
      changedFields: ["recordState", "archiveClassification", "archiveReason", "archivedAt", "trashedAt", "purgeAfter"],
      correlationId,
      entityId: leadId,
      entityType: "lead",
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    captureException(error, { route: "POST /api/admin/leads/[id]/lifecycle", correlationId });
    const expected = error instanceof TypeError;
    return NextResponse.json({ error: expected ? error.message : "Case lifecycle action failed", correlationId }, { status: expected ? 409 : 500 });
  }
}
