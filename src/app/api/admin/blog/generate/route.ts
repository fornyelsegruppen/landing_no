import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { ensureManualBlogTopics, generateNextPayloadBlogDraft } from "@/lib/blog/payload-blog-engine";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await ensureManualBlogTopics(payload);
    assertFeatureReady("aiDrafts");
    const result = await generateNextPayloadBlogDraft({
      payload,
      provider: new GeminiAiProvider(),
      idempotencyKey: `seo-manual:${randomUUID()}`,
      correlationId,
      triggerSource: "manual",
    });
    return NextResponse.json(
      {
        ok: true,
        duplicate: result.duplicate,
        runId: result.run.id,
        postId: result.duplicate ? undefined : result.post.id,
      },
      { headers: { "Cache-Control": "no-store", "x-correlation-id": correlationId } },
    );
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: error.reason, missing: error.unavailable },
        { status: 503 },
      );
    }
    captureException(error, { route: "POST /api/admin/blog/generate", correlationId });
    return NextResponse.json({ error: "Draft generation failed", correlationId }, { status: 422 });
  }
}
