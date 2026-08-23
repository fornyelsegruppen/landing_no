import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { generateNextPayloadBlogDraft } from "@/lib/blog/payload-blog-engine";
import { seoDraftIdempotencyKey, seoDraftSlot, seoWeekKey } from "@/lib/blog/schedule";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const correlationId = correlationIdFromHeaders(request.headers);
  const now = new Date();
  try {
    assertFeatureReady("seoScheduler");
    const result = await generateNextPayloadBlogDraft({
      payload: await getPayload(),
      provider: new GeminiAiProvider(),
      idempotencyKey: seoDraftIdempotencyKey(now),
      correlationId,
      triggerSource: "cron",
      weekKey: seoWeekKey(now),
      slot: seoDraftSlot(now),
    });
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      runId: result.run.id,
      postId: result.duplicate ? undefined : result.post.id,
    });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    }
    captureException(error, { route: "GET /api/cron/seo-drafts", correlationId });
    return NextResponse.json({ error: "SEO draft job failed", correlationId }, { status: 500 });
  }
}
