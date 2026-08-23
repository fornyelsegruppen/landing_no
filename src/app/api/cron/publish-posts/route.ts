import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { assertBlogAction } from "@/lib/blog/transitions";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    assertFeatureReady("seoScheduler");
    const payload = await getPayload();
    const now = new Date();
    const scheduled = await payload.find({
      collection: "posts",
      depth: 0,
      draft: true,
      limit: 10,
      overrideAccess: true,
      where: {
        and: [
          { _status: { equals: "draft" } },
          { editorialStatus: { equals: "scheduled" } },
          { scheduledAt: { less_than_equal: now.toISOString() } },
        ],
      },
    });
    const published: Array<string | number> = [];
    const attention: Array<string | number> = [];
    for (const post of scheduled.docs) {
      try {
        assertBlogAction(
          {
            status: "scheduled",
            reviewerName: post.reviewerName,
            reviewedAt: post.reviewedAt,
          },
          "publish",
        );
        await payload.update({
          collection: "posts",
          id: post.id,
          draft: false,
          overrideAccess: true,
          data: { _status: "published" },
        });
        published.push(post.id);
      } catch {
        attention.push(post.id);
      }
    }
    return NextResponse.json({ ok: true, published, attention });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    }
    captureException(error, { route: "GET /api/cron/publish-posts" });
    return NextResponse.json({ error: "Publishing job failed" }, { status: 500 });
  }
}
