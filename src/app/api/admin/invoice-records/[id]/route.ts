import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({
  status: z.enum(["draft", "approved", "exported", "sent", "paid", "overdue", "cancelled"]),
  externalReference: z.string().trim().max(160).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid invoice record" }, { status: 400 });
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid invoice record" }, { status: 400 });
  try {
    const current = await payload.findByID({ collection: "invoice-records", id: Number(id), depth: 0, overrideAccess: true });
    const updated = await payload.update({ collection: "invoice-records", id: current.id, depth: 0, overrideAccess: true, data: { status: parsed.data.status, externalReference: parsed.data.externalReference || null, adminNote: parsed.data.adminNote || null } });
    await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: "invoice-record.status-updated", entityType: "invoice-record", entityId: updated.id, correlationId: correlationIdFromHeaders(request.headers), changedFields: ["status", "externalReference", "adminNote"], before: { status: current.status }, after: { status: updated.status } });
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice update failed" }, { status: 409 });
  }
}
