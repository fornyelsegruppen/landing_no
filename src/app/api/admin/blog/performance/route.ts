import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { GoogleSearchConsoleProvider } from "@/lib/providers/google-search-console-provider";
import { userIsAdmin } from "@/payload/access/roles";
import { recommendContentAudit } from "@/lib/blog/content-audit";
import { articleLeadMetrics } from "@/lib/blog/article-attribution";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const provider = new GoogleSearchConsoleProvider();
    const searchReady = provider.health().status === "ready";
    let searchConsole: "updated" | "configuration_required" | "degraded" = searchReady ? "updated" : "configuration_required";
    let metrics: Awaited<ReturnType<GoogleSearchConsoleProvider["listPagePerformance"]>> = [];
    if (searchReady) {
      try { metrics = await provider.listPagePerformance(); }
      catch (error) { searchConsole = "degraded"; captureException(error, { route: "POST /api/admin/blog/performance", operation: "search-performance", correlationId }); }
    }
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [posts, recentLeads] = await Promise.all([payload.find({
      collection: "posts",
      depth: 0,
      limit: 10,
      pagination: false,
      sort: "lastContentAuditAt",
      overrideAccess: true,
      where: { _status: { equals: "published" } },
    }), payload.find({ collection: "leads", depth: 0, limit: 1000, pagination: false, overrideAccess: true, where: { createdAt: { greater_than_equal: ninetyDaysAgo } } })]);
    const now = new Date().toISOString();
    let updated = 0;
    let leadsAttributed = 0;
    let inspectionFailures = 0;
    const inspections = new Map<number, Awaited<ReturnType<GoogleSearchConsoleProvider["inspectUrl"]>>>();
    if (searchReady && searchConsole !== "degraded") {
      await Promise.all(posts.docs.map(async (post) => {
        const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.takfornyelse.as"}/no/blogg/${post.slug}`;
        try { inspections.set(post.id, await provider.inspectUrl(publicUrl)); }
        catch (error) { inspectionFailures += 1; captureException(error, { route: "POST /api/admin/blog/performance", operation: "url-inspection", postId: post.id, correlationId }); }
      }));
    }
    for (const post of posts.docs) {
      const leadMetrics = articleLeadMetrics(recentLeads.docs, post.slug);
      leadsAttributed += leadMetrics.leads;
      const metric = metrics.find((item) => {
        try {
          return new URL(item.url).pathname.replace(/\/$/, "").endsWith(`/blogg/${post.slug}`);
        } catch {
          return false;
        }
      });
      const inspection = inspections.get(post.id) ?? null;
      const previous = post.searchPerformance || {};
      const impressions = metric?.impressions ?? previous.impressions ?? 0;
      const clicks = metric?.clicks ?? previous.clicks ?? 0;
      const ctr = metric ? Number((metric.ctr * 100).toFixed(2)) : previous.ctr ?? 0;
      const averagePosition = metric ? Number(metric.position.toFixed(2)) : previous.averagePosition ?? 0;
      const indexVerdict = inspection?.verdict ?? previous.indexVerdict;
      const audit = recommendContentAudit({ publishedAt: post.publishedAt, impressions, clicks, ctrPercent: ctr, averagePosition, leads: leadMetrics.leads, convertedLeads: leadMetrics.convertedLeads, indexVerdict, now: new Date(now) });
      await payload.update({
        collection: "posts",
        id: post.id,
        draft: true,
        overrideAccess: true,
        data: {
          leadPerformance: { leads: leadMetrics.leads, convertedLeads: leadMetrics.convertedLeads, updatedAt: now },
          lastContentAuditAt: now,
          contentAudit: { recommendation: audit.recommendation, reason: audit.reason, generatedAt: now, targetPost: post.contentAudit?.targetPost, reviewedAt: post.contentAudit?.recommendation === audit.recommendation ? post.contentAudit?.reviewedAt : null },
          ...(searchReady && searchConsole !== "degraded" ? {
          searchPerformance: {
            impressions,
            clicks,
            ctr,
            averagePosition,
            updatedAt: now,
            ...(inspection?.verdict ? { indexVerdict: inspection.verdict } : {}),
            ...(inspection?.coverageState ? { coverageState: inspection.coverageState } : {}),
            ...(inspection?.lastCrawlTime ? { lastCrawlAt: inspection.lastCrawlTime } : {}),
          },
          } : {}),
        },
      });
      await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: "blog.performance-refreshed", entityType: "post", entityId: post.id, correlationId, changedFields: ["leadPerformance", "searchPerformance", "contentAudit", "lastContentAuditAt"] });
      updated += 1;
    }
    return NextResponse.json({ ok: true, updated, leadsAttributed, inspectionFailures, searchConsole });
  } catch (error) {
    captureException(error, { route: "POST /api/admin/blog/performance" });
    return NextResponse.json({ error: "Performance refresh failed" }, { status: 500 });
  }
}
