import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import {
  assertBlogAction,
  type BlogEditorialStatus,
} from "@/lib/blog/transitions";
import { assertPostPublishable } from "@/lib/blog/editorial-policy";
import { assertFeatureReady } from "@/lib/platform/features";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { regeneratePayloadBlogPost } from "@/lib/blog/payload-blog-engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { userIsAdmin } from "@/payload/access/roles";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { attachPexelsStockImageToPost } from "@/lib/blog/stock-image";
import { reviewerNameForUser } from "@/lib/blog/reviewer";
import { evaluateEditedBlogDraft } from "@/lib/blog/edited-draft-quality";

const actionSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "schedule",
    "publish",
    "regenerate",
    "stock-image",
    "save",
  ]),
  reviewerName: z.string().trim().min(2).max(120).optional(),
  scheduledAt: z.string().datetime().optional(),
  reason: z.string().trim().max(500).optional(),
  query: z.string().trim().min(3).max(120).optional(),
  titleNo: z.string().trim().min(10).max(160).optional(),
  excerptNo: z.string().trim().max(500).optional(),
  contentNo: z.string().trim().min(300).max(30000).optional(),
  seoTitleNo: z.string().trim().max(160).optional(),
  seoDescriptionNo: z.string().trim().max(500).optional(),
  primaryKeyword: z.string().trim().max(160).optional(),
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
        changedFields: ["heroImage", "stockImage"],
        before: { heroImage: post.heroImage, stockImage: post.stockImage },
        after: {
          heroImage: result.media?.id || null,
          stockImage: result.post.stockImage,
          provider: "pexels",
        },
      });
      return NextResponse.json({
        ok: true,
        postId: result.post.id,
        mediaId: result.media?.id || null,
        query: result.query,
        photographer: result.selected.photographer,
      });
    }
    if (parsed.data.action === "save") {
      if (!parsed.data.titleNo || !parsed.data.contentNo)
        throw new TypeError("Title and article text are required");
      const existingPosts = await payload.find({
        collection: "posts",
        depth: 0,
        limit: 500,
        pagination: false,
        overrideAccess: true,
        where: { id: { not_equals: post.id } },
      });
      const quality = evaluateEditedBlogDraft({
        post,
        edits: {
          titleNo: parsed.data.titleNo,
          excerptNo: parsed.data.excerptNo,
          contentNo: parsed.data.contentNo,
          seoTitleNo: parsed.data.seoTitleNo,
          seoDescriptionNo: parsed.data.seoDescriptionNo,
          primaryKeyword: parsed.data.primaryKeyword,
        },
        existing: existingPosts.docs.map((item) => ({
          title: item.titleNo,
          primaryKeyword: item.primaryKeyword,
        })),
      });
      const data = {
        titleNo: parsed.data.titleNo,
        excerptNo: parsed.data.excerptNo || null,
        contentNo: parsed.data.contentNo,
        seoTitleNo: parsed.data.seoTitleNo || null,
        seoDescriptionNo: parsed.data.seoDescriptionNo || null,
        primaryKeyword: parsed.data.primaryKeyword || null,
        qualityScore: quality.score,
        qualityChecks: quality,
        editorialStatus: "human_review" as const,
        scheduledAt: null,
        reviewerName: null,
        reviewedAt: null,
        _status: "draft" as const,
      };
      const updated = await payload.update({
        collection: "posts",
        id: post.id,
        draft: true,
        overrideAccess: true,
        context: { trustedBlogQualityRevalidation: true },
        data,
      });
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "blog.save",
        entityType: "post",
        entityId: post.id,
        correlationId,
        changedFields: Object.keys(data),
        before: {
          titleNo: post.titleNo,
          contentNo: post.contentNo,
          editorialStatus: post.editorialStatus,
          qualityScore: post.qualityScore,
        },
        after: {
          titleNo: updated.titleNo,
          contentNo: updated.contentNo,
          editorialStatus: updated.editorialStatus,
          qualityScore: updated.qualityScore,
        },
      });
      return NextResponse.json({
        ok: true,
        postId: updated.id,
        action: "save",
        qualityPassed: quality.passed,
        qualityScore: quality.score,
      });
    }
    const quality =
      post.qualityChecks && typeof post.qualityChecks === "object"
        ? (post.qualityChecks as { passed?: boolean })
        : {};
    const reviewerName =
      parsed.data.action === "approve"
        ? parsed.data.reviewerName ||
          post.reviewerName ||
          reviewerNameForUser(user)
        : post.reviewerName;
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
    if (parsed.data.action === "publish") {
      assertPostPublishable({
        ...post,
        reviewerName,
      });
    }

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
            : {
                _status: "published" as const,
                editorialStatus: "approved" as const,
                authorName: post.authorName?.trim() || "Takfornyelse",
                reviewerName,
                reviewedAt: post.reviewedAt,
              };
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
