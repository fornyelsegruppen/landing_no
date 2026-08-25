import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { quoteSnapshotSchema } from "@/lib/quotes/document";
import { appendTimeline, loadAuthorizedWorkOrder, relationId } from "@/lib/work-orders/access";
import { assessAcceptedChangePrecheck, assessPrecheck } from "@/lib/work-orders/precheck";
import { changeAgreementSnapshotSchema } from "@/lib/change-agreements/document";
import { dispatchWorkOrderCommunicationNow } from "@/lib/work-orders/communications";
import { captureException } from "@/lib/monitoring";

const simpleActionSchema = z.object({ action: z.enum(["on_way", "arrive", "begin_precheck", "start", "mark_completed"]) });
const precheckSchema = z.object({
  action: z.literal("submit_precheck"),
  beforePhotoIds: z.array(z.number().int().positive()).min(2).max(12),
  roofType: z.enum(["betongstein", "teglstein", "metall", "skifer", "shingel", "annet"]),
  actualAreaTenths: z.number().int().positive().max(100_000),
  measurementMethod: z.enum(["laser", "målebånd", "tegning", "kart_kontrollert", "annet"]),
  slopeBasis: z.string().trim().min(2).max(300),
  visibleCondition: z.string().trim().min(5).max(2_000),
  safetyStatus: z.enum(["safe", "blocked"]),
  safetyNotes: z.string().trim().max(2_000).default(""),
  scopeChanged: z.boolean(),
  scopeChangeDetails: z.string().trim().max(2_000).default(""),
}).superRefine((value, context) => {
  if (value.safetyStatus === "blocked" && value.safetyNotes.length < 5) context.addIssue({ code: "custom", path: ["safetyNotes"], message: "HMS-avvik må beskrives" });
  if (value.scopeChanged && value.scopeChangeDetails.length < 5) context.addIssue({ code: "custom", path: ["scopeChangeDetails"], message: "Omfangsavvik må beskrives" });
});
const documentationSchema = z.object({ action: z.literal("submit_documentation"), afterPhotoIds: z.array(z.number().int().positive()).min(2).max(20), completionNotes: z.string().trim().min(10).max(4_000) });
const actionSchema = z.union([simpleActionSchema, precheckSchema, documentationSchema]);

async function verifyWorkMedia(payload: Awaited<ReturnType<typeof getPayload>>, orderId: number, ids: number[]) {
  const uniqueIds = [...new Set(ids)];
  const result = await payload.find({ collection: "private-media", depth: 0, limit: uniqueIds.length, overrideAccess: true, where: { and: [
    { id: { in: uniqueIds } }, { classification: { equals: "work" } }, { ownerType: { equals: "work-order" } }, { ownerId: { equals: String(orderId) } },
  ] } });
  if (result.docs.length !== uniqueIds.length) throw new Error("One or more work photos are invalid");
  return uniqueIds;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    assertFeatureReady("workerPortal");
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = await loadAuthorizedWorkOrder(payload, Number(id), user);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Ugyldig eller mangelfull registrering", issues: parsed.error.issues.map((issue) => issue.message) }, { status: 400 });
    const now = new Date().toISOString();
    let data: Record<string, unknown>;
    let changedFields: string[];

    if (parsed.data.action === "on_way") {
      data = { status: "on_way" }; changedFields = ["status"];
    } else if (parsed.data.action === "arrive") {
      data = { status: "arrived" }; changedFields = ["status"];
    } else if (parsed.data.action === "begin_precheck") {
      data = { status: "precheck" }; changedFields = ["status"];
    } else if (parsed.data.action === "start") {
      data = { status: "in_progress", startedAt: now }; changedFields = ["status", "startedAt"];
    } else if (parsed.data.action === "mark_completed") {
      data = { status: "completed", completedAt: now }; changedFields = ["status", "completedAt"];
    } else if (parsed.data.action === "submit_documentation") {
      const afterPhotoIds = await verifyWorkMedia(payload, order.id, parsed.data.afterPhotoIds);
      data = { status: "completed", afterPhotos: afterPhotoIds, completionNotes: parsed.data.completionNotes, documentationSubmittedAt: now };
      changedFields = ["afterPhotos", "completionNotes", "documentationSubmittedAt"];
    } else {
      if (parsed.data.action !== "submit_precheck") throw new Error("Unsupported work-order action");
      const beforePhotoIds = await verifyWorkMedia(payload, order.id, parsed.data.beforePhotoIds);
      const quote = await payload.findByID({ collection: "quotes", id: relationId(order.quote)!, depth: 0, overrideAccess: true });
      const snapshot = quoteSnapshotSchema.parse(quote.snapshot);
      const rule = await payload.findByID({ collection: "price-rules", id: snapshot.pricing.ruleId, depth: 0, overrideAccess: true });
      if (rule.status !== "approved" || rule.version !== snapshot.pricing.ruleVersion || rule.unitPriceExVatOre !== snapshot.pricing.unitPriceExVatOre || rule.vatBasisPoints !== snapshot.pricing.vatBasisPoints) {
        throw new Error("The signed price rule no longer matches the calculation basis");
      }
      let assessment = assessPrecheck({
        actualAreaTenths: parsed.data.actualAreaTenths,
        hmsSafe: parsed.data.safetyStatus === "safe",
        scopeChanged: parsed.data.scopeChanged,
        contract: {
          estimatedAreaMinTenths: snapshot.measurement.actualAreaMinTenths,
          estimatedAreaMaxTenths: snapshot.measurement.actualAreaMaxTenths,
          toleranceBasisPoints: snapshot.pricing.toleranceBasisPoints,
          originalTotalIncVatOre: snapshot.pricing.totalIncVatOre,
          maximumTotalIncVatOre: snapshot.pricing.maximumTotalIncVatOre,
        },
        rule: { unitPriceExVatOre: rule.unitPriceExVatOre, vatBasisPoints: rule.vatBasisPoints, minimumExVatOre: rule.minimumExVatOre },
      });
      const acceptedChangeId = relationId(order.approvedChangeAgreement);
      if (acceptedChangeId) {
        const acceptedChange = await payload.findByID({ collection: "change-agreements", id: acceptedChangeId, depth: 0, overrideAccess: true });
        const changeSnapshot = changeAgreementSnapshotSchema.parse(acceptedChange.snapshot);
        if (acceptedChange.status !== "accepted" || changeSnapshot.workOrderId !== order.id || changeSnapshot.contractDocumentHash !== order.contractDocumentHash) throw new Error("The approved change agreement is invalid");
        assessment = assessAcceptedChangePrecheck({ actualAreaTenths: parsed.data.actualAreaTenths, agreedAreaTenths: changeSnapshot.after.areaTenths, agreedSubtotalExVatOre: changeSnapshot.after.subtotalExVatOre, agreedTotalIncVatOre: changeSnapshot.after.totalIncVatOre, unitPriceExVatOre: rule.unitPriceExVatOre, vatBasisPoints: rule.vatBasisPoints, hmsSafe: parsed.data.safetyStatus === "safe", scopeChangedAgain: parsed.data.scopeChanged });
      }
      data = {
        status: assessment.decision,
        beforePhotos: beforePhotoIds,
        roofType: parsed.data.roofType,
        actualAreaTenths: parsed.data.actualAreaTenths,
        measurementMethod: parsed.data.measurementMethod,
        slopeBasis: parsed.data.slopeBasis,
        visibleCondition: parsed.data.visibleCondition,
        safetyStatus: parsed.data.safetyStatus,
        safetyNotes: parsed.data.safetyNotes,
        scopeChanged: parsed.data.scopeChanged,
        scopeChangeDetails: parsed.data.scopeChangeDetails,
        precheckDecision: assessment.decision,
        priceOutcome: assessment.outcome,
        allowedAreaMaxTenths: assessment.allowedAreaMaxTenths,
        actualSubtotalExVatOre: assessment.actualSubtotalExVatOre,
        actualVatOre: assessment.actualVatOre,
        actualTotalIncVatOre: assessment.actualTotalIncVatOre,
        blockingReasons: assessment.blockingReasons,
        precheckCompletedAt: now,
      };
      changedFields = Object.keys(data);
    }

    data.eventTimeline = appendTimeline(order.eventTimeline, { action: parsed.data.action, actorId: Number(user.id), changedFields, at: now });
    changedFields.push("eventTimeline");
    const updated = await payload.update({ collection: "work-orders", id: order.id, overrideAccess: true, context: { trustedWorkerAction: true }, data });
    await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: Number(user.id), action: `work-order.${parsed.data.action}`, entityType: "work-order", entityId: order.id, correlationId, changedFields });
    const communicationKind = parsed.data.action === "on_way" ? "on_way" : parsed.data.action === "arrive" ? "arrived" : parsed.data.action === "start" ? "work_started" : null;
    let customerNotification: "sent" | "queued" | "skipped" = "skipped";
    if (communicationKind) {
      try {
        const notification = await dispatchWorkOrderCommunicationNow(payload, updated, communicationKind, correlationId);
        customerNotification = notification.delivered ? "sent" : notification.queued ? "queued" : "skipped";
      } catch (error) {
        customerNotification = "queued";
        captureException(error, { route: "POST /api/worker/work-orders/[id]", operation: "status-notification", workOrderId: order.id, status: updated.status });
      }
    }
    return NextResponse.json({ ok: true, status: updated.status, decision: updated.precheckDecision, priceOutcome: updated.priceOutcome, blockingReasons: updated.blockingReasons, actualTotalIncVatOre: updated.actualTotalIncVatOre, customerNotification });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work-order action failed", correlationId }, { status: 409 });
  }
}
