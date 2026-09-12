import type { Payload } from "payload";
import type { SeoRun } from "@/payload/payload-types";
import { withSeoPayloadTransaction } from "./post-write-transaction";

export type RunPhase = "claimed" | "signals" | "provider";
export function runAttempt(run: SeoRun) {
  const value = run.qualityResult;
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.kind === "seo-orchestration-v1" &&
    typeof value.attempt === "number"
  )
    return value.attempt;
  return 1;
}

export async function claimSeoRun(
  payload: Payload,
  input: {
    idempotencyKey: string;
    triggerSource: "manual" | "cron" | "regenerate";
    weekKey?: string;
    slot?: string;
  },
  now = new Date(),
) {
  return withSeoPayloadTransaction(payload, async (scoped) => {
    const prior = await scoped.find({
      collection: "seo-runs",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { idempotencyKey: { equals: input.idempotencyKey } },
    });
    const run = prior.docs[0];
    if (run) {
      const recovered = await scoped.find({
        collection: "posts",
        depth: 0,
        draft: true,
        limit: 1,
        overrideAccess: true,
        where: { aiGenerationRun: { equals: run.id } },
      });
      if (recovered.docs[0] && run.status !== "completed") {
        const post = recovered.docs[0];
        const completed = await scoped.update({
          collection: "seo-runs",
          id: run.id,
          overrideAccess: true,
          data: {
            status: "completed",
            createdPost: post.id,
            finishedAt: now.toISOString(),
            errorCode: null,
          },
        });
        return {
          claimed: false as const,
          run: completed,
          outcome: "recovered",
        };
      }
      const elapsed =
        now.getTime() - new Date(run.finishedAt || run.startedAt).getTime();
      if (
        run.status === "failed" &&
        run.errorCode === "PRE_PROVIDER_RETRY" &&
        elapsed >= 15 * 60_000 &&
        runAttempt(run) < 3
      ) {
        const retry = await scoped.update({
          collection: "seo-runs",
          id: run.id,
          overrideAccess: true,
          data: {
            status: "running",
            startedAt: now.toISOString(),
            finishedAt: null,
            errorCode: null,
            qualityResult: {
              kind: "seo-orchestration-v1",
              phase: "claimed",
              attempt: runAttempt(run) + 1,
            },
          },
        });
        return { claimed: true as const, run: retry, outcome: "retry" };
      }
      if (run.status === "running" && elapsed > 5 * 60_000) {
        const attention = await scoped.update({
          collection: "seo-runs",
          id: run.id,
          overrideAccess: true,
          data: {
            status: "attention",
            finishedAt: now.toISOString(),
            errorCode: "UNKNOWN_PREVIOUS_OUTCOME",
          },
        });
        return {
          claimed: false as const,
          run: attention,
          outcome: "attention",
        };
      }
      return {
        claimed: false as const,
        run,
        outcome: run.status === "running" ? "busy" : run.status,
      };
    }
    const created = await scoped.create({
      collection: "seo-runs",
      overrideAccess: true,
      data: {
        idempotencyKey: input.idempotencyKey,
        triggerSource: input.triggerSource,
        weekKey: input.weekKey,
        slot: input.slot,
        jobType: "blog.article.draft",
        status: "running",
        startedAt: now.toISOString(),
        qualityResult: {
          kind: "seo-orchestration-v1",
          phase: "claimed",
          attempt: 1,
        },
      },
    });
    return { claimed: true as const, run: created, outcome: "claimed" };
  });
}

export async function markSeoRunFailure(
  payload: Payload,
  run: SeoRun,
  phase: RunPhase,
  quality?: unknown,
) {
  const safeRetry = phase !== "provider" && runAttempt(run) < 3;
  return payload.update({
    collection: "seo-runs",
    id: run.id,
    overrideAccess: true,
    data: {
      status: safeRetry ? "failed" : "attention",
      finishedAt: new Date().toISOString(),
      errorCode: safeRetry ? "PRE_PROVIDER_RETRY" : "REVIEW_REQUIRED",
      errorMessage:
        "SEO job requires a retry or operator review; no article was published.",
      qualityResult: {
        kind: "seo-orchestration-v1",
        attempt: runAttempt(run),
        phase,
        ...(quality ? { quality: quality as object } : {}),
      },
    },
  });
}
