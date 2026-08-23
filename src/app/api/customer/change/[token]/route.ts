import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { buildAcceptedChangePdf } from "@/lib/change-agreements/change-pdf";
import { createChangeAcceptanceEvidence } from "@/lib/change-agreements/document";
import { loadCustomerChange } from "@/lib/change-agreements/customer-view";
import { enqueueMessageJob } from "@/lib/messages/message-engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { appendTimeline } from "@/lib/work-orders/access";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), customerName: z.string().min(3).max(160), expectedDocumentHash: z.string().length(64), accepted: z.literal(true) }),
  z.object({ action: z.literal("decline") }),
]);

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try { assertFeatureReady("customerQuotes"); const payload = await getPayload(); const { token } = await context.params; const view = await loadCustomerChange(payload, token); if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.json({ status: view.status, snapshot: view.snapshot, documentHash: view.documentHash, customerName: view.customerName, acceptedDocument: Boolean(view.acceptedDocumentId) }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } }); } catch (error) { if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason }, { status: 503 }); return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    assertFeatureReady("customerQuotes"); const payload = await getPayload(); const { token } = await context.params;
    const tokenKey = createHash("sha256").update(token).digest("hex");
    const limit = await rateLimit("customer-change", `${tokenKey}:${clientIp(request)}`, { limit: 10, windowSec: 15 * 60 }); if (!limit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const view = await loadCustomerChange(payload, token); if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid response" }, { status: 400 });
    if (parsed.data.action === "decline") {
      if (["accepted", "declined"].includes(view.status)) return NextResponse.json({ status: view.status, idempotent: true });
      await payload.update({ collection: "change-agreements", id: view.agreementId, overrideAccess: true, data: { status: "declined", declinedAt: new Date().toISOString() } });
      await recordAuditEvent(createPayloadAuditWriter(payload), { action: "change-agreement.customer-declined", entityType: "change-agreement", entityId: view.agreementId, correlationId, changedFields: ["status", "declinedAt"] });
      return NextResponse.json({ status: "declined" });
    }
    if (view.status === "accepted") return NextResponse.json({ status: "accepted", idempotent: true });
    if (!process.env.CUSTOMER_TOKEN_SECRET && !process.env.PAYLOAD_SECRET) throw new Error("Acceptance evidence is not configured");
    const evidence = createChangeAcceptanceEvidence({ snapshot: view.snapshot, expectedDocumentHash: parsed.data.expectedDocumentHash, customerName: parsed.data.customerName, accepted: parsed.data.accepted, ipAddress: clientIp(request), userAgent: request.headers.get("user-agent") || "", securitySalt: process.env.CUSTOMER_TOKEN_SECRET || process.env.PAYLOAD_SECRET! });
    const pdf = await buildAcceptedChangePdf(view.snapshot, evidence); const filename = `${view.snapshot.reference}-akseptert.pdf`;
    const media = await payload.create({ collection: "private-media", overrideAccess: true, data: { classification: "contract", ownerType: "change-agreement", ownerId: String(view.agreementId), alt: "" }, file: { data: Buffer.from(pdf), mimetype: "application/pdf", name: filename, size: pdf.byteLength } });
    const updated = await payload.update({ collection: "change-agreements", overrideAccess: true, where: { and: [{ id: { equals: view.agreementId } }, { status: { in: ["sent", "viewed"] } }] }, data: { status: "accepted", acceptanceEvidence: evidence, acceptedDocument: media.id, acceptedAt: evidence.acceptedAt } });
    if (!updated.docs?.length) { await payload.delete({ collection: "private-media", id: media.id, overrideAccess: true }); return NextResponse.json({ status: "accepted", idempotent: true }); }
    const order = await payload.findByID({ collection: "work-orders", id: view.workOrderId, depth: 0, overrideAccess: true });
    await payload.update({ collection: "work-orders", id: order.id, overrideAccess: true, context: { trustedWorkerAction: true }, data: { approvedChangeAgreement: view.agreementId, eventTimeline: appendTimeline(order.eventTimeline, { action: "change-agreement.accepted", actorId: 0, changedFields: ["approvedChangeAgreement"] }) } });
    await recordAuditEvent(createPayloadAuditWriter(payload), { action: "change-agreement.customer-accepted", entityType: "change-agreement", entityId: view.agreementId, correlationId, changedFields: ["status", "acceptanceEvidence", "acceptedDocument", "acceptedAt"] });
    await payload.update({ collection: "access-tokens", id: view.accessRecordId, overrideAccess: true, data: { usedAt: evidence.acceptedAt } });
    const message = await payload.create({ collection: "messages", overrideAccess: true, data: { lead: view.leadId, direction: "outbound", category: "change_confirmation", channel: "email", subject: `Bekreftelse ${view.snapshot.reference}`, bodyText: `Hei ${view.customerName},\n\nTakk. Endringsavtalen er skriftlig akseptert. Kopien ligger vedlagt. Arbeidet kan først fortsette når vår medarbeider har gjennomført ny kontroll og systemet viser Klar til start.\n\nVennlig hilsen\nTakfornyelse`, attachments: [media.id], status: "queued", idempotencyKey: `change-accepted:${view.agreementId}`, aiAssisted: false, approvedAt: evidence.acceptedAt, queuedAt: evidence.acceptedAt } });
    await enqueueMessageJob(payload, message.id, correlationId);
    return NextResponse.json({ status: "accepted" });
  } catch (error) { if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason }, { status: 503 }); return NextResponse.json({ error: error instanceof Error ? error.message : "Response failed", correlationId }, { status: 409 }); }
}
