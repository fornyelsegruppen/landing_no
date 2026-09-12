import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import {
  enabled,
  seoExecutorRequestAllowed,
} from "@/lib/blog/automation-policy";
import { publishDueBlogPosts } from "@/lib/blog/scheduled-publisher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !enabled(process.env.FEATURE_SEO_AUTO_PUBLISH) ||
    !enabled(process.env.FEATURE_SEO_SCHEDULER)
  ) {
    return NextResponse.json(
      { error: "disabled", feature: "seoAutoPublish" },
      { status: 503 },
    );
  }
  if (!seoExecutorRequestAllowed(request))
    return NextResponse.json(
      { error: "wrong_executor_target" },
      { status: 503 },
    );
  try {
    const payload = await getPayload();
    const now = new Date();
    const run = await payload.create({
      collection: "seo-runs",
      overrideAccess: true,
      data: {
        idempotencyKey: `seo-publish:${randomUUID()}`,
        jobType: "blog.approved.publish",
        triggerSource: "cron",
        status: "running",
        startedAt: now.toISOString(),
      },
    });
    try {
      const result = await publishDueBlogPosts(payload, now);
      await payload.update({
        collection: "seo-runs",
        id: run.id,
        overrideAccess: true,
        data: {
          status: result.attention.length ? "attention" : "completed",
          finishedAt: new Date().toISOString(),
          qualityResult: { kind: "seo-publisher-v1", ...result },
          errorCode: result.attention.length ? "POST_RECHECK_REQUIRED" : null,
        },
      });
      return NextResponse.json({ ok: true, runId: run.id, ...result });
    } catch (error) {
      await payload.update({
        collection: "seo-runs",
        id: run.id,
        overrideAccess: true,
        data: {
          status: "failed",
          finishedAt: new Date().toISOString(),
          errorCode: "PUBLISH_JOB_FAILED",
        },
      });
      throw error;
    }
  } catch (error) {
    captureException(error, { route: "GET /api/cron/publish-posts" });
    return NextResponse.json(
      { error: "Publishing job failed" },
      { status: 500 },
    );
  }
}
