import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { norwayLocalDateTimeToIso } from "@/lib/norway-time";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";
import { validateArrivalWindowForSchedule } from "@/lib/work-orders/scheduling";
import { dispatchWorkOrderCommunicationNow, notifyAssignedWorkerNow, syncWorkOrderCommunicationJobs } from "@/lib/work-orders/communications";
import { captureException } from "@/lib/monitoring";
import { assertAssignableWorker } from "@/lib/work-orders/create";
import { appendTimeline } from "@/lib/work-orders/access";

const schema = z.object({
  action: z.enum(["save", "cancel"]).default("save"),
  adminNote: z.string().trim().max(1000).optional(),
  arrivalWindow: z.string().trim().max(120).optional(),
  assignedWorkerId: z.number().int().positive().optional(),
  planningReason: z.string().trim().max(500).optional(),
  scheduledLocal: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    z.literal(""),
  ]).optional(),
});

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid work order" }, { status: 400 });
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid work order" }, { status: 400 });

  try {
    const current = await payload.findByID({ collection: "work-orders", id: Number(id), depth: 0, overrideAccess: true });
    if (!["unassigned", "assigned", "scheduled"].includes(current.status) && parsed.data.action !== "cancel") {
      return NextResponse.json({ error: "Work that has started can no longer be reassigned here" }, { status: 409 });
    }
    if (parsed.data.action === "cancel") {
      const updated = await payload.update({ collection: "work-orders", id: current.id, depth: 0, overrideAccess: true, data: { status: "cancelled" } });
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "work-order.cancelled",
        entityType: "work-order",
        entityId: current.id,
        correlationId: correlationIdFromHeaders(request.headers),
        changedFields: ["status"],
        before: { status: current.status },
        after: { status: updated.status },
      });
      return NextResponse.json({ workOrderId: updated.id, status: updated.status });
    }

    const assignedWorkerId = parsed.data.assignedWorkerId ?? relationId(current.assignedWorker);
    if (assignedWorkerId) await assertAssignableWorker(payload, assignedWorkerId);
    const scheduledAt = parsed.data.scheduledLocal === undefined
      ? current.scheduledAt
      : parsed.data.scheduledLocal
        ? norwayLocalDateTimeToIso(parsed.data.scheduledLocal)
        : null;
    if (scheduledAt && !assignedWorkerId) return NextResponse.json({ error: "An employee is required before scheduling" }, { status: 400 });
    if (current.status === "scheduled" && !scheduledAt) return NextResponse.json({ error: "A scheduled work order must keep a date; choose a new date or cancel it" }, { status: 409 });
    const arrivalWindow = parsed.data.arrivalWindow === undefined
      ? current.arrivalWindow
      : validateArrivalWindowForSchedule(parsed.data.scheduledLocal || undefined, parsed.data.arrivalWindow || undefined);
    if (assignedWorkerId && (!scheduledAt || !arrivalWindow)) {
      return NextResponse.json({ error: "Employee, work date and complete arrival window are required" }, { status: 400 });
    }
    const planningChanged = relationId(current.assignedWorker) !== assignedWorkerId
      || (current.scheduledAt || null) !== (scheduledAt || null)
      || (current.arrivalWindow || null) !== (arrivalWindow || null);
    if (planningChanged && current.status !== "unassigned" && (parsed.data.planningReason || "").trim().length < 5) {
      return NextResponse.json({ error: "A reason is required when rescheduling or reassigning work" }, { status: 400 });
    }

    const data = {
      ...(parsed.data.adminNote !== undefined ? { adminNote: parsed.data.adminNote || null } : {}),
      ...(parsed.data.arrivalWindow !== undefined ? { arrivalWindow } : {}),
      ...(assignedWorkerId ? { assignedWorker: assignedWorkerId } : {}),
      ...(parsed.data.scheduledLocal !== undefined ? { scheduledAt } : {}),
      ...(planningChanged ? { eventTimeline: appendTimeline(current.eventTimeline, {
        action: relationId(current.assignedWorker) !== assignedWorkerId ? "planning.reassigned" : "planning.rescheduled",
        actorId: Number(user.id),
        changedFields: ["assignedWorker", "scheduledAt", "arrivalWindow"],
        reason: parsed.data.planningReason || "Initial assignment",
        before: { assignedWorker: relationId(current.assignedWorker), scheduledAt: current.scheduledAt, arrivalWindow: current.arrivalWindow },
        after: { assignedWorker: assignedWorkerId, scheduledAt, arrivalWindow },
      }) } : {}),
    };
    const updated = await payload.update({ collection: "work-orders", id: current.id, depth: 1, overrideAccess: true, data });
    const changedFields = Object.keys(data);
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "work-order.planning-updated",
      entityType: "work-order",
      entityId: current.id,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields,
      before: { assignedWorker: relationId(current.assignedWorker), scheduledAt: current.scheduledAt, arrivalWindow: current.arrivalWindow, status: current.status },
      after: { assignedWorker: relationId(updated.assignedWorker), scheduledAt: updated.scheduledAt, arrivalWindow: updated.arrivalWindow, status: updated.status },
    });
    let notification: "sent" | "queued" | "skipped" = "skipped";
    if (updated.status === "scheduled") {
      try {
        await syncWorkOrderCommunicationJobs(payload, updated, correlationIdFromHeaders(request.headers));
        const result = await dispatchWorkOrderCommunicationNow(payload, updated, "schedule_confirmation", correlationIdFromHeaders(request.headers));
        notification = result.delivered ? "sent" : result.queued ? "queued" : "skipped";
        if (planningChanged) await notifyAssignedWorkerNow(payload, updated, correlationIdFromHeaders(request.headers));
      } catch (error) {
        notification = "queued";
        captureException(error, { route: "PATCH /api/admin/work-orders/[id]", operation: "schedule-notification", workOrderId: current.id });
      }
    }
    return NextResponse.json({ workOrderId: updated.id, status: updated.status, notification });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work-order update failed" }, { status: 409 });
  }
}
