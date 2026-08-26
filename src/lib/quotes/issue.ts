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
  const siblingId = typeof quote.siblingQuote === "number" ? quote.siblingQuote : quote.siblingQuote?.id;
  const sibling = siblingId ? await payload.findByID({ collection: "quotes", id: siblingId, depth: 0, overrideAccess: true }) : null;
  if (sibling && !["approved", "sent", "viewed"].includes(sibling.status)) throw new Error("The alternative quote must also be approved");
  const contracts = await payload.find({ collection: "contracts", depth: 0, limit: 1, overrideAccess: true, where: { quote: { equals: quote.id } } });
  const contract = contracts.docs[0];
  if (!contract || !["draft", "issued"].includes(contract.status)) throw new Error("A valid contract draft is required");
  const access = await issueQuoteAccessToken(payload, quote.id, quote.validUntil, { contractId: contract.id, quoteVersion: quote.version });
  if (contract.status === "draft") await payload.update({ collection: "contracts", id: contract.id, overrideAccess: true, data: { status: "issued" } });
  const url = `${siteConfig.url.replace(/\/$/, "")}/tilbud/${access.token}`;
  const display = quoteDisplayModel(quote.snapshot);
  const isRevisedQuote = Boolean(
    typeof quote.supersedes === "number" || quote.supersedes?.id,
  );
  let alternative: { quote: typeof quote; contract: typeof contract; url: string; accessRecordId: number } | null = null;
  if (sibling) {
    const siblingContracts = await payload.find({ collection: "contracts", depth: 0, limit: 1, overrideAccess: true, where: { quote: { equals: sibling.id } } });
    const siblingContract = siblingContracts.docs[0];
    if (!siblingContract || !["draft", "issued"].includes(siblingContract.status)) throw new Error("A valid alternative contract draft is required");
    const siblingAccess = await issueQuoteAccessToken(payload, sibling.id, sibling.validUntil, { contractId: siblingContract.id, quoteVersion: sibling.version });
    if (siblingContract.status === "draft") await payload.update({ collection: "contracts", id: siblingContract.id, overrideAccess: true, data: { status: "issued" } });
    alternative = { quote: sibling, contract: siblingContract, url: `${siteConfig.url.replace(/\/$/, "")}/tilbud/${siblingAccess.token}`, accessRecordId: siblingAccess.record.id };
  }
  const displays = [{ quote, display, url }, ...(alternative ? [{ quote: alternative.quote, display: quoteDisplayModel(alternative.quote.snapshot), url: alternative.url }] : [])]
    .sort((left, right) => left.quote.optionKind === "base" ? -1 : right.quote.optionKind === "base" ? 1 : 0);
  const optionLines = displays.flatMap((item, index) => [
    `${index + 1}. ${isRevisedQuote ? "Oppdatert forslag" : item.quote.optionKind === "recommended" ? "Anbefalt alternativ" : "Opprinnelig forespørsel"}: ${item.display.service}`,
    `Pris inkludert mva.: ${item.display.totalIncVatNok.toLocaleString("nb-NO", { minimumFractionDigits: 2 })} kr.`,
    `Åpne, kontroller og velg dette alternativet: ${item.url}`,
    "",
  ]);
  const body = [
    `Hei ${lead.name},`, "",
    isRevisedQuote
      ? `Vi har laget et oppdatert tilbud ${quote.reference} basert på endringen du ba om. Den tidligere avtalen endres ikke før du eventuelt godkjenner og signerer den nye versjonen.`
      : displays.length > 1
        ? "Vi har laget to tydelige alternativer. Velg bare det alternativet du ønsker å signere."
        : `Tilbud ${quote.reference} for ${display.service} er klart.`,
    "", ...optionLines,
    `Lenken er personlig og gyldig til ${new Date(quote.validUntil).toLocaleDateString("nb-NO")}.`,
    "", "Vennlig hilsen", "Takfornyelse", siteConfig.phone,
  ].filter((line): line is string => line !== null).join("\n");
  const message = await payload.create({ collection: "messages", overrideAccess: true, data: {
    lead: lead.id, direction: "outbound", category: "quote", channel: "email",
    subject: `Tilbud ${quote.reference} fra Takfornyelse`, bodyText: body, status: "draft",
    idempotencyKey: makeIdempotencyKey("quote.issue", { quoteId: quote.id, accessTokenId: access.record.id, alternativeAccessTokenId: alternative?.accessRecordId }),
    aiAssisted: false, aiAnalysis: { quoteId: quote.id, contractId: contract.id, accessTokenId: access.record.id, alternativeQuoteId: alternative?.quote.id, alternativeContractId: alternative?.contract.id, alternativeAccessTokenId: alternative?.accessRecordId },
  } });
  return { quote, contract, alternative, message, url };
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
