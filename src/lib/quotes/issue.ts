import type { Payload } from "payload";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { siteConfig } from "@/lib/site";
import { issueQuoteAccessToken, revokeQuoteAccessTokens } from "./customer-access";
import { quoteDisplayModel } from "./document";

export async function issueQuoteCustomerLink(payload: Payload, quoteId: number) {
  const quote = await payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true });
  if (!['approved', 'sent', 'viewed'].includes(quote.status)) throw new Error("Quote must be approved before issuing a customer link");
  if (new Date(quote.validUntil).getTime() <= Date.now()) throw new Error("Quote has expired");
  const leadId = typeof quote.lead === "number" ? quote.lead : quote.lead.id;
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (!lead.email) throw new Error("Customer email is required to issue the quote");
  const contracts = await payload.find({ collection: "contracts", depth: 0, limit: 1, overrideAccess: true, where: { quote: { equals: quote.id } } });
  const contract = contracts.docs[0];
  if (!contract || !["draft", "issued"].includes(contract.status)) throw new Error("A valid contract draft is required");
  const access = await issueQuoteAccessToken(payload, quote.id, quote.validUntil, { contractId: contract.id, quoteVersion: quote.version });
  if (contract.status === "draft") await payload.update({ collection: "contracts", id: contract.id, overrideAccess: true, data: { status: "issued" } });
  const url = `${siteConfig.url.replace(/\/$/, "")}/tilbud/${access.token}`;
  const display = quoteDisplayModel(quote.snapshot);
  const body = [
    `Hei ${lead.name},`, "", `Tilbud ${quote.reference} for ${display.service} er klart.`,
    `Pris inkludert mva.: ${display.totalIncVatNok.toLocaleString("nb-NO", { minimumFractionDigits: 2 })} kr.`,
    display.maximumTotalIncVatNok == null ? null : `Avtalt maksimalpris inkludert mva.: ${display.maximumTotalIncVatNok.toLocaleString("nb-NO", { minimumFractionDigits: 2 })} kr.`,
    "", `Se tilbudet, kontrakten og angrerettinformasjonen her: ${url}`, "",
    `Lenken er personlig og gyldig til ${new Date(quote.validUntil).toLocaleDateString("nb-NO")}.`,
    "", "Vennlig hilsen", "Takfornyelse", siteConfig.phone,
  ].filter((line): line is string => line !== null).join("\n");
  const message = await payload.create({ collection: "messages", overrideAccess: true, data: {
    lead: lead.id, direction: "outbound", category: "quote", channel: "email",
    subject: `Tilbud ${quote.reference} fra Takfornyelse`, bodyText: body, status: "draft",
    idempotencyKey: makeIdempotencyKey("quote.issue", { quoteId: quote.id, accessTokenId: access.record.id }),
    aiAssisted: false, aiAnalysis: { quoteId: quote.id, contractId: contract.id, accessTokenId: access.record.id },
  } });
  return { quote, contract, message, url };
}

export async function revokeIssuedQuote(payload: Payload, quoteId: number) {
  const quote = await payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true });
  if (["accepted", "declined", "expired", "revoked", "superseded"].includes(quote.status)) throw new Error("Quote can no longer be revoked through this action");
  await revokeQuoteAccessTokens(payload, quote.id);
  const contracts = await payload.find({ collection: "contracts", depth: 0, limit: 10, overrideAccess: true, where: { quote: { equals: quote.id } } });
  for (const contract of contracts.docs) {
    if (["draft", "issued"].includes(contract.status)) await payload.update({ collection: "contracts", id: contract.id, overrideAccess: true, data: { status: "revoked" } });
  }
  return payload.update({ collection: "quotes", id: quote.id, overrideAccess: true, data: { status: "revoked" } });
}
