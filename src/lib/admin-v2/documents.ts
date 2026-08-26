import type { Payload } from "payload";

export const adminDocumentTypes = ["all", "quote", "contract_draft", "customer_signed", "final_contract", "change_agreement", "work_documentation", "measurement", "invoice_draft", "official_invoice", "warranty"] as const;
export type AdminDocumentType = (typeof adminDocumentTypes)[number];

export type AdminDocumentItem = {
  caseHref: string;
  createdAt?: string;
  customer: string;
  filename: string;
  hash?: string;
  href: string;
  id: string;
  leadId: number;
  reference: string;
  status?: string;
  type: Exclude<AdminDocumentType, "all">;
  version?: number;
};

type Filters = { query?: string; status?: string; type?: AdminDocumentType };

function record(value: unknown) { return value as Record<string, unknown>; }
function id(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}
function text(value: unknown) { return typeof value === "string" ? value : undefined; }
function number(value: unknown) { return typeof value === "number" ? value : undefined; }

function fileHref(media: Record<string, unknown>) {
  const mediaId = id(media);
  return mediaId ? `/api/admin/media/${mediaId}` : "#";
}

export async function loadAdminDocuments(payload: Pick<Payload, "find">, filters: Filters = {}) {
  const common = { depth: 1, limit: 500, overrideAccess: true, pagination: false, sort: "-createdAt" as const };
  const [leadsResult, quotesResult, contractsResult, workResult, changesResult, measurementsResult, invoicesResult, officialInvoicesResult, warrantiesResult, mediaResult] = await Promise.all([
    payload.find({ ...common, collection: "leads" }),
    payload.find({ ...common, collection: "quotes", sort: "-version" }),
    payload.find({ ...common, collection: "contracts", sort: "-version" }),
    payload.find({ ...common, collection: "work-orders" }),
    payload.find({ ...common, collection: "change-agreements", sort: "-version" }),
    payload.find({ ...common, collection: "roof-measurements", sort: "-version" }),
    payload.find({ ...common, collection: "invoice-records" }),
    payload.find({ ...common, collection: "official-invoices" }),
    payload.find({ ...common, collection: "warranties" }),
    payload.find({ ...common, collection: "private-media" }),
  ]);
  const leads = new Map<number, Record<string, unknown>>(leadsResult.docs.map((item) => [id(item) || 0, record(item)]));
  const quotes = new Map<number, Record<string, unknown>>(quotesResult.docs.map((item) => [id(item) || 0, record(item)]));
  const work = new Map<number, Record<string, unknown>>(workResult.docs.map((item) => [id(item) || 0, record(item)]));
  const media = new Map<number, Record<string, unknown>>(mediaResult.docs.map((item) => [id(item) || 0, record(item)]));
  const quoteLead = (quote: Record<string, unknown> | undefined) => quote ? id(quote.lead) : undefined;
  const workLead = (order: Record<string, unknown> | undefined) => order ? id(order.lead) : undefined;
  const customer = (leadId: number) => text(leads.get(leadId)?.name) || `#${leadId}`;
  const items: AdminDocumentItem[] = [];
  const add = (item: AdminDocumentItem) => items.push(item);

  for (const raw of quotesResult.docs) {
    const quote = record(raw);
    const quoteId = id(quote);
    const leadId = quoteLead(quote);
    if (!quoteId || !leadId) continue;
    add({ id: `quote-${quoteId}`, leadId, customer: customer(leadId), caseHref: `/admin-v2/cases/${leadId}`, reference: text(quote.reference) || `#${quoteId}`, filename: `${text(quote.reference) || quoteId}.pdf`, href: `/api/admin/quotes/${quoteId}/pdf`, type: "quote", status: text(quote.status), version: number(quote.version), createdAt: text(quote.createdAt), hash: text(quote.snapshotHash) });
  }

  for (const raw of contractsResult.docs) {
    const contract = record(raw);
    const contractId = id(contract);
    const quote = quotes.get(id(contract.quote) || 0) || (contract.quote && typeof contract.quote === "object" ? record(contract.quote) : undefined);
    const quoteId = id(quote);
    const leadId = quoteLead(quote);
    if (!contractId || !quoteId || !leadId) continue;
    const base = { leadId, customer: customer(leadId), caseHref: `/admin-v2/cases/${leadId}`, reference: text(contract.reference) || `#${contractId}`, status: text(contract.status), version: number(contract.version), createdAt: text(contract.createdAt), hash: text(contract.documentHash) };
    const customerMedia = media.get(id(contract.signedDocument) || 0);
    const finalMedia = media.get(id(contract.companySignedDocument) || 0);
    if (customerMedia) add({ ...base, id: `customer-contract-${contractId}`, filename: text(customerMedia.filename) || `${base.reference}.pdf`, href: fileHref(customerMedia), type: "customer_signed" });
    if (finalMedia) add({ ...base, id: `final-contract-${contractId}`, filename: text(finalMedia.filename) || `${base.reference}.pdf`, href: fileHref(finalMedia), type: "final_contract" });
    if (!customerMedia && !finalMedia) add({ ...base, id: `contract-draft-${contractId}`, filename: `${base.reference}.pdf`, href: `/api/admin/quotes/${quoteId}/pdf`, type: "contract_draft" });
  }

  for (const raw of changesResult.docs) {
    const change = record(raw);
    const changeId = id(change);
    const order = work.get(id(change.workOrder) || 0) || (change.workOrder && typeof change.workOrder === "object" ? record(change.workOrder) : undefined);
    const leadId = workLead(order);
    const acceptedMedia = media.get(id(change.acceptedDocument) || 0);
    if (!changeId || !leadId || !acceptedMedia) continue;
    add({ id: `change-${changeId}`, leadId, customer: customer(leadId), caseHref: `/admin-v2/cases/${leadId}`, reference: text(change.reference) || `#${changeId}`, filename: text(acceptedMedia.filename) || `${text(change.reference) || changeId}.pdf`, href: fileHref(acceptedMedia), type: "change_agreement", status: text(change.status), version: number(change.version), createdAt: text(change.createdAt), hash: text(change.documentHash) });
  }

  for (const raw of measurementsResult.docs) {
    const measurement = record(raw);
    const measurementId = id(measurement);
    const leadId = id(measurement.lead);
    const mapMedia = media.get(id(measurement.mapImage) || 0);
    if (!measurementId || !leadId || !mapMedia) continue;
    add({
      id: `measurement-${measurementId}`,
      leadId,
      customer: customer(leadId),
      caseHref: `/admin-v2/cases/${leadId}`,
      reference: text(measurement.reference) || `#${measurementId}`,
      filename: text(mapMedia.filename) || `measurement-${measurementId}`,
      href: fileHref(mapMedia),
      type: "measurement",
      status: text(measurement.status),
      version: number(measurement.version),
      createdAt: text(measurement.createdAt),
      hash: text(measurement.inputHash),
    });
  }

  for (const raw of mediaResult.docs) {
    const file = record(raw);
    const mediaId = id(file);
    if (!mediaId || !["work-order", "work"].includes(text(file.ownerType) || "")) continue;
    const order = work.get(Number(text(file.ownerId)));
    const leadId = workLead(order);
    if (!leadId) continue;
    add({ id: `work-media-${mediaId}`, leadId, customer: customer(leadId), caseHref: `/admin-v2/cases/${leadId}`, reference: text(order?.reference) || `#${mediaId}`, filename: text(file.filename) || `#${mediaId}`, href: fileHref(file), type: "work_documentation", status: text(order?.status), createdAt: text(file.createdAt) });
  }

  for (const raw of invoicesResult.docs) {
    const invoice = record(raw);
    const invoiceId = id(invoice);
    const leadId = id(invoice.lead);
    const document = media.get(id(invoice.document) || 0);
    if (!invoiceId || !leadId || !document) continue;
    add({ id: `invoice-${invoiceId}`, leadId, customer: customer(leadId), caseHref: `/admin-v2/cases/${leadId}`, reference: text(invoice.reference) || `#${invoiceId}`, filename: text(document.filename) || `${text(invoice.reference) || invoiceId}.pdf`, href: fileHref(document), type: "invoice_draft", status: text(invoice.status), createdAt: text(invoice.createdAt), hash: text(invoice.documentHash) });
  }

  for (const raw of officialInvoicesResult.docs) {
    const invoice = record(raw);
    const invoiceId = id(invoice);
    const leadId = id(invoice.lead);
    const document = media.get(id(invoice.originalDocument) || 0);
    if (!invoiceId || !leadId || !document) continue;
    add({ id: `official-invoice-${invoiceId}`, leadId, customer: customer(leadId), caseHref: `/admin-v2/cases/${leadId}`, reference: text(invoice.invoiceNumber) || text(invoice.reference) || `#${invoiceId}`, filename: text(document.filename) || `${text(invoice.invoiceNumber) || invoiceId}.pdf`, href: fileHref(document), type: "official_invoice", status: text(invoice.status), createdAt: text(invoice.createdAt), hash: text(invoice.originalHash) });
  }

  for (const raw of warrantiesResult.docs) {
    const warranty = record(raw);
    const warrantyId = id(warranty);
    const leadId = id(warranty.lead);
    const document = media.get(id(warranty.document) || 0);
    if (!warrantyId || !leadId || !document) continue;
    add({ id: `warranty-${warrantyId}`, leadId, customer: customer(leadId), caseHref: `/admin-v2/cases/${leadId}`, reference: text(warranty.reference) || `#${warrantyId}`, filename: text(document.filename) || `${text(warranty.reference) || warrantyId}.pdf`, href: fileHref(document), type: "warranty", status: text(warranty.status), createdAt: text(warranty.createdAt), hash: text(warranty.documentHash) });
  }

  const query = filters.query?.trim().toLocaleLowerCase("nb-NO");
  return items.filter((item) => {
    if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.status && filters.status !== "all" && item.status !== filters.status) return false;
    if (query && ![item.customer, item.reference, item.filename, String(item.leadId)].some((value) => value.toLocaleLowerCase("nb-NO").includes(query))) return false;
    return true;
  }).sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
}
