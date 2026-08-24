import { NextResponse } from "next/server";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import {
  assertFeatureReady,
  FeatureUnavailableError,
} from "@/lib/platform/features";
import { dispatchCompletionCommunicationNow } from "@/lib/work-orders/communications";
import { userIsAdmin } from "@/payload/access/roles";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertFeatureReady("automatedReminders");
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await context.params;
    if (!/^\d+$/.test(id))
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = await payload.findByID({
      collection: "work-orders",
      id: Number(id),
      depth: 0,
      overrideAccess: true,
    });
    if (order.status !== "documented") {
      return NextResponse.json(
        { error: "Completion communication requires documented work" },
        { status: 409 },
      );
    }
    const correlationId = correlationIdFromHeaders(request.headers);
    const result = await dispatchCompletionCommunicationNow(
      payload,
      order,
      correlationId,
    );
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "work-order.completion-communication",
      entityType: "work-order",
      entityId: order.id,
      correlationId,
      changedFields: [],
    });
    return NextResponse.json({
      ok: true,
      delivered: "delivered" in result ? result.delivered : false,
      queued: "queued" in result ? result.queued : false,
    });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json({ error: error.reason }, { status: 503 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Completion communication failed",
      },
      { status: 409 },
    );
  }
}
