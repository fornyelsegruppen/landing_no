import type { Payload } from "payload";
import {
  createOpaqueToken,
  hashOpaqueToken,
  verifyOpaqueToken,
} from "@/lib/security/opaque-token";

const PURPOSE = "manual-contact-recovery";
const TTL_MS = 7 * 24 * 60 * 60_000;

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  ) {
    return (value as { id: number }).id;
  }
  return undefined;
}

export function normalizeCommunicationEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function issueManualContactRecoveryToken(
  payload: Payload,
  messageId: number,
  metadata: Record<string, unknown> = {},
) {
  const created = createOpaqueToken({ purpose: PURPOSE, ttlMs: TTL_MS });
  await payload.update({
    collection: "access-tokens",
    overrideAccess: true,
    where: {
      and: [
        { purpose: { equals: PURPOSE } },
        { subjectType: { equals: "message" } },
        { subjectId: { equals: String(messageId) } },
        { revokedAt: { exists: false } },
      ],
    },
    data: { revokedAt: new Date().toISOString() },
  });
  const record = await payload.create({
    collection: "access-tokens",
    overrideAccess: true,
    data: {
      purpose: PURPOSE,
      tokenHash: created.stored.tokenHash,
      subjectType: "message",
      subjectId: String(messageId),
      expiresAt: created.stored.expiresAt,
      singleUse: true,
      metadata,
    },
  });
  return { token: created.plainText, record };
}

export async function resolveManualContactRecoveryToken(
  payload: Payload,
  token: string,
  now = new Date(),
) {
  if (!token || token.length < 32 || token.length > 200) return null;
  const tokenHash = hashOpaqueToken(PURPOSE, token);
  const result = await payload.find({
    collection: "access-tokens",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { purpose: { equals: PURPOSE } },
        { tokenHash: { equals: tokenHash } },
        { subjectType: { equals: "message" } },
      ],
    },
  });
  const record = result.docs[0];
  if (
    !record ||
    !verifyOpaqueToken(
      token,
      {
        purpose: record.purpose,
        tokenHash: record.tokenHash,
        expiresAt: record.expiresAt,
        revokedAt: record.revokedAt,
        usedAt: record.usedAt,
        singleUse: Boolean(record.singleUse),
      },
      now,
    )
  ) {
    return null;
  }
  const messageId = Number(record.subjectId);
  if (!Number.isSafeInteger(messageId) || messageId <= 0) return null;
  const sourceMessage = await payload.findByID({
    collection: "messages",
    id: messageId,
    depth: 0,
    overrideAccess: true,
  });
  const leadId = relationId(sourceMessage.lead);
  if (!leadId || sourceMessage.direction !== "outbound") return null;
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  return { record, sourceMessage, lead };
}

export function manualRecoveryState(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const analysis = value as Record<string, unknown>;
  if (!analysis.manualRecovery || typeof analysis.manualRecovery !== "object") {
    return {};
  }
  return analysis.manualRecovery as Record<string, unknown>;
}

export function withManualRecoveryState(
  value: unknown,
  patch: Record<string, unknown>,
) {
  const analysis =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    ...analysis,
    manualRecovery: {
      ...manualRecoveryState(analysis),
      ...patch,
    },
  };
}
