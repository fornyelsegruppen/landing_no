import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueMessageJob } from "@/lib/messages/message-engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { resolvePayloadSecret } from "@/lib/payload-secret";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { createSignatureEvidence, type ContractSnapshot } from "@/lib/quotes/document";
import { loadCustomerQuote } from "@/lib/quotes/customer-view";
import { buildQuoteContractPdf } from "@/lib/quotes/quote-pdf";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashOpaqueToken } from "@/lib/security/opaque-token";
import { createPrivateMedia, deletePrivateMedia } from "@/lib/private-media-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("question"), message: z.string().trim().min(5).max(2_000) }),
  z.object({ action: z.literal("decline") }),
  z.object({
    action: z.literal("sign"), signerName: z.string().trim().min(3).max(160),
    signatureData: z.string().min(100).max(1_500_000), expectedDocumentHash: z.string().regex(/^[a-f0-9]{64}$/),
    paymentObligationAccepted: z.literal(true), termsAccepted: z.literal(true), withdrawalInformationReceived: z.literal(true),
    earlyStartRequested: z.boolean(), earlyStartLossAcknowledged: z.boolean(),
  }),
]);

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const payload = await getPayload();
  const view = await loadCustomerQuote(payload, token, { markViewed: true });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    quoteStatus: view.quoteStatus, quoteReference: view.quoteReference, contractStatus: view.contractStatus,
    contractReference: view.contractReference, documentHash: view.documentHash, display: view.display,
    customerName: view.customerName, supplier: view.snapshot.supplier, terms: view.snapshot.terms,
    signedAt: view.signedAt, pdfUrl: `/api/customer/quote/${encodeURIComponent(token)}/pdf`,
  }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    assertFeatureReady("customerQuotes");
    const { token } = await context.params;
    const tokenKey = hashOpaqueToken("quote-customer-access", token).slice(0, 24);
    const limited = await rateLimit("customer-quote", `${tokenKey}:${clientIp(request)}`, { limit: 12, windowSec: 60 });
    if (!limited.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid action", details: parsed.error.flatten() }, { status: 400 });
    const payload = await getPayload();
    const view = await loadCustomerQuote(payload, token);
    if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const leadId = view.snapshot.quote.leadId;

    if (parsed.data.action === "question") {
      const digest = createHash("sha256").update(parsed.data.message).digest("hex").slice(0, 24);
      const existing = await payload.find({ collection: "messages", depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: `quote-question:${view.quoteId}:${digest}` } } });
      if (!existing.docs[0]) await payload.create({ collection: "messages", overrideAccess: true, data: {
        lead: leadId, direction: "inbound", category: "customer_question", channel: "email",
        subject: `Spørsmål om tilbud ${view.quoteReference}`, bodyText: parsed.data.message,
        status: "delivered", idempotencyKey: `quote-question:${view.quoteId}:${digest}`, aiAssisted: false, deliveredAt: new Date().toISOString(),
      } });
      await payload.update({ collection: "leads", id: leadId, overrideAccess: true, data: { status: "waiting_customer", nextAction: `Svar på kundespørsmål om ${view.quoteReference}.`, nextActionAt: new Date().toISOString() } });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "decline") {
      if (!["sent", "viewed"].includes(view.quoteStatus)) throw new Error("Quote cannot be declined in its current state");
      await payload.update({ collection: "quotes", id: view.quoteId, overrideAccess: true, data: { status: "declined", declinedAt: new Date().toISOString() } });
      if (view.contractStatus === "issued") await payload.update({ collection: "contracts", id: view.contractId, overrideAccess: true, data: { status: "declined" } });
      await payload.update({ collection: "leads", id: leadId, overrideAccess: true, data: { status: "closed", closedAt: new Date().toISOString(), nextAction: "Kunden avslo tilbudet." } });
      return NextResponse.json({ ok: true, status: "declined" });
    }

    assertFeatureReady("contractSigning");
    if (view.contractStatus === "signed" && view.quoteStatus === "accepted") return NextResponse.json({ ok: true, status: "signed", idempotent: true });
    if (view.contractStatus !== "issued" || !["sent", "viewed"].includes(view.quoteStatus)) throw new Error("Contract is not available for signing");
    const evidence = createSignatureEvidence({
      contract: view.snapshot as ContractSnapshot, expectedDocumentHash: parsed.data.expectedDocumentHash,
      signatureData: parsed.data.signatureData, signerName: parsed.data.signerName,
      paymentObligationAccepted: parsed.data.paymentObligationAccepted, termsAccepted: parsed.data.termsAccepted,
      withdrawalInformationReceived: parsed.data.withdrawalInformationReceived,
      earlyStartRequested: parsed.data.earlyStartRequested, earlyStartLossAcknowledged: parsed.data.earlyStartLossAcknowledged,
      ipAddress: clientIp(request), userAgent: request.headers.get("user-agent") ?? "unknown",
      securitySalt: process.env.CUSTOMER_TOKEN_SECRET || resolvePayloadSecret(),
    });
    const pdfBytes = await buildQuoteContractPdf({ contract: view.snapshot as ContractSnapshot, signatureData: parsed.data.signatureData, evidence });
    const filename = `signert-${view.contractReference.toLowerCase()}.pdf`;
    const media = await createPrivateMedia(payload, {
      classification: "contract", ownerType: "contract", ownerId: String(view.contractId), alt: `Signert kontrakt ${view.contractReference}`,
    }, { data: pdfBytes, mimeType: "application/pdf", filename });
    const updated = await payload.update({ collection: "contracts", overrideAccess: true, where: { and: [
      { id: { equals: view.contractId } }, { status: { equals: "issued" } },
    ] }, data: { status: "signed", signatureEvidence: evidence, signedDocument: media.id, signedAt: evidence.signedAt } });
    if (updated.docs.length === 0) {
      await deletePrivateMedia(payload, media);
      const latest = await payload.findByID({ collection: "contracts", id: view.contractId, depth: 0, overrideAccess: true });
      if (latest.status === "signed") return NextResponse.json({ ok: true, status: "signed", idempotent: true });
      throw new Error("Contract signing conflict");
    }
    await payload.update({ collection: "quotes", id: view.quoteId, overrideAccess: true, data: { status: "accepted", acceptedAt: evidence.signedAt } });
    await payload.update({ collection: "access-tokens", id: view.accessRecordId, overrideAccess: true, data: { usedAt: evidence.signedAt } });
    await payload.update({ collection: "leads", id: leadId, overrideAccess: true, data: { status: "converted", nextAction: "Opprett og planlegg arbeidsordre.", nextActionAt: new Date().toISOString() } });
    const key = `contract-signed:${view.contractId}`;
    const prior = await payload.find({ collection: "messages", depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: key } } });
    if (!prior.docs[0]) {
      const message = await payload.create({ collection: "messages", overrideAccess: true, data: {
        lead: leadId, direction: "outbound", category: "contract", channel: "email",
        subject: `Signert kontrakt ${view.contractReference}`,
        bodyText: `Takk. Kontrakten ${view.contractReference} er signert. Den signerte kopien og angrerettskjemaet er vedlagt. Vi kontakter deg om planlagt oppstart.`,
        attachments: [media.id], status: "queued", idempotencyKey: key, aiAssisted: false,
        approvedAt: evidence.signedAt, queuedAt: evidence.signedAt,
      } });
      await enqueueMessageJob(payload, message.id, correlationId);
    }
    return NextResponse.json({ ok: true, status: "signed", pdfUrl: `/api/customer/quote/${encodeURIComponent(token)}/pdf` });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Customer action failed", correlationId }, { status: 409 });
  }
}
