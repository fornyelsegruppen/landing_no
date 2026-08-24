import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import {
  assertBlogAction,
  type BlogEditorialStatus,
} from "@/lib/blog/transitions";
import { assertFeatureReady } from "@/lib/platform/features";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { regeneratePayloadBlogPost } from "@/lib/blog/payload-blog-engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { userIsAdmin } from "@/payload/access/roles";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { attachPexelsStockImageToPost } from "@/lib/blog/stock-image";

const actionSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "schedule",
    "publish",
    "regenerate",
    "stock-image",
  ]),
  reviewerName: z.string().trim().min(2).max(120).optional(),
  scheduledAt: z.string().datetime().optional(),
  reason: z.string().trim().max(500).optional(),
  query: z.string().trim().min(3).max(120).optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const { id } = await context.params;
    if (!/^\d+$/.test(id))
      return NextResponse.json({ error: "Invalid article" }, { status: 400 });
    const post = await payload.findByID({
      collection: "posts",
      id: Number(id),
      depth: 0,
      draft: true,
      overrideAccess: true,
    });
    if (parsed.data.action === "stock-image") {
      const result = await attachPexelsStockImageToPost({
        payload,
        post,
        query: parsed.data.query,
      });
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "blog.stock-image.replace",
        entityType: "post",
        entityId: post.id,
        correlationId,
        changedFields: ["heroImage"],
        before: { heroImage: post.heroImage },
        after: { heroImage: result.media.id, provider: "pexels" },
      });
      return NextResponse.json({
        ok: true,
        postId: result.post.id,
        mediaId: result.media.id,
        query: result.query,
        photographer: result.selected.photographer,
      });
    }
    const quality =
      post.qualityChecks && typeof post.qualityChecks === "object"
        ? (post.qualityChecks as { passed?: boolean })
        : {};
    const reviewerName = parsed.data.reviewerName || post.reviewerName;
    assertBlogAction(
      {
        status: post.editorialStatus as BlogEditorialStatus,
        qualityScore: post.qualityScore,
        qualityPassed: quality.passed === true,
        reviewerName,
        reviewedAt: post.reviewedAt,
      },
      parsed.data.action,
      parsed.data.scheduledAt,
    );

    if (parsed.data.action === "regenerate") {
      assertFeatureReady("aiDrafts");
      const result = await regeneratePayloadBlogPost({
        payload,
        provider: new GeminiAiProvider(),
        postId: post.id,
        idempotencyKey: `seo-regenerate:${post.id}:${randomUUID()}`,
        correlationId,
      });
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "blog.regenerate",
        entityType: "post",
        entityId: post.id,
        correlationId,
        changedFields: ["contentNo", "qualityChecks", "editorialStatus"],
      });
      return NextResponse.json({
        ok: true,
        postId: result.post.id,
        runId: result.run.id,
      });
    }

    const now = new Date().toISOString();
    const data =
      parsed.data.action === "approve"
        ? {
            editorialStatus: "approved" as const,
            reviewerName,
            reviewedAt: now,
          }
        : parsed.data.action === "reject"
          ? {
              editorialStatus: "rejected" as const,
              scheduledAt: null,
              performanceNotes:
                parsed.data.reason || "Avvist av administrator.",
              _status: "draft" as const,
            }
          : parsed.data.action === "schedule"
            ? {
                editorialStatus: "scheduled" as const,
                scheduledAt: parsed.data.scheduledAt,
              }
            : { _status: "published" as const };
    const updated = await payload.update({
      collection: "posts",
      id: post.id,
      draft: parsed.data.action !== "publish",
      overrideAccess: true,
      data,
    });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: `blog.${parsed.data.action}`,
      entityType: "post",
      entityId: post.id,
      correlationId,
      changedFields: Object.keys(data),
      before: { editorialStatus: post.editorialStatus, status: post._status },
      after: {
        editorialStatus: updated.editorialStatus,
        status: updated._status,
      },
    });
    return NextResponse.json({
      ok: true,
      postId: updated.id,
      action: parsed.data.action,
    });
  } catch (error) {
    captureException(error, {
      route: "POST /api/admin/blog/posts/[id]",
      correlationId,
    });
    return NextResponse.json(
      {
        error:
          error instanceof TypeError ? error.message : "Article action failed",
        correlationId,
      },
      { status: error instanceof TypeError ? 409 : 500 },
    );
  }
}
