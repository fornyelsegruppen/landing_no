import { postRevision } from "@/lib/blog/post-revision";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import {
  assertBlogAction,
  BlogTransitionError,
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
import { ArticleQualityBlockedError } from "@/lib/blog/draft-engine";
import { ProviderUnavailableError } from "@/lib/providers/contracts";
import {
  blogInputLimits,
  parseBlogFieldIssues,
  type BlogFieldIssue,
} from "@/lib/admin-v2/blog-field-errors";

const actionSchema = z
  .object({
    action: z.enum([
      "approve",
      "reject",
      "schedule",
      "publish",
      "unpublish",
      "regenerate",
      "stock-image",
      "save",
    ]),
    reviewerName: z.string().trim().min(2).max(120).optional(),
    scheduledAt: z.string().datetime().optional(),
    reason: z.string().trim().max(500).optional(),
    query: z.string().trim().min(3).max(120).optional(),
    titleNo: z.string().trim().min(1).max(blogInputLimits.titleNo).optional(),
    excerptNo: z.string().trim().max(500).optional(),
    contentNo: z
      .string()
      .trim()
      .min(1)
      .max(blogInputLimits.contentNo)
      .optional(),
    seoTitleNo: z.string().trim().max(160).optional(),
    seoDescriptionNo: z.string().trim().max(500).optional(),
    primaryKeyword: z.string().trim().max(160).optional(),
    regenerationInstructions: z.string().trim().max(2000).optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .superRefine((data, context) => {
    if (data.action === "unpublish" && !data.expectedUpdatedAt)
      context.addIssue({
        code: "custom",
        path: ["expectedUpdatedAt"],
        message: "required",
      });
    if (data.action === "save")
      for (const field of ["titleNo", "contentNo"] as const) {
        if (data[field] === undefined)
          context.addIssue({
            code: "custom",
            path: [field],
            message: "required",
          });
      }
  });

class BlogActionConflictError extends TypeError {
  constructor() {
    super(
      "Artikkelen er endret av en annen økt. Last siden på nytt før du fortsetter.",
    );
    this.name = "BlogActionConflictError";
  }
}

function safeQualityIssues(error: ArticleQualityBlockedError) {
  return error.quality.issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
  }));
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = correlationIdFromHeaders(request.headers);
  let action: string | undefined;
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = actionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue): BlogFieldIssue => ({
        field: (typeof issue.path[0] === "string"
          ? issue.path[0]
          : "request") as BlogFieldIssue["field"],
        code:
          issue.code === "too_big"
            ? "too_long"
            : issue.code === "too_small" ||
                (issue.code === "custom" && issue.message === "required")
              ? "required"
              : "invalid",
      }));
      const fieldIssues = parseBlogFieldIssues(issues);
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          error: "Check the highlighted fields",
          fieldIssues: fieldIssues.length
            ? fieldIssues
            : [{ field: "request", code: "invalid" }],
          correlationId,
        },
        { status: 400 },
      );
    }
    action = parsed.data.action;
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
    if (
      parsed.data.expectedUpdatedAt &&
      post.updatedAt !== parsed.data.expectedUpdatedAt
    ) {
      throw new BlogActionConflictError();
    }
    if (parsed.data.action === "unpublish") {
      const data = {
        _status: "draft" as const,
        editorialStatus: "human_review" as const,
        reviewerName: null,
        reviewedAt: null,
        scheduledAt: null,
        qualityChecks: null,
        qualityScore: null,
      };
      const updated = await payload.update({
        collection: "posts",
        id: post.id,
        // This updates the base document, not merely a new draft revision.
        draft: false,
        overrideAccess: true,
        context: {
          expectedBlogUpdatedAt: post.updatedAt,
          expectedBlogRevision: postRevision(post),
        },
        data,
      });
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "blog.unpublish",
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
        action,
        outcome: "unpublished",
        correlationId,
      });
    }
    if (parsed.data.action === "stock-image") {
      const result = await attachPexelsStockImageToPost({
        payload,
        post,
        query: parsed.data.query,
      });
      if (result.outcome === "no_alternative") {
        return NextResponse.json(
          {
            ok: false,
            action,
            code: "NO_ALTERNATIVE",
            error: "Fant ingen annen egnet Pexels-bilde for dette søket.",
            correlationId,
            outcome: result.outcome,
          },
          { status: 409 },
        );
      }
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
        action,
        postId: result.post.id,
        mediaId: result.media?.id || null,
        query: result.query,
        photographer: result.selected.photographer,
        correlationId,
        outcome: result.outcome,
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
        context: {
          trustedBlogQualityRevalidation: true,
          expectedBlogUpdatedAt: post.updatedAt,
          expectedBlogRevision: postRevision(post),
        },
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
        correlationId,
        outcome: "saved",
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
    if (parsed.data.action === "publish" || parsed.data.action === "schedule") {
      try {
        assertPostPublishable({ ...post, reviewerName });
      } catch {
        throw new BlogTransitionError(
          "PUBLICATION_NOT_READY",
          "Publication review and quality requirements are not satisfied",
        );
      }
    }

    if (
      parsed.data.action === "schedule" &&
      post.editorialStatus === "scheduled" &&
      post.scheduledAt &&
      new Date(post.scheduledAt).getTime() ===
        new Date(parsed.data.scheduledAt!).getTime()
    ) {
      return NextResponse.json({
        ok: true,
        postId: post.id,
        action,
        outcome: "unchanged",
        correlationId,
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
        regenerationInstructions: parsed.data.regenerationInstructions,
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
        action,
        postId: result.post.id,
        runId: result.run.id,
        correlationId,
        outcome: "regenerated",
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
      context: {
        expectedBlogUpdatedAt: post.updatedAt,
        expectedBlogRevision: postRevision(post),
      },
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
      correlationId,
      outcome: parsed.data.action,
    });
  } catch (error) {
    captureException(error, {
      route: "POST /api/admin/blog/posts/[id]",
      correlationId,
    });
    const qualityBlocked = error instanceof ArticleQualityBlockedError;
    const conflict = error instanceof BlogActionConflictError;
    const providerUnavailable = error instanceof ProviderUnavailableError;
    return NextResponse.json(
      {
        ok: false,
        ...(action ? { action } : {}),
        code: qualityBlocked
          ? "QUALITY_BLOCKED"
          : error instanceof BlogTransitionError
            ? error.code
            : conflict
              ? "CONFLICT"
              : providerUnavailable
                ? "PROVIDER_UNAVAILABLE"
                : "ACTION_FAILED",
        error: qualityBlocked
          ? "Regenereringen ble stoppet av kvalitetskontrollen. Det lagrede utkastet er ikke endret."
          : error instanceof TypeError
            ? error.message
            : "Article action failed",
        correlationId,
        ...(qualityBlocked && error.runId ? { runId: error.runId } : {}),
        ...(qualityBlocked ? { qualityIssues: safeQualityIssues(error) } : {}),
        ...(qualityBlocked ? { outcome: "retained_draft" } : {}),
      },
      { status: error instanceof TypeError || qualityBlocked ? 409 : 500 },
    );
  }
}
