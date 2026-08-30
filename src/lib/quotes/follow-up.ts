import type { Payload } from "payload";
import { updateCaseState } from "@/lib/cases/case-command";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { deliverMessage } from "@/lib/messages/message-engine";
import { assertControlledPilotAutomationRecipientAllowed } from "@/lib/messages/automation-recipient-policy";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { siteConfig } from "@/lib/site";
import { automaticCommunicationIsPaused } from "@/lib/platform/operating-mode";
import {
  issueQuoteAccessToken,
  revokeQuoteAccessTokens,
} from "./customer-access";
import type { QuoteFollowUpPayload } from "./follow-up-schedule";

function parse(value: unknown): QuoteFollowUpPayload | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.quoteId !== "number" ||
    typeof item.leadId !== "number" ||
    typeof item.validUntil !== "string" ||
    !["reminder_1", "reminder_2", "expire"].includes(String(item.kind))
  )
    return null;
  return item as QuoteFollowUpPayload;
}

export async function processQuoteFollowUpJob(
  payload: Payload,
  raw: unknown,
  correlationId: string,
  now = new Date(),
) {
  if (automaticCommunicationIsPaused())
    return { skipped: true, reason: "automation-paused" };
  const input = parse(raw);
  if (!input) throw new TypeError("Quote follow-up job is invalid");
  const quote = await payload.findByID({
    collection: "quotes",
    id: input.quoteId,
    depth: 0,
    overrideAccess: true,
  });
  if (!["sent", "viewed"].includes(quote.status))
    return { skipped: true, reason: "quote-terminal" };
  if (quote.validUntil !== input.validUntil)
    return { skipped: true, reason: "quote-version-changed" };
  if (input.kind === "expire" || new Date(input.validUntil) <= now) {
    await revokeQuoteAccessTokens(payload, quote.id);
    await payload.update({
      collection: "quotes",
      id: quote.id,
      overrideAccess: true,
      data: { status: "expired" },
    });
    const contracts = await payload.find({
      collection: "contracts",
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: { quote: { equals: quote.id } },
    });
    for (const contract of contracts.docs)
      if (["draft", "issued"].includes(contract.status))
        await payload.update({
          collection: "contracts",
          id: contract.id,
          overrideAccess: true,
          data: { status: "revoked" },
        });
    await updateCaseState(payload, {
      leadId: input.leadId,
      command: "quote_expired",
      idempotencyKey: makeIdempotencyKey("quote.expired", {
        quoteId: quote.id,
        validUntil: input.validUntil,
      }),
      patch: {
        status: "contacted",
        nextActionOwner: "administrator",
        nextAction:
          "Tilbudet er utløpt uten svar. Velg ny versjon, manuell oppfølging eller avslutt saken.",
        nextActionAt: now.toISOString(),
      },
    });
    return { expired: true };
  }
  const lead = await payload.findByID({
    collection: "leads",
    id: input.leadId,
    depth: 0,
    overrideAccess: true,
  });
  if (!lead.email) throw new Error("Customer has no working email address");
  assertControlledPilotAutomationRecipientAllowed(
    lead.communicationEmail || lead.email,
  );
  const access = await issueQuoteAccessToken(
    payload,
    quote.id,
    quote.validUntil,
    { quoteVersion: quote.version },
  );
  const url = `${siteConfig.url.replace(/\/$/, "")}/tilbud/${access.token}`;
  const idempotencyKey = makeIdempotencyKey("quote.reminder-message", {
    quoteId: quote.id,
    kind: input.kind,
    validUntil: input.validUntil,
  });
  const existing = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { idempotencyKey: { equals: idempotencyKey } },
  });
  if (
    existing.docs[0] &&
    ["sent", "delivered"].includes(existing.docs[0].status)
  )
    return { duplicate: true, message: existing.docs[0] };
  const days = Math.max(
    1,
    Math.ceil(
      (new Date(input.validUntil).getTime() - now.getTime()) /
        (24 * 60 * 60_000),
    ),
  );
  const text = `Hei ${lead.name},\n\nDette er en vennlig påminnelse om tilbud ${quote.reference}. Tilbudet er fortsatt gyldig i ${days} dag${days === 1 ? "" : "er"}.\n\nÅpne den aktuelle versjonen her:\n${url}\n\nDu kan godta, stille spørsmål eller avslå direkte på siden. Vi sender ikke flere enn to automatiske påminnelser.\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}`;
  const message =
    existing.docs[0] ||
    (await payload.create({
      collection: "messages",
      overrideAccess: true,
      data: {
        lead: lead.id,
        direction: "outbound",
        category: "reminder",
        channel: "email",
        subject: `Påminnelse om tilbud ${quote.reference}`,
        bodyText: text,
        status: "approved",
        idempotencyKey,
        aiAssisted: false,
        approvedAt: now.toISOString(),
        aiAnalysis: { quoteId: quote.id, reminder: input.kind },
      },
    }));
  return {
    duplicate: false,
    message: (
      await deliverMessage(
        payload,
        createEmailProvider(),
        message.id,
        correlationId,
        "automation",
      )
    ).message,
  };
}
