import type { Payload } from "payload";
import { createOpaqueToken, hashOpaqueToken, verifyOpaqueToken } from "@/lib/security/opaque-token";

const PURPOSE = "change-agreement-customer-access";

export async function issueChangeAccessToken(payload: Payload, agreementId: number, expiresAt: string) {
  const token = createOpaqueToken({ purpose: PURPOSE, ttlMs: new Date(expiresAt).getTime() - Date.now() });
  await payload.update({ collection: "access-tokens", overrideAccess: true, where: { and: [
    { purpose: { equals: PURPOSE } }, { subjectType: { equals: "change-agreement" } }, { subjectId: { equals: String(agreementId) } }, { revokedAt: { exists: false } },
  ] }, data: { revokedAt: new Date().toISOString() } });
  const record = await payload.create({ collection: "access-tokens", overrideAccess: true, data: { purpose: PURPOSE, tokenHash: token.stored.tokenHash, subjectType: "change-agreement", subjectId: String(agreementId), expiresAt: token.stored.expiresAt, singleUse: false } });
  return { token: token.plainText, record };
}

export async function resolveChangeAccessToken(payload: Payload, plainText: string, now = new Date()) {
  if (!plainText || plainText.length < 32 || plainText.length > 200) return null;
  const hash = hashOpaqueToken(PURPOSE, plainText);
  const result = await payload.find({ collection: "access-tokens", depth: 0, limit: 1, overrideAccess: true, where: { and: [
    { purpose: { equals: PURPOSE } }, { tokenHash: { equals: hash } }, { subjectType: { equals: "change-agreement" } },
  ] } });
  const record = result.docs[0];
  if (!record || !verifyOpaqueToken(plainText, { purpose: record.purpose, tokenHash: record.tokenHash, expiresAt: record.expiresAt, revokedAt: record.revokedAt, usedAt: record.usedAt, singleUse: Boolean(record.singleUse) }, now)) return null;
  const agreementId = Number(record.subjectId);
  return Number.isSafeInteger(agreementId) && agreementId > 0 ? { record, agreementId } : null;
}
