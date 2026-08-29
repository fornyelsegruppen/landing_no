import type { Payload } from "payload";
import { resolveQuoteAccessToken } from "@/lib/quotes/customer-access";
import type { CustomerReplySourceBundle } from "./customer-reply-sources";

const customerQuoteLinkPattern = /https:\/\/[^\s<>"']+/g;

export class CustomerSecureLinkUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerSecureLinkUnavailableError";
  }
}

function sourceQuoteId(bundle: CustomerReplySourceBundle) {
  const quote = bundle.snapshot.quote;
  if (!quote || typeof quote !== "object" || !("id" in quote)) return null;
  const id = (quote as { id?: unknown }).id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function quoteTokenFromUrl(value: string) {
  const raw = value.replace(/[),.;!?]+$/, "");
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    const trustedHost =
      hostname === "takfornyelse.as" ||
      hostname === "www.takfornyelse.as" ||
      hostname.endsWith(".vercel.app");
    const match = parsed.pathname.match(/^\/tilbud\/([^/]+)\/?$/);
    if (parsed.protocol !== "https:" || !trustedHost || !match?.[1]) {
      return null;
    }
    return {
      token: decodeURIComponent(match[1]),
      url: raw,
    };
  } catch {
    return null;
  }
}

export async function findCurrentSecureQuoteUrl(
  payload: Payload,
  input: {
    leadId: number;
    sources: CustomerReplySourceBundle;
  },
) {
  const quoteId = sourceQuoteId(input.sources);
  if (!quoteId) {
    throw new CustomerSecureLinkUnavailableError(
      "The customer question is not bound to a quote version. Create a new reply draft before sending.",
    );
  }

  const messages = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 100,
    sort: "-createdAt",
    overrideAccess: true,
    pagination: false,
    where: {
      and: [
        { lead: { equals: input.leadId } },
        { direction: { equals: "outbound" } },
        { channel: { equals: "email" } },
        { category: { in: ["quote", "reminder", "contract"] } },
        { status: { in: ["sent", "delivered"] } },
      ],
    },
  });

  for (const message of messages.docs) {
    const urls = message.bodyText.match(customerQuoteLinkPattern) || [];
    for (const value of urls) {
      const candidate = quoteTokenFromUrl(value);
      if (!candidate) continue;
      const access = await resolveQuoteAccessToken(payload, candidate.token);
      if (access?.quoteId === quoteId) return candidate.url;
    }
  }

  throw new CustomerSecureLinkUnavailableError(
    "No current secure customer link is available for this quote version. Reissue the customer link before sending the reply.",
  );
}

export function appendSecureQuoteCallToAction(bodyText: string, url: string) {
  const normalized = bodyText.trim();
  if (normalized.includes(url)) return normalized;
  return `${normalized}\n\nÅpne tilbudet og fortsett på din sikre kundeside:\n${url}`;
}

export async function customerQuestionReplyEmailText(
  payload: Payload,
  input: {
    bodyText: string;
    leadId: number;
    sources: CustomerReplySourceBundle;
  },
) {
  const url = await findCurrentSecureQuoteUrl(payload, input);
  return appendSecureQuoteCallToAction(input.bodyText, url);
}
