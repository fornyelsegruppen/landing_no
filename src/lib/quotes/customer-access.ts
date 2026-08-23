import type { Payload } from "payload";
import { createOpaqueToken, hashOpaqueToken, verifyOpaqueToken } from "@/lib/security/opaque-token";

const PURPOSE = "quote-customer-access";

export async function issueQuoteAccessToken(payload: Payload, quoteId: number, expiresAt: string, metadata: Record<string, unknown> = {}) {
  const ttlMs = new Date(expiresAt).getTime() - Date.now();
  const created = createOpaqueToken({ purpose: PURPOSE, ttlMs });
  await payload.update({ collection: "access-tokens", overrideAccess: true, where: {
    and: [{ purpose: { equals: PURPOSE } }, { subjectType: { equals: "quote" } }, { subjectId: { equals: String(quoteId) } }, { revokedAt: { exists: false } }],
  }, data: { revokedAt: new Date().toISOString() } });
  const stored = await payload.create({ collection: "access-tokens", overrideAccess: true, data: {
    purpose: PURPOSE, tokenHash: created.stored.tokenHash, subjectType: "quote", subjectId: String(quoteId),
    expiresAt: created.stored.expiresAt, singleUse: false, metadata,
  } });
  return { token: created.plainText, record: stored };
}

export async function resolveQuoteAccessToken(payload: Payload, token: string, now = new Date()) {
  if (!token || token.length < 32 || token.length > 200) return null;
  const hash = hashOpaqueToken(PURPOSE, token);
  const result = await payload.find({ collection: "access-tokens", depth: 0, limit: 1, overrideAccess: true, where: {
    and: [{ purpose: { equals: PURPOSE } }, { tokenHash: { equals: hash } }, { subjectType: { equals: "quote" } }],
  } });
  const record = result.docs[0];
  if (!record || !verifyOpaqueToken(token, { purpose: record.purpose, tokenHash: record.tokenHash, expiresAt: record.expiresAt, revokedAt: record.revokedAt, usedAt: record.usedAt, singleUse: Boolean(record.singleUse) }, now)) return null;
  const quoteId = Number(record.subjectId);
  if (!Number.isSafeInteger(quoteId) || quoteId <= 0) return null;
  return { record, quoteId };
}

export async function revokeQuoteAccessTokens(payload: Payload, quoteId: number) {
  return payload.update({ collection: "access-tokens", overrideAccess: true, where: {
    and: [{ purpose: { equals: PURPOSE } }, { subjectType: { equals: "quote" } }, { subjectId: { equals: String(quoteId) } }, { revokedAt: { exists: false } }],
  }, data: { revokedAt: new Date().toISOString() } });
}
