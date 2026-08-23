import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { GoogleSearchConsoleProvider } from "@/lib/providers/google-search-console-provider";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const provider = new GoogleSearchConsoleProvider();
    if (provider.health().status !== "ready") {
      return NextResponse.json({ error: "Search Console requires configuration" }, { status: 503 });
    }
    const metrics = await provider.listPagePerformance();
    const posts = await payload.find({
      collection: "posts",
      depth: 0,
      limit: 50,
      pagination: false,
      overrideAccess: true,
      where: { _status: { equals: "published" } },
    });
    const now = new Date().toISOString();
    let updated = 0;
    for (const post of posts.docs) {
      const metric = metrics.find((item) => {
        try {
          return new URL(item.url).pathname.replace(/\/$/, "").endsWith(`/blogg/${post.slug}`);
        } catch {
          return false;
        }
      });
      const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.takfornyelse.as"}/no/blogg/${post.slug}`;
      const inspection = await provider.inspectUrl(publicUrl);
      if (!metric && !inspection) continue;
      await payload.update({
        collection: "posts",
        id: post.id,
        draft: true,
        overrideAccess: true,
        data: {
          searchPerformance: {
            impressions: metric?.impressions || 0,
            clicks: metric?.clicks || 0,
            ctr: Number(((metric?.ctr || 0) * 100).toFixed(2)),
            averagePosition: Number((metric?.position || 0).toFixed(2)),
            updatedAt: now,
            ...(inspection?.verdict ? { indexVerdict: inspection.verdict } : {}),
            ...(inspection?.coverageState ? { coverageState: inspection.coverageState } : {}),
            ...(inspection?.lastCrawlTime ? { lastCrawlAt: inspection.lastCrawlTime } : {}),
          },
        },
      });
      updated += 1;
    }
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    captureException(error, { route: "POST /api/admin/blog/performance" });
    return NextResponse.json({ error: "Performance refresh failed" }, { status: 500 });
  }
}
