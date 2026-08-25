import { createHmac, timingSafeEqual } from "node:crypto";

function tokenFor(leadId: number, secret: string) {
  return createHmac("sha256", secret).update(`lead-reply:${leadId}`).digest("hex").slice(0, 24);
}

export function caseReplyAddress(leadId: number, environment: Readonly<Record<string, string | undefined>> = process.env) {
  const domain = environment.RESEND_INBOUND_DOMAIN?.trim().replace(/^@/, "");
  const secret = environment.CUSTOMER_TOKEN_SECRET || environment.PAYLOAD_SECRET;
  if (!domain || !secret || secret.length < 32) return null;
  return `sak-${leadId}-${tokenFor(leadId, secret)}@${domain}`;
}

export function leadIdFromCaseReply(recipients: string[], environment: Readonly<Record<string, string | undefined>> = process.env) {
  const domain = environment.RESEND_INBOUND_DOMAIN?.trim().replace(/^@/, "").toLowerCase();
  const secret = environment.CUSTOMER_TOKEN_SECRET || environment.PAYLOAD_SECRET;
  if (!domain || !secret || secret.length < 32) return null;
  for (const recipient of recipients) {
    const match = recipient.trim().toLowerCase().match(new RegExp(`^sak-(\\d+)-([a-f0-9]{24})@${domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    if (!match) continue;
    const leadId = Number(match[1]);
    const expected = Buffer.from(tokenFor(leadId, secret));
    const actual = Buffer.from(match[2]);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return leadId;
  }
  return null;
}

export function bareEmail(value: string) {
  const match = value.trim().toLowerCase().match(/<([^<>]+)>$/);
  return (match?.[1] || value.trim()).toLowerCase();
}
