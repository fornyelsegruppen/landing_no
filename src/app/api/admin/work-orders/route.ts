import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { createWorkOrderFromContract } from "@/lib/work-orders/create";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({ contractId: z.number().int().positive() });

export async function POST(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid contract" }, { status: 400 });
  try {
    const result = await createWorkOrderFromContract(payload, { contractId: parsed.data.contractId });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: result.created ? "work-order.created" : "work-order.reused",
      entityType: "work-order",
      entityId: result.workOrder.id,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: result.created ? ["contract", "quote", "lead", "status"] : [],
    });
    return NextResponse.json({ workOrderId: result.workOrder.id, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work-order creation failed" }, { status: 409 });
  }
}
