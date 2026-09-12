import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import {
  assertFeatureReady,
  FeatureUnavailableError,
} from "@/lib/platform/features";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import {
  generateNextPayloadBlogDraft,
  refreshPayloadSearchSignals,
} from "@/lib/blog/payload-blog-engine";
import {
  seoDraftDue,
  seoDraftIdempotencyKey,
  seoDraftSlot,
  seoWeekKey,
} from "@/lib/blog/schedule";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { seoExecutorRequestAllowed } from "@/lib/blog/automation-policy";
import { GoogleSearchConsoleProvider } from "@/lib/providers/google-search-console-provider";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const correlationId = correlationIdFromHeaders(request.headers);
  const now = new Date();
  const deadline = Date.now() + 55_000;
  try {
    assertFeatureReady("seoScheduler");
    assertFeatureReady("aiDrafts");
    if (!seoExecutorRequestAllowed(request))
      return NextResponse.json(
        { error: "wrong_executor_target" },
        { status: 503 },
      );
    if (process.env.VERCEL_ENV !== "preview" && !seoDraftDue(now))
      return NextResponse.json({ ok: true, outcome: "outside_slot" });
    const payload = await getPayload();
    const result = await generateNextPayloadBlogDraft({
      payload,
      deadline,
      provider: {
        health: () => new GeminiAiProvider().health(),
        generate: (input) => {
          const remaining = deadline - Date.now() - 8_000;
          if (remaining < 5_000)
            throw new TypeError("Insufficient draft execution time");
          return new GeminiAiProvider(
            process.env,
            fetch,
            Math.min(35_000, remaining),
          ).generate(input);
        },
      },
      refreshSignals: async () => {
        const source = new GoogleSearchConsoleProvider();
        const property =
          process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || null;
        const provenance = {
          kind: "seo-source-refresh-v1",
          source: "search-console",
          property,
        };
        const signalRun = await payload.create({
          collection: "seo-runs",
          overrideAccess: true,
          data: {
            idempotencyKey: `seo-signals:${randomUUID()}`,
            jobType: "blog.signals.refresh",
            triggerSource: "cron",
            status: "running",
            startedAt: now.toISOString(),
            qualityResult: provenance,
          },
        });
        try {
          if (source.health().status !== "ready")
            throw new TypeError("Search Console configuration required");
          const observation = await source.listSignalRefresh(
            now,
            AbortSignal.timeout(12_000),
          );
          const imported = await refreshPayloadSearchSignals(
            payload,
            observation.current.signals,
            now,
            Math.min(deadline - 15_000, Date.now() + 8_000),
            observation.baseline,
          );
          await payload.update({
            collection: "seo-runs",
            id: signalRun.id,
            overrideAccess: true,
            data: {
              status: "completed",
              finishedAt: new Date().toISOString(),
              qualityResult: {
                ...provenance,
                access: "verified",
                observationStatus: observation.current.status,
                periodStart: observation.current.periodStart,
                periodEnd: observation.current.periodEnd,
                baselineObservationStatus: observation.baseline.status,
                baselinePeriodStart: observation.baseline.periodStart,
                baselinePeriodEnd: observation.baseline.periodEnd,
                geography: observation.geography,
                ...imported,
              },
            },
          });
        } catch (error) {
          await payload.update({
            collection: "seo-runs",
            id: signalRun.id,
            overrideAccess: true,
            data: {
              status: "failed",
              finishedAt: new Date().toISOString(),
              qualityResult: { ...provenance, access: "failed" },
              errorCode:
                source.health().status === "ready"
                  ? "SOURCE_ACCESS_OR_TIMEOUT"
                  : "SOURCE_CONFIGURATION_REQUIRED",
            },
          });
          throw error;
        }
      },
      idempotencyKey: seoDraftIdempotencyKey(now),
      correlationId,
      triggerSource: "cron",
      weekKey: seoWeekKey(now),
      slot: seoDraftSlot(now),
    });
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      outcome: result.duplicate ? result.outcome : "created",
      runId: result.run.id,
      postId: result.duplicate ? undefined : result.post.id,
    });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: error.reason, missing: error.unavailable },
        { status: 503 },
      );
    }
    captureException(error, {
      route: "GET /api/cron/seo-drafts",
      correlationId,
    });
    return NextResponse.json(
      { error: "SEO draft job failed", correlationId },
      { status: 500 },
    );
  }
}
