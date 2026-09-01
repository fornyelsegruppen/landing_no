import type { Payload } from "payload";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";

export type CommercialPackageResult = {
  baseQuoteId: number;
  baseQuoteReference: string;
  recommendedQuoteId: number | null;
  recommendedQuoteReference: string | null;
};

export type CommercialPackageClaim =
  | { kind: "claimed"; jobId: number }
  | { kind: "completed"; result: CommercialPackageResult }
  | { kind: "processing" }
  | { kind: "failed" };

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function completedResult(value: unknown): CommercialPackageResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  const baseQuoteId = numberValue(result.baseQuoteId);
  const baseQuoteReference = textValue(result.baseQuoteReference);
  const recommendedQuoteId =
    result.recommendedQuoteId == null
      ? null
      : numberValue(result.recommendedQuoteId);
  const recommendedQuoteReference =
    result.recommendedQuoteReference == null
      ? null
      : textValue(result.recommendedQuoteReference);
  if (!baseQuoteId || !baseQuoteReference) return null;
  if (result.recommendedQuoteId != null && !recommendedQuoteId) return null;
  if (result.recommendedQuoteReference != null && !recommendedQuoteReference)
    return null;
  return {
    baseQuoteId,
    baseQuoteReference,
    recommendedQuoteId,
    recommendedQuoteReference,
  };
}

function jobId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value) {
    return numberValue((value as { id?: unknown }).id);
  }
  return null;
}

async function findRequest(payload: Payload, idempotencyKey: string) {
  const result = await payload.find({
    collection: "operational-jobs",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { idempotencyKey: { equals: idempotencyKey } },
  });
  return result.docs[0] ?? null;
}

function existingClaim(
  job: Awaited<ReturnType<typeof findRequest>>,
): CommercialPackageClaim {
  if (!job) throw new Error("Commercial package request is missing");
  if (job.status === "completed") {
    const result = completedResult(job.result);
    return result ? { kind: "completed", result } : { kind: "failed" };
  }
  if (["pending", "running", "retry"].includes(job.status)) {
    return { kind: "processing" };
  }
  return { kind: "failed" };
}

export async function claimCommercialPackageRequest(
  payload: Payload,
  input: {
    administratorId: number;
    correlationId: string;
    leadId: number;
    requestKey: string;
    now?: Date;
  },
): Promise<CommercialPackageClaim> {
  const idempotencyKey = makeIdempotencyKey("commercial.package-rebuild", {
    leadId: input.leadId,
    requestKey: input.requestKey,
  });
  const existing = await findRequest(payload, idempotencyKey);
  if (existing) return existingClaim(existing);

  const now = input.now ?? new Date();
  try {
    const created = await payload.create({
      collection: "operational-jobs",
      depth: 0,
      overrideAccess: true,
      data: {
        type: "commercial.package-rebuild",
        status: "running",
        idempotencyKey,
        correlationId: input.correlationId,
        attempts: 1,
        maxAttempts: 1,
        availableAt: now.toISOString(),
        startedAt: now.toISOString(),
        payload: {
          administratorId: input.administratorId,
          leadId: input.leadId,
        },
      },
    });
    const createdId = jobId(created);
    if (!createdId)
      throw new Error("Commercial package request lock has no ID");
    return { kind: "claimed", jobId: createdId };
  } catch (error) {
    const raced = await findRequest(payload, idempotencyKey);
    if (raced) return existingClaim(raced);
    throw error;
  }
}

export async function completeCommercialPackageRequest(
  payload: Payload,
  jobIdValue: number,
  result: CommercialPackageResult,
  now = new Date(),
) {
  await payload.update({
    collection: "operational-jobs",
    id: jobIdValue,
    depth: 0,
    overrideAccess: true,
    data: {
      status: "completed",
      completedAt: now.toISOString(),
      result,
    },
  });
}

export async function failCommercialPackageRequest(
  payload: Payload,
  jobIdValue: number,
  error: unknown,
) {
  const message = (
    error instanceof Error ? error.message : "Commercial package rebuild failed"
  )
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 500);
  await payload.update({
    collection: "operational-jobs",
    id: jobIdValue,
    depth: 0,
    overrideAccess: true,
    data: {
      status: "attention",
      lastErrorCode: "commercial_package_rebuild_failed",
      lastErrorMessage: message,
    },
  });
}
