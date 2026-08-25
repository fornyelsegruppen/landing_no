import type { Payload } from "payload";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { featureReadiness } from "@/lib/platform/features";

export type QuoteFollowUpKind = "reminder_1" | "reminder_2" | "expire";
export type QuoteFollowUpPayload = { quoteId: number; leadId: number; kind: QuoteFollowUpKind; validUntil: string };

async function createJob(payload: Payload, input: QuoteFollowUpPayload, availableAt: Date, correlationId: string) {
  const idempotencyKey = makeIdempotencyKey("quote.follow-up", input);
  const existing = await payload.find({ collection: "operational-jobs", depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: idempotencyKey } } });
  if (existing.docs[0]) return existing.docs[0];
  return payload.create({ collection: "operational-jobs", overrideAccess: true, data: { type: "quote.follow-up", status: "pending", idempotencyKey, correlationId, attempts: 0, maxAttempts: 3, availableAt: availableAt.toISOString(), payload: input } });
}

export async function enqueueQuoteFollowUps(payload: Payload, input: { quoteId: number; leadId: number; validUntil: string }, correlationId: string, now = new Date()) {
  if (!featureReadiness("communicationRoutingV2").ready) return { created: 0, skipped: true as const };
  const validUntil = new Date(input.validUntil);
  if (Number.isNaN(validUntil.getTime()) || validUntil <= now) return { created: 0 };
  const plans: Array<[QuoteFollowUpKind, Date]> = [
    ["reminder_1", new Date(Math.min(now.getTime() + 3 * 24 * 60 * 60_000, validUntil.getTime() - 4 * 24 * 60 * 60_000))],
    ["reminder_2", new Date(validUntil.getTime() - 24 * 60 * 60_000)],
    ["expire", validUntil],
  ].filter(([, at]) => at > now) as Array<[QuoteFollowUpKind, Date]>;
  for (const [kind, at] of plans) await createJob(payload, { ...input, kind }, at, correlationId);
  return { created: plans.length, skipped: false as const };
}
