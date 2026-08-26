import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { norwayLocalDateTimeToIso } from "@/lib/norway-time";
import { createWorkOrderFromContract } from "@/lib/work-orders/create";
import { userIsAdmin } from "@/payload/access/roles";
import { validateArrivalWindowForSchedule } from "@/lib/work-orders/scheduling";
import { dispatchWorkOrderCommunicationNow, notifyAssignedWorkerNow, syncWorkOrderCommunicationJobs } from "@/lib/work-orders/communications";
import { captureException } from "@/lib/monitoring";
import { assertExpectedDocumentHash, assertWorkOrderContractTarget } from "@/lib/admin-v2/commercial-action-guard";

const schema = z.object({
  adminNote: z.string().trim().max(1000).optional(),
  arrivalWindow: z.string().trim().max(120).optional(),
  assignedWorkerId: z.number().int().positive().optional(),
  contractId: z.number().int().positive(),
  expectedDocumentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  expectedVersion: z.number().int().positive().optional(),
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
    const contract = await payload.findByID({ collection: "contracts", id: parsed.data.contractId, depth: 0, overrideAccess: true });
    const quoteId = typeof contract.quote === "number" ? contract.quote : contract.quote?.id;
    if (!quoteId) return NextResponse.json({ error: "Contract quote is missing" }, { status: 409 });
    const quote = await payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true });
    const leadId = typeof quote.lead === "number" ? quote.lead : quote.lead?.id;
    if (!leadId) return NextResponse.json({ error: "Contract customer case is missing" }, { status: 409 });
    await assertWorkOrderContractTarget(payload, { leadId, contractId: parsed.data.contractId, expectedVersion: parsed.data.expectedVersion });
    assertExpectedDocumentHash({
      expectedDocumentHash: parsed.data.expectedDocumentHash,
      currentDocumentHash: typeof contract.documentHash === "string" ? contract.documentHash : undefined,
      currentReference: contract.reference,
    });
    const scheduledAt = parsed.data.scheduledLocal ? norwayLocalDateTimeToIso(parsed.data.scheduledLocal) : undefined;
    const arrivalWindow = validateArrivalWindowForSchedule(parsed.data.scheduledLocal, parsed.data.arrivalWindow);
    if (parsed.data.assignedWorkerId && (!scheduledAt || !arrivalWindow)) {
      return NextResponse.json({ error: "Employee, work date and complete arrival window are required" }, { status: 400 });
    }
    const result = await createWorkOrderFromContract(payload, {
      adminNote: parsed.data.adminNote,
      arrivalWindow: arrivalWindow || undefined,
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
    let notification: "sent" | "queued" | "skipped" = "skipped";
    if (result.workOrder.status === "scheduled") {
      try {
        await syncWorkOrderCommunicationJobs(payload, result.workOrder, correlationIdFromHeaders(request.headers));
        const dispatched = await dispatchWorkOrderCommunicationNow(payload, result.workOrder, "schedule_confirmation", correlationIdFromHeaders(request.headers));
        notification = dispatched.delivered ? "sent" : dispatched.queued ? "queued" : "skipped";
        await notifyAssignedWorkerNow(payload, result.workOrder, correlationIdFromHeaders(request.headers));
      } catch (error) {
        notification = "queued";
        captureException(error, { route: "POST /api/admin/work-orders", operation: "schedule-notification", workOrderId: result.workOrder.id });
      }
    }
    return NextResponse.json({ workOrderId: result.workOrder.id, created: result.created, notification }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work-order creation failed" }, { status: 409 });
  }
}
