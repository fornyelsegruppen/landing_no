import { createHash } from "node:crypto";
import type { Payload } from "payload";

export const prod84NoSendUatMode = "prod8-4-no-send";

const probePattern = /^[A-Za-z0-9_-]{12,80}$/;

type ProbeResult = {
  duplicate: boolean;
  probeId: number;
};

function probeDigest(probe: string) {
  return createHash("sha256").update(probe).digest("hex");
}

function idempotencyKeyForProbe(probe: string) {
  return `uat.prod8-4.no-send:${probeDigest(probe)}`;
}

export function validProd84NoSendProbe(probe: string | null): probe is string {
  return Boolean(probe && probePattern.test(probe));
}

async function findExistingProbe(payload: Payload, idempotencyKey: string) {
  const existing = await payload.find({
    collection: "operational-jobs",
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { idempotencyKey: { equals: idempotencyKey } },
  });
  return existing.docs[0] || null;
}

/**
 * Records an idempotent Preview UAT marker without enqueueing or processing a
 * deliverable job. The raw probe is never persisted.
 */
export async function recordProd84NoSendProbe(
  payload: Payload,
  probe: string,
  now = new Date(),
): Promise<ProbeResult> {
  if (!validProd84NoSendProbe(probe)) {
    throw new TypeError("Invalid PROD-8.4 no-send probe");
  }

  const digest = probeDigest(probe);
  const idempotencyKey = idempotencyKeyForProbe(probe);
  const existing = await findExistingProbe(payload, idempotencyKey);
  if (existing) return { duplicate: true, probeId: Number(existing.id) };

  const timestamp = now.toISOString();
  try {
    const created = await payload.create({
      collection: "operational-jobs",
      depth: 0,
      overrideAccess: true,
      data: {
        type: "uat.no-send",
        status: "completed",
        idempotencyKey,
        correlationId: `uat-prod8-4-${digest.slice(0, 16)}`,
        attempts: 1,
        maxAttempts: 1,
        availableAt: timestamp,
        startedAt: timestamp,
        completedAt: timestamp,
        payload: { probeType: prod84NoSendUatMode },
        result: { noSend: true, probeDigest: digest },
      },
    });
    return { duplicate: false, probeId: Number(created.id) };
  } catch (error) {
    const winner = await findExistingProbe(payload, idempotencyKey);
    if (!winner) throw error;
    return { duplicate: true, probeId: Number(winner.id) };
  }
}
