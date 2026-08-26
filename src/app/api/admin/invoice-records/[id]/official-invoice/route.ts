import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { extractFikenInvoice } from "@/lib/finance/fiken-pdf";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { createPrivateMedia, deletePrivateMedia } from "@/lib/private-media-storage";
import { userIsAdmin } from "@/payload/access/roles";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid invoice record" }, { status: 400 });
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a Fiken PDF" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "PDF must be between 1 byte and 10 MB" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "Only a valid PDF file can be imported" }, { status: 400 });

  const invoiceRecord = await payload.findByID({ collection: "invoice-records", id: Number(id), depth: 0, overrideAccess: true });
  if (invoiceRecord.status !== "approved") return NextResponse.json({ error: "Approve the invoice basis before importing the official Fiken invoice" }, { status: 409 });
  const leadId = relationId(invoiceRecord.lead);
  const workOrderId = relationId(invoiceRecord.workOrder);
  if (!leadId || !workOrderId) return NextResponse.json({ error: "Invoice basis relationships are incomplete" }, { status: 409 });

  const originalHash = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await payload.find({ collection: "official-invoices", depth: 0, limit: 1, overrideAccess: true, where: { originalHash: { equals: originalHash } } });
  if (duplicate.docs[0]) return NextResponse.json({ error: "This exact PDF has already been imported", officialInvoiceId: duplicate.docs[0].id }, { status: 409 });

  let extraction: Awaited<ReturnType<typeof extractFikenInvoice>> | { confidence: 0; missing: string[]; textHash: string; error: string };
  try {
    extraction = await extractFikenInvoice(bytes);
  } catch {
    extraction = { confidence: 0, missing: ["invoiceNumber", "issuedAt", "dueAt", "subtotalExVatOre", "vatOre", "totalIncVatOre"], textHash: "", error: "PDF text could not be extracted; enter the fields manually" };
  }

  const existing = await payload.find({ collection: "official-invoices", depth: 0, limit: 1, overrideAccess: true, sort: "-createdAt", where: { invoiceRecord: { equals: invoiceRecord.id } } });
  const reference = `OF-${invoiceRecord.id}-V${existing.totalDocs + 1}`;
  const media = await createPrivateMedia(payload, { classification: "invoice", ownerType: "invoice-record", ownerId: String(invoiceRecord.id), alt: `Original Fiken-faktura ${reference}` }, { data: bytes, mimeType: "application/pdf", filename: `${reference.toLowerCase()}-fiken-original.pdf` });

  try {
    const officialInvoice = await payload.create({ collection: "official-invoices", overrideAccess: true, data: {
      reference,
      lead: leadId,
      workOrder: workOrderId,
      invoiceRecord: invoiceRecord.id,
      status: "needs_review",
      originalDocument: media.id,
      originalHash,
      extractionStatus: "error" in extraction ? "failed" : "needs_review",
      extractedData: extraction,
    } });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "official-invoice.imported",
      entityType: "official-invoice",
      entityId: officialInvoice.id,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: ["originalDocument", "originalHash", "extractedData", "extractionStatus"],
      metadata: { invoiceRecordId: invoiceRecord.id, extractionConfidence: extraction.confidence },
    });
    return NextResponse.json({ ok: true, officialInvoiceId: officialInvoice.id, extracted: extraction });
  } catch (error) {
    await deletePrivateMedia(payload, media).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Official invoice import failed" }, { status: 409 });
  }
}

