import { getPayload } from "@/lib/payload";

const caseName = process.argv[2];
if (!caseName) throw new Error("Pass the exact synthetic case name as argv[2]");

const payload = await getPayload();
const leads = await payload.find({
  collection: "leads",
  depth: 0,
  limit: 2,
  pagination: false,
  overrideAccess: true,
  where: { name: { equals: caseName } },
});
if (leads.docs.length !== 1) {
  console.log(JSON.stringify({ pass: false, reason: "case-count", count: leads.docs.length }));
  process.exit(1);
}

const lead = leads.docs[0];
const leadId = Number(lead.id);
const [measurements, calculations, quotes, messages, workOrders] = await Promise.all([
  payload.find({ collection: "roof-measurements", depth: 0, limit: 50, pagination: false, overrideAccess: true, where: { lead: { equals: leadId } } }),
  payload.find({ collection: "price-calculations", depth: 0, limit: 50, pagination: false, overrideAccess: true, where: { lead: { equals: leadId } } }),
  payload.find({ collection: "quotes", depth: 0, limit: 50, pagination: false, overrideAccess: true, where: { lead: { equals: leadId } } }),
  payload.find({ collection: "messages", depth: 0, limit: 100, pagination: false, overrideAccess: true, where: { lead: { equals: leadId } } }),
  payload.find({ collection: "work-orders", depth: 0, limit: 20, pagination: false, overrideAccess: true, where: { lead: { equals: leadId } } }),
]);
const quoteIds = quotes.docs.map((item) => item.id);
const workOrderIds = workOrders.docs.map((item) => item.id);
const [contracts, changes, invoices] = await Promise.all([
  quoteIds.length
    ? payload.find({ collection: "contracts", depth: 0, limit: 50, pagination: false, overrideAccess: true, where: { quote: { in: quoteIds } } })
    : Promise.resolve({ docs: [] }),
  workOrderIds.length
    ? payload.find({ collection: "change-agreements", depth: 0, limit: 50, pagination: false, overrideAccess: true, where: { workOrder: { in: workOrderIds } } })
    : Promise.resolve({ docs: [] }),
  payload.find({ collection: "invoice-records", depth: 0, limit: 50, pagination: false, overrideAccess: true, where: { lead: { equals: leadId } } }),
]);

const result = {
  pass: true,
  lead: {
    id: leadId,
    status: lead.status,
    recordState: lead.recordState,
    nextActionOwner: lead.nextActionOwner ?? null,
    nextActionBlocker: lead.nextActionBlocker ?? null,
  },
  measurements: measurements.docs.map((item) => ({ reference: item.reference, status: item.status, confidence: item.confidence, mode: item.measurementMode })),
  calculations: calculations.docs.map((item) => ({ reference: item.reference, status: item.status, totalIncVatOre: item.totalIncVatOre, maximumTotalIncVatOre: item.maximumTotalIncVatOre ?? null })),
  quotes: quotes.docs.map((item) => ({ reference: item.reference, status: item.status, termsVersion: item.termsVersion, hasLockedSnapshot: Boolean(item.snapshot && item.snapshotHash) })),
  contracts: contracts.docs.map((item) => ({ reference: item.reference, status: item.status, termsVersion: item.termsVersion, customerSigned: Boolean(item.signedAt && item.signedDocument), companySigned: Boolean(item.companySignedAt && item.companySignedDocument), hasDocumentHash: Boolean(item.documentHash) })),
  workOrders: workOrders.docs.map((item) => ({ reference: item.reference, status: item.status, assigned: Boolean(item.assignedWorker), scheduled: Boolean(item.scheduledAt && item.arrivalWindow), timelineEvents: Array.isArray(item.eventTimeline) ? item.eventTimeline.length : 0 })),
  changes: changes.docs.map((item) => ({ reference: item.reference, status: item.status })),
  invoices: invoices.docs.map((item) => ({ reference: item.reference, status: item.status, hasDocument: Boolean(item.document), hasDocumentHash: Boolean(item.documentHash) })),
  messages: messages.docs.map((item) => {
    const html = typeof item.bodyHtml === "string" ? item.bodyHtml : "";
    return {
      category: item.category,
      status: item.status,
      direction: item.direction,
      providerRecorded: Boolean(item.providerMessageId),
      hasSecureCustomerLinkButton: /<a\b[^>]*href=["'][^"']+\/(?:tilbud|kunde|kontakt)\//i.test(html),
      exposesTokenAsVisibleUrl: />\s*https:\/\/[^<]+\/(?:tilbud|kunde|kontakt)\//i.test(html),
    };
  }),
};

console.log(JSON.stringify(result, null, 2));
process.exit(0);
