import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { deliverMessage, enqueueMessageJob } from "@/lib/messages/message-engine";
import { captureException } from "@/lib/monitoring";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { resolvePayloadSecret } from "@/lib/payload-secret";
import { createPrivateMedia, deletePrivateMedia } from "@/lib/private-media-storage";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import { extractSignaturePngFromPdf } from "@/lib/pdf/extract-signature";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { clientIp } from "@/lib/rate-limit";
import { createCompanySignatureEvidence, type ContractSnapshot, type SignatureEvidenceRecord } from "@/lib/quotes/document";
import { buildQuoteContractPdf } from "@/lib/quotes/quote-pdf";
import { loadPdfMeasurementEvidence } from "@/lib/quotes/measurement-evidence";
import { userIsAdmin } from "@/payload/access/roles";
import { updateCaseState } from "@/lib/cases/case-command";
import { issueQuoteAccessToken } from "@/lib/quotes/customer-access";
import {
  assertCurrentContractTarget,
  assertExpectedDocumentHash,
  StaleCommercialContextError,
} from "@/lib/admin-v2/commercial-action-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  signerName: z.string().trim().min(3).max(160),
  signatureData: z.string().min(100).max(1_500_000),
  expectedDocumentHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedVersion: z.number().int().positive().optional(),
});

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid contract" }, { status: 400 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let companySignatureMedia: Awaited<ReturnType<typeof createPrivateMedia>> | null = null;
  let finalDocumentMedia: Awaited<ReturnType<typeof createPrivateMedia>> | null = null;
  let contractCommitted = false;
  try {
    const contract = await payload.findByID({ collection: "contracts", id: Number(id), depth: 0, overrideAccess: true });
    if (contract.status !== "signed") throw new TypeError("The customer must sign before the supplier can sign");
    const quoteId = relationId(contract.quote);
    if (!quoteId) throw new TypeError("Contract quote is missing");
    const quote = await payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true });
    const leadId = relationId(quote.lead);
    if (!leadId) throw new TypeError("Contract lead is missing");
    await assertCurrentContractTarget(payload, {
      leadId,
      contractId: contract.id,
      expectedVersion: parsed.data.expectedVersion,
    });
    assertExpectedDocumentHash({
      expectedDocumentHash: parsed.data.expectedDocumentHash,
      currentDocumentHash: typeof contract.documentHash === "string" ? contract.documentHash : undefined,
      currentReference: contract.reference,
    });
    if (contract.companySignedAt) return NextResponse.json({ ok: true, status: "fully_signed", idempotent: true });
    if (quote.status !== "accepted") throw new TypeError("The customer has not accepted the quote");
    const snapshot = contract.snapshot as unknown as ContractSnapshot;
    const customerEvidence = contract.signatureEvidence as unknown as SignatureEvidenceRecord | null;
    if (!customerEvidence) throw new TypeError("Customer signature evidence is missing");

    const evidence = createCompanySignatureEvidence({
      contract: snapshot,
      expectedDocumentHash: parsed.data.expectedDocumentHash,
      signatureData: parsed.data.signatureData,
      signerName: parsed.data.signerName,
      signerUserId: Number(user.id),
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      securitySalt: process.env.CUSTOMER_TOKEN_SECRET || resolvePayloadSecret(),
    });

    let customerSignatureData: string | undefined;
    const customerSignatureImageId = relationId(contract.customerSignatureImage);
    if (customerSignatureImageId) {
      const media = await payload.findByID({ collection: "private-media", id: customerSignatureImageId, depth: 0, overrideAccess: true });
      const content = await readPrivateMediaContent(media);
      customerSignatureData = `data:image/png;base64,${content.data.toString("base64")}`;
    } else {
      const legacySignedDocumentId = relationId(contract.signedDocument);
      if (legacySignedDocumentId) {
        const legacyDocument = await payload.findByID({ collection: "private-media", id: legacySignedDocumentId, depth: 0, overrideAccess: true });
        const legacyContent = await readPrivateMediaContent(legacyDocument);
        const extracted = await extractSignaturePngFromPdf(legacyContent.data);
        if (extracted) customerSignatureData = `data:image/png;base64,${extracted.toString("base64")}`;
      }
    }
    if (!customerSignatureData) throw new TypeError("Customer signature image is unavailable. Reissue the contract for customer signing before counter-signing.");

    const signatureBytes = Buffer.from(parsed.data.signatureData.split(",")[1] ?? "", "base64");
    companySignatureMedia = await createPrivateMedia(payload, {
      classification: "contract",
      ownerType: "contract",
      ownerId: String(contract.id),
      alt: `Leverandørsignatur ${contract.reference}`,
    }, {
      data: signatureBytes,
      mimeType: "image/png",
      filename: `leverandorsignatur-${contract.reference.toLowerCase()}.png`,
    });

    const measurementEvidence = await loadPdfMeasurementEvidence(payload, snapshot);
    const finalPdf = await buildQuoteContractPdf({
      contract: snapshot,
      signatureData: customerSignatureData,
      evidence: customerEvidence,
      companySignatureData: parsed.data.signatureData,
      companyEvidence: evidence,
      measurementEvidence,
    });
    finalDocumentMedia = await createPrivateMedia(payload, {
      classification: "contract",
      ownerType: "contract",
      ownerId: String(contract.id),
      alt: `Endelig signert kontrakt ${contract.reference}`,
    }, {
      data: finalPdf,
      mimeType: "application/pdf",
      filename: `endelig-signert-${contract.reference.toLowerCase()}.pdf`,
    });

    await payload.update({
      collection: "contracts",
      id: contract.id,
      overrideAccess: true,
      data: {
        companySignatureEvidence: evidence,
        companySignatureImage: companySignatureMedia.id,
        companySignedDocument: finalDocumentMedia.id,
        companySignedAt: evidence.signedAt,
        companySignedBy: user.id,
      },
    });
    contractCommitted = true;

    await updateCaseState(payload, { leadId, actorId: user.id, command: "company_countersigned", idempotencyKey: `company-countersign:${contract.id}`, patch: {
      status: "converted", nextActionOwner: "administrator", nextAction: "Kontrakten er signert av begge parter. Opprett og planlegg arbeidsordre.", nextActionAt: evidence.signedAt,
    } });

    const key = `contract-counter-signed:${contract.id}`;
    let notification: "sent" | "queued" | "skipped" = "skipped";
    const prior = await payload.find({ collection: "messages", depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: key } } });
    if (!prior.docs[0]) {
      const access = await issueQuoteAccessToken(payload, quote.id, new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString(), { purpose: "signed-contract-customer-portal", contractId: contract.id });
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.takfornyelse.as").replace(/\/$/, "");
      const customerPortalUrl = `${siteUrl}/tilbud/${encodeURIComponent(access.token)}`;
      const message = await payload.create({ collection: "messages", overrideAccess: true, data: {
        lead: leadId,
        direction: "outbound",
        category: "contract",
        channel: "email",
        subject: `Endelig signert kontrakt ${contract.reference}`,
        bodyText: `Hei ${snapshot.customer.name},\n\nKontrakten ${contract.reference} er nå signert av både deg og Takfornyelse. Den endelige kontrakten er vedlagt. Vi følger opp med avtalt eller planlagt oppstart.\n\nAdministrer avtalen, still spørsmål eller send en angre-/endringsmelding via din sikre kundelenke:\n${customerPortalUrl}\n\nVennlig hilsen\nTakfornyelse\n${snapshot.supplier.phone}`,
        attachments: [finalDocumentMedia.id],
        status: "queued",
        idempotencyKey: key,
        aiAssisted: false,
        approvedBy: user.id,
        approvedAt: evidence.signedAt,
        queuedAt: evidence.signedAt,
      } });
      await enqueueMessageJob(payload, message.id, correlationId);
      const provider = createEmailProvider();
      if (provider.health().status === "ready") {
        try {
          await deliverMessage(payload, provider, message.id, correlationId);
          notification = "sent";
        } catch (error) {
          notification = "queued";
          captureException(error, { route: "POST /api/admin/contracts/[id]/sign", operation: "final-contract-delivery", correlationId });
        }
      } else notification = "queued";
    }

    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "contract.company_sign",
      entityType: "contract",
      entityId: contract.id,
      correlationId,
      changedFields: ["companySignatureEvidence", "companySignedDocument", "companySignedAt", "companySignedBy"],
    });
    return NextResponse.json({ ok: true, status: "fully_signed", documentId: finalDocumentMedia.id, notification });
  } catch (error) {
    if (!contractCommitted && finalDocumentMedia) await deletePrivateMedia(payload, finalDocumentMedia).catch(() => undefined);
    if (!contractCommitted && companySignatureMedia) await deletePrivateMedia(payload, companySignatureMedia).catch(() => undefined);
    captureException(error, { route: "POST /api/admin/contracts/[id]/sign", correlationId });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contract signing failed", ...(error instanceof StaleCommercialContextError ? { code: "STALE_COMMERCIAL_CONTEXT", currentReference: error.currentReference } : {}), correlationId }, { status: error instanceof TypeError ? 409 : 500 });
  }
}
