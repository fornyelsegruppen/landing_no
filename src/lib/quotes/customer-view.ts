import type { Payload } from "payload";
import { quoteDisplayModel, type ContractSnapshot, type SignatureEvidenceRecord } from "./document";
import { resolveQuoteAccessToken } from "./customer-access";

export async function loadCustomerQuote(payload: Payload, token: string, options: { markViewed?: boolean; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const access = await resolveQuoteAccessToken(payload, token, now);
  if (!access) return null;
  let quote = await payload.findByID({ collection: "quotes", id: access.quoteId, depth: 0, overrideAccess: true });
  if (new Date(quote.validUntil).getTime() <= now.getTime() && ["sent", "viewed"].includes(quote.status)) {
    quote = await payload.update({ collection: "quotes", id: quote.id, overrideAccess: true, data: { status: "expired" } });
  }
  if (!["sent", "viewed", "accepted", "declined"].includes(quote.status)) return null;
  if (options.markViewed && quote.status === "sent") {
    quote = await payload.update({ collection: "quotes", id: quote.id, overrideAccess: true, data: { status: "viewed", viewedAt: now.toISOString() } });
  }
  const contracts = await payload.find({ collection: "contracts", depth: 0, limit: 1, overrideAccess: true, where: { quote: { equals: quote.id } } });
  const contract = contracts.docs[0];
  if (!contract) return null;
  const snapshot = contract.snapshot as unknown as ContractSnapshot;
  return {
    accessRecordId: access.record.id,
    quoteId: quote.id,
    quoteStatus: quote.status,
    quoteReference: quote.reference,
    contractId: contract.id,
    contractStatus: contract.status,
    contractReference: contract.reference,
    documentHash: contract.documentHash,
    snapshot,
    display: quoteDisplayModel(quote.snapshot),
    customerName: snapshot.customer.name,
    signedAt: contract.signedAt ?? null,
    signatureEvidence: (contract.signatureEvidence ?? null) as SignatureEvidenceRecord | null,
    signedDocumentId: typeof contract.signedDocument === "number" ? contract.signedDocument : contract.signedDocument?.id ?? null,
    companySignedAt: contract.companySignedAt ?? null,
    companySignedDocumentId: typeof contract.companySignedDocument === "number" ? contract.companySignedDocument : contract.companySignedDocument?.id ?? null,
  };
}
