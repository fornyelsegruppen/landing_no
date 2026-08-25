import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { finalizeWorkOrderReview } from "@/lib/work-orders/completion-review";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({
  confirmDocumentation: z.literal(true),
  confirmPrice: z.literal(true),
  invoiceDueDays: z.number().int().min(1).max(90),
  reviewNote: z.string().trim().min(10).max(2000),
  warrantyMonths: z.number().int().min(1).max(120),
  warrantyScope: z.string().trim().min(10).max(3000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid work order" }, { status: 400 });
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid completion review" }, { status: 400 });
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const result = await finalizeWorkOrderReview(payload, { workOrderId: Number(id), actorId: user.id, correlationId, ...parsed.data });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "work-order.completion-reviewed",
      entityType: "work-order",
      entityId: Number(id),
      correlationId,
      changedFields: ["status", "completionReviewedBy", "completionReviewedAt", "completionReviewNote"],
      metadata: { invoiceRecordId: result.invoice.id, warrantyId: result.warranty.id },
    });
    return NextResponse.json({ ok: true, status: result.workOrder.status, invoiceId: result.invoice.id, warrantyId: result.warranty.id, communicationDelivered: "delivered" in result.communication ? result.communication.delivered : false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Completion review failed", correlationId }, { status: 409 });
  }
}
