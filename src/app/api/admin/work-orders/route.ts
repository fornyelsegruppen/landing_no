import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { norwayLocalDateTimeToIso } from "@/lib/norway-time";
import { createWorkOrderFromContract } from "@/lib/work-orders/create";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({
  adminNote: z.string().trim().max(1000).optional(),
  arrivalWindow: z.string().trim().max(120).optional(),
  assignedWorkerId: z.number().int().positive().optional(),
  contractId: z.number().int().positive(),
  scheduledLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional(),
}).refine((value) => !value.scheduledLocal || value.assignedWorkerId, {
  message: "An employee is required before scheduling",
});

export async function POST(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid work order" }, { status: 400 });
  try {
    const scheduledAt = parsed.data.scheduledLocal ? norwayLocalDateTimeToIso(parsed.data.scheduledLocal) : undefined;
    const result = await createWorkOrderFromContract(payload, {
      adminNote: parsed.data.adminNote,
      arrivalWindow: parsed.data.arrivalWindow,
      assignedWorkerId: parsed.data.assignedWorkerId,
      contractId: parsed.data.contractId,
      scheduledAt,
    });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: result.created ? "work-order.created" : "work-order.reused",
      entityType: "work-order",
      entityId: result.workOrder.id,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: result.created ? ["contract", "quote", "lead", "assignedWorker", "scheduledAt", "arrivalWindow", "adminNote", "status"] : [],
    });
    return NextResponse.json({ workOrderId: result.workOrder.id, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work-order creation failed" }, { status: 409 });
  }
}
