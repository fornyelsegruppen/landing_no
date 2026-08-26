import type { Payload } from "payload";
import { createPrivateMedia } from "@/lib/private-media-storage";
import { documentHash } from "@/lib/quotes/document";
import { appendTimeline } from "@/lib/work-orders/access";
import { dispatchCompletionCommunicationNow } from "@/lib/work-orders/communications";
import { buildCompletionConfirmationPdf, buildInvoiceDraftPdf, type CompletionConfirmationSnapshot, type InvoiceDraftSnapshot } from "./completion-documents";

type CompletionReviewInput = {
  workOrderId: number;
  actorId: number;
  invoiceDueDays: number;
  reviewNote: string;
  correlationId: string;
  now?: Date;
};

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

function relationCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

export async function finalizeWorkOrderReview(payload: Payload, input: CompletionReviewInput) {
  const now = input.now || new Date();
  const nowIso = now.toISOString();
  const order = await payload.findByID({ collection: "work-orders", id: input.workOrderId, depth: 0, overrideAccess: true });
  if (order.status !== "completed") throw new Error("Only completed work can be final-reviewed");
  if (!order.documentationSubmittedAt || !order.completedAt || !order.completionNotes?.trim()) throw new Error("Worker completion documentation has not been submitted");
  if (relationCount(order.beforePhotos) < 2 || relationCount(order.afterPhotos) < 2) throw new Error("At least two before and two after photos are required");
  if (!order.actualSubtotalExVatOre || !order.actualVatOre || !order.actualTotalIncVatOre) throw new Error("Verified final pricing is missing");
  if (order.actualSubtotalExVatOre + order.actualVatOre !== order.actualTotalIncVatOre) throw new Error("Final VAT totals are inconsistent");

  const leadId = relationId(order.lead);
  const quoteId = relationId(order.quote);
  const contractId = relationId(order.contract);
  if (!leadId || !quoteId || !contractId) throw new Error("Work order relationships are incomplete");
  const [lead, quote, contract] = await Promise.all([
    payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: "contracts", id: contractId, depth: 0, overrideAccess: true }),
  ]);
  if (contract.status !== "signed" || !contract.companySignedAt) throw new Error("The supplier-signed contract is required");

  const changeId = relationId(order.approvedChangeAgreement);
  if (changeId) {
    const change = await payload.findByID({ collection: "change-agreements", id: changeId, depth: 0, overrideAccess: true });
    if (change.status !== "accepted" || change.afterTotalIncVatOre !== order.actualTotalIncVatOre) throw new Error("Final price does not match the accepted change agreement");
  } else {
    if (typeof quote.maximumTotalIncVatOre !== "number") throw new Error("The signed maximum price is missing");
    if (order.actualTotalIncVatOre > quote.maximumTotalIncVatOre) throw new Error("Final price exceeds the signed maximum without an accepted change agreement");
  }

  const customerAddress = [lead.address, lead.houseNumber, lead.postal, lead.city].filter(Boolean).join(" ");
  const dueAt = addDays(now, input.invoiceDueDays).toISOString();
  const invoiceReference = `FU-${order.id}-V1`;
  const completionReference = `FD-${order.id}-V1`;
  const invoiceSnapshot: InvoiceDraftSnapshot = {
    schemaVersion: "invoice-draft.v1",
    reference: invoiceReference,
    workOrderReference: order.reference,
    contractReference: contract.reference,
    customer: { name: lead.name, address: customerAddress, ...(lead.email ? { email: lead.email } : {}) },
    serviceDescription: order.workSummary,
    issuedAt: nowIso,
    dueAt,
    amounts: { subtotalExVatOre: order.actualSubtotalExVatOre, vatOre: order.actualVatOre, totalIncVatOre: order.actualTotalIncVatOre },
    notice: "Internt fakturautkast – ikke bokført og ikke sendt som betalingskrav.",
  };
  const completionSnapshot: CompletionConfirmationSnapshot = {
    schemaVersion: "completion-confirmation.v1",
    reference: completionReference,
    workOrderReference: order.reference,
    contractReference: contract.reference,
    customer: { name: lead.name, address: customerAddress },
    serviceDescription: order.workSummary,
    completedAt: new Date(order.completedAt).toISOString(),
    reviewedAt: nowIso,
    ...(typeof order.actualAreaTenths === "number" ? { actualAreaTenths: order.actualAreaTenths } : {}),
    amounts: { subtotalExVatOre: order.actualSubtotalExVatOre, vatOre: order.actualVatOre, totalIncVatOre: order.actualTotalIncVatOre },
    beforePhotoCount: relationCount(order.beforePhotos),
    afterPhotoCount: relationCount(order.afterPhotos),
    completionNotes: order.completionNotes,
    reviewNote: input.reviewNote,
  };

  const [invoiceExisting, completionExisting] = await Promise.all([
    payload.find({ collection: "invoice-records", depth: 0, limit: 1, overrideAccess: true, where: { workOrder: { equals: order.id } } }),
    payload.find({ collection: "private-media", depth: 0, limit: 1, overrideAccess: true, where: { and: [{ ownerType: { equals: "completion-certificate" } }, { ownerId: { equals: String(order.id) } }] } }),
  ]);
  let invoice = invoiceExisting.docs[0];
  if (!invoice) invoice = await payload.create({ collection: "invoice-records", overrideAccess: true, data: { reference: invoiceReference, lead: lead.id, workOrder: order.id, status: "draft", snapshot: invoiceSnapshot, documentHash: documentHash(invoiceSnapshot), subtotalExVatOre: order.actualSubtotalExVatOre, vatOre: order.actualVatOre, totalIncVatOre: order.actualTotalIncVatOre, issuedAt: nowIso, dueAt, assignedTo: input.actorId, adminNote: input.reviewNote } });
  if (!relationId(invoice.document)) {
    const persistedInvoiceSnapshot = invoice.snapshot as InvoiceDraftSnapshot;
    if (documentHash(persistedInvoiceSnapshot) !== invoice.documentHash) throw new Error("Invoice draft document hash mismatch");
    const media = await createPrivateMedia(payload, { classification: "invoice", ownerType: "invoice-record", ownerId: String(invoice.id), alt: `Fakturautkast ${invoice.reference}` }, { data: await buildInvoiceDraftPdf(persistedInvoiceSnapshot), mimeType: "application/pdf", filename: `${invoice.reference.toLowerCase()}-utkast.pdf` });
    invoice = await payload.update({ collection: "invoice-records", id: invoice.id, overrideAccess: true, data: { document: media.id } });
  }

  const completionDocument = completionExisting.docs[0] || await createPrivateMedia(payload, { classification: "work", ownerType: "completion-certificate", ownerId: String(order.id), alt: `Arbeids- og ferdigbekreftelse ${completionReference}` }, { data: await buildCompletionConfirmationPdf(completionSnapshot), mimeType: "application/pdf", filename: `${completionReference.toLowerCase()}-ferdigbekreftelse.pdf` });

  const updated = await payload.update({ collection: "work-orders", id: order.id, overrideAccess: true, context: { trustedCompletionReview: true }, data: {
    status: "documented",
    completionReviewedBy: input.actorId,
    completionReviewedAt: nowIso,
    completionReviewNote: input.reviewNote,
    eventTimeline: appendTimeline(order.eventTimeline, { action: "admin_completion_review", actorId: input.actorId, changedFields: ["status", "completionReviewedBy", "completionReviewedAt", "completionReviewNote"], at: nowIso }),
  } });
  const communication = await dispatchCompletionCommunicationNow(payload, updated, input.correlationId);
  return { workOrder: updated, invoice, completionDocument, communication };
}
