import { postRevision } from "./post-revision";
import { createHash } from "node:crypto";
import type { Payload } from "payload";
import type { AiProvider, SearchSignal } from "@/lib/providers/contracts";
import { sanitizeJobError } from "@/lib/jobs/job-policy";
import { assertPayloadAiUsageAvailable } from "@/lib/ai/payload-usage-limit";
import { ArticleQualityBlockedError, generateBlogDraft } from "./draft-engine";
import {
  highestTopicOverlap,
  getManualTopicSeeds,
  seasonalRelevanceForTopic,
  topicScore,
  candidateFromSignal,
  sourceMetricsFromSignal,
  type ExistingTopic,
  type TopicCandidate,
} from "./topic-engine";
import { attachPexelsStockImageToPost } from "./stock-image";
import { PexelsStockImageProvider } from "@/lib/providers/pexels-stock-image-provider";
import { blogServiceAreas } from "./knowledge-base";
import { claimSeoRun, markSeoRunFailure, type RunPhase } from "./seo-run-state";
import { withSeoPayloadTransaction } from "./post-write-transaction";
import { planSearchSignalRefresh } from "./search-signal-refresh";
import { runAttempt } from "./seo-run-state";

type TriggerSource = "manual" | "cron" | "regenerate";

function blogWordCount(value: string | null | undefined) {
  return value?.toLocaleLowerCase("nb-NO").match(/[a-zæøå0-9]+/g)?.length || 0;
}

function priorQualityIssues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const issues = (value as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return [];
    const item = issue as Record<string, unknown>;
    const code =
      typeof item.code === "string" ? item.code.slice(0, 120) : "quality_issue";
    const severity =
      typeof item.severity === "string"
        ? item.severity.slice(0, 40)
        : "warning";
    const message =
      typeof item.message === "string" ? item.message.slice(0, 500) : "";
    return message ? [{ code, severity, message }] : [];
  });
}

function fingerprint(
  candidate: Pick<
    TopicCandidate,
    "primaryKeyword" | "searchIntent" | "location"
  >,
) {
  return createHash("sha256")
    .update(
      `${candidate.primaryKeyword}|${candidate.searchIntent}|${candidate.location || ""}`.toLocaleLowerCase(
        "nb-NO",
      ),
    )
    .digest("hex");
}

async function existingTopics(payload: Payload): Promise<ExistingTopic[]> {
  const posts = await payload.find({
    collection: "posts",
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
  });
  return posts.docs.map((post) => ({
    title: post.titleNo,
    primaryKeyword: post.primaryKeyword,
  }));
}

async function serviceId(payload: Payload, key: string) {
  const result = await payload.find({
    collection: "services",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { key: { equals: key } },
  });
  return result.docs[0]?.id;
}

function suggestedBrief(candidate: TopicCandidate) {
  return {
    audience:
      "Boligeiere i Norge over 30 år som vurderer vedlikehold eller fornying av tak.",
    purpose: candidate.reason,
    requiredSections: [
      "Kort og konkret svar på søkeintensjonen",
      "Hva boligeieren bør kontrollere",
      "Når faglig befaring er riktig neste steg",
      "Relevant Takfornyelse-tjeneste uten overdrevne løfter",
    ],
    primaryKeyword: candidate.primaryKeyword,
    secondaryKeywords: candidate.secondaryKeywords,
    cta: "Be om en uforpliktende taksjekk",
  };
}

async function createTopicCandidate(
  payload: Payload,
  candidate: TopicCandidate,
  existing: ExistingTopic[],
) {
  const key = fingerprint(candidate);
  const found = await payload.find({
    collection: "seo-topics",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { fingerprint: { equals: key } },
  });
  if (found.docs.length) return false;
  const overlap = highestTopicOverlap(candidate, existing);
  const relatedServiceId = await serviceId(payload, candidate.serviceKey);
  await payload.create({
    collection: "seo-topics",
    overrideAccess: true,
    data: {
      fingerprint: key,
      topic: candidate.topic,
      primaryKeyword: candidate.primaryKeyword,
      secondaryKeywords: candidate.secondaryKeywords.map((keyword) => ({
        keyword,
      })),
      searchIntent: candidate.searchIntent,
      ...(relatedServiceId ? { service: relatedServiceId } : {}),
      ...(candidate.location ? { location: candidate.location } : {}),
      ...(candidate.season ? { season: candidate.season } : {}),
      source: candidate.source,
      ...(candidate.sourceSignal
        ? {
            sourceMetrics: sourceMetricsFromSignal(
              candidate.sourceSignal,
              new Date().toISOString(),
            ),
          }
        : {}),
      proposedBrief: suggestedBrief(candidate),
      topicScore: topicScore(candidate.factors),
      overlapScore: overlap,
      scoreBreakdown: candidate.factors,
      reasonForSelection: candidate.reason,
      status: overlap >= 70 ? "rejected" : "candidate",
      ...(overlap >= 70
        ? {
            rejectionReasons: [
              { reason: "Høy overlapp med eksisterende innhold" },
            ],
          }
        : {}),
      checkedAt: new Date().toISOString(),
    },
  });
  return true;
}

export async function ensureManualBlogTopics(
  payload: Payload,
  now = new Date(),
) {
  const existing = await existingTopics(payload);
  let created = 0;
  for (const candidate of getManualTopicSeeds(now)) {
    if (await createTopicCandidate(payload, candidate, existing)) {
      created += 1;
      existing.push({
        title: candidate.topic,
        primaryKeyword: candidate.primaryKeyword,
      });
    }
  }
  return created;
}

export async function importSearchSignals(
  payload: Payload,
  signals: SearchSignal[],
) {
  const existing = await existingTopics(payload);
  let accepted = 0;
  let filtered = 0;
  for (const signal of signals) {
    const candidate = candidateFromSignal(signal);
    if (!candidate) {
      filtered += 1;
      continue;
    }
    if (await createTopicCandidate(payload, candidate, existing)) {
      accepted += 1;
      existing.push({
        title: candidate.topic,
        primaryKeyword: candidate.primaryKeyword,
      });
    }
  }
  return { accepted, filtered, received: signals.length };
}

export async function refreshPayloadSearchSignals(
  payload: Payload,
  signals: SearchSignal[],
  now = new Date(),
  deadline = Date.now() + 10_000,
) {
  return withSeoPayloadTransaction(payload, async (scoped) => {
    const topics = await scoped.find({
      collection: "seo-topics",
      overrideAccess: true,
      depth: 0,
      limit: 500,
      pagination: false,
    });
    const existing = await existingTopics(scoped);
    let created = 0,
      updated = 0,
      skipped = 0;
    // Bound the per-run DB work; refresh snapshots, never sum repeated imports.
    for (const signal of [...signals]
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .slice(0, 50)) {
      if (Date.now() >= deadline)
        throw new TypeError("Signal persistence deadline reached");
      const plan = planSearchSignalRefresh({
        signal,
        existingTopics: topics.docs,
        importedAt: now.toISOString(),
        now,
      });
      if (plan.action === "create") {
        if (await createTopicCandidate(scoped, plan.candidate, existing))
          created++;
      } else if (plan.action === "update") {
        const reserved = await scoped.find({
          collection: "seo-runs",
          depth: 0,
          limit: 1,
          overrideAccess: true,
          where: { selectedTopics: { equals: plan.topicId } },
        });
        if (reserved.docs.length) {
          skipped++;
          continue;
        }
        await scoped.update({
          collection: "seo-topics",
          id: plan.topicId,
          overrideAccess: true,
          data: {
            sourceMetrics: plan.sourceMetrics,
            topicScore: plan.topicScore,
            scoreBreakdown: plan.candidate.factors,
            checkedAt: now.toISOString(),
          },
        });
        updated++;
      } else skipped++;
    }
    return { created, updated, skipped, received: signals.length };
  });
}

function relationId(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "number" ? id : undefined;
  }
  return undefined;
}

function topicFromDocument(
  document: Record<string, unknown>,
  now = new Date(),
): TopicCandidate {
  const service = document.service;
  const serviceKey =
    service && typeof service === "object" && "key" in service
      ? String((service as { key: unknown }).key)
      : "takvask";
  const keywords = Array.isArray(document.secondaryKeywords)
    ? document.secondaryKeywords
        .map((item) =>
          item && typeof item === "object" && "keyword" in item
            ? String((item as { keyword: unknown }).keyword)
            : "",
        )
        .filter(Boolean)
    : [];
  const factors =
    document.scoreBreakdown && typeof document.scoreBreakdown === "object"
      ? (document.scoreBreakdown as TopicCandidate["factors"])
      : getManualTopicSeeds(now)[0]!.factors;
  return {
    topic: String(document.topic),
    primaryKeyword: String(document.primaryKeyword),
    secondaryKeywords: keywords,
    searchIntent: document.searchIntent as TopicCandidate["searchIntent"],
    source: document.source as TopicCandidate["source"],
    serviceKey,
    ...(document.location ? { location: String(document.location) } : {}),
    ...(document.season ? { season: String(document.season) } : {}),
    factors: {
      ...factors,
      // Persisted snapshots may come from a different season. Re-rank in memory;
      // never rewrite an already reserved, drafted, or otherwise protected topic.
      seasonalRelevance: seasonalRelevanceForTopic(
        `${document.topic} ${document.primaryKeyword} ${document.season || ""}`,
        now,
      ),
    },
    reason: String(document.reasonForSelection || "Godkjent temakandidat"),
  };
}

async function nextTopic(payload: Payload) {
  const now = new Date();
  const result = await payload.find({
    collection: "seo-topics",
    depth: 1,
    limit: 100,
    sort: "-topicScore",
    overrideAccess: true,
    where: {
      and: [
        { status: { in: ["candidate", "queued"] } },
        { overlapScore: { less_than: 70 } },
        {
          or: [
            { location: { exists: false } },
            { location: { equals: "" } },
            { location: { in: blogServiceAreas } },
          ],
        },
      ],
    },
  });
  const ranked = result.docs
    .map((document) => ({
      document,
      score: topicScore(
        topicFromDocument(document as unknown as Record<string, unknown>, now)
          .factors,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.document.id - b.document.id);
  for (const { document: candidate } of ranked) {
    const reserved = await payload.find({
      collection: "seo-runs",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { selectedTopics: { equals: candidate.id } },
    });
    if (!reserved.docs.length) return candidate;
  }
  return null;
}

async function availableSlug(payload: Payload, requested: string) {
  const base =
    requested.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) ||
    "fagartikkel";
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const found = await payload.find({
      collection: "posts",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: slug } },
    });
    if (!found.docs.length) return slug;
  }
  throw new Error("No available article slug could be created");
}

export async function generateNextPayloadBlogDraft(input: {
  payload: Payload;
  provider: AiProvider;
  idempotencyKey: string;
  correlationId: string;
  triggerSource: TriggerSource;
  weekKey?: string;
  slot?: string;
  refreshSignals?: () => Promise<unknown>;
  deadline?: number;
}) {
  const claim = await claimSeoRun(input.payload, input);
  if (!claim.claimed)
    return { duplicate: true as const, run: claim.run, outcome: claim.outcome };
  const run = claim.run;
  let phase: RunPhase = "claimed";
  try {
    // The source adapter runs only after the slot is durably claimed.
    phase = "signals";
    await input.refreshSignals?.();
    const topicDocument = await withSeoPayloadTransaction(
      input.payload,
      async (scoped) => {
        await ensureManualBlogTopics(scoped);
        await assertPayloadAiUsageAvailable(scoped);
        const topic = await nextTopic(scoped);
        if (!topic) throw new TypeError("No eligible SEO topic is available");
        await scoped.update({
          collection: "seo-runs",
          id: run.id,
          overrideAccess: true,
          data: {
            selectedTopics: [topic.id],
            qualityResult: {
              kind: "seo-orchestration-v1",
              phase: "provider",
              attempt: runAttempt(run),
            },
          },
        });
        return topic;
      },
    );
    phase = "provider";
    const existing = await existingTopics(input.payload);
    const generated = await generateBlogDraft({
      provider: input.provider,
      topic: topicFromDocument(
        topicDocument as unknown as Record<string, unknown>,
      ),
      existing,
      correlationId: input.correlationId,
    });
    const primaryService = relationId(topicDocument.service);
    const slug = await availableSlug(input.payload, generated.article.slug);
    let post = await withSeoPayloadTransaction(
      input.payload,
      async (scoped) => {
        const created = await scoped.create({
          collection: "posts",
          draft: true,
          overrideAccess: true,
          context: { trustedBlogQualityRevalidation: true },
          data: {
            slug,
            titleNo: generated.article.title,
            excerptNo: generated.article.excerpt,
            contentNo: generated.article.content,
            seoTitleNo: generated.article.seoTitle,
            seoDescriptionNo: generated.article.seoDescription,
            editorialStatus: "ai_qa",
            searchIntent: topicDocument.searchIntent,
            primaryKeyword: generated.article.primaryKeyword,
            secondaryKeywords: generated.article.secondaryKeywords.map(
              (keyword) => ({ keyword }),
            ),
            ...(primaryService ? { primaryService } : {}),
            ...(topicDocument.location
              ? { locationText: topicDocument.location }
              : {}),
            sources: generated.article.sources,
            authorName: "Takfornyelse",
            aiAssisted: true,
            aiGenerationRun: run.id,
            qualityScore: generated.quality.score,
            qualityChecks: generated.quality,
            reviewFlags: generated.article.claimsForReview.map((flag) => ({
              flag,
            })),
            proposedInternalLinks: generated.article.internalLinks,
            ctaVariant: generated.article.ctaVariant,
            faqItems: generated.article.faq.map((item) => ({
              questionNo: item.question,
              answerNo: item.answer,
            })),
            imageBrief: generated.article.imageBrief,
            imageAlt: generated.article.imageAlt,
            _status: "draft",
          },
        });
        await scoped.update({
          collection: "seo-topics",
          id: topicDocument.id,
          overrideAccess: true,
          data: { status: "drafted", relatedPost: created.id },
        });
        await scoped.update({
          collection: "seo-runs",
          id: run.id,
          overrideAccess: true,
          data: {
            status: "completed",
            finishedAt: new Date().toISOString(),
            modelVersion: generated.model,
            promptVersion: generated.promptVersion,
            knowledgeVersion: generated.knowledgeVersion,
            qualityResult: generated.quality,
            createdPost: created.id,
          },
        });
        return created;
      },
    );
    const stockBudget = input.deadline
      ? input.deadline - Date.now() - 5_000
      : 45_000;
    const stockProvider = new PexelsStockImageProvider(
      process.env,
      fetch,
      AbortSignal.timeout(Math.max(1, stockBudget)),
    );
    if (stockBudget >= 3_000 && stockProvider.isConfigured()) {
      try {
        const stockResult = await attachPexelsStockImageToPost({
          payload: input.payload,
          post,
          provider: stockProvider,
          preserveInitialQuality: true,
          ...(input.triggerSource === "cron" ? { persistToMedia: false } : {}),
        });
        if (stockResult.outcome === "replaced") {
          post = stockResult.post;
        } else {
          input.payload.logger.warn(
            `Pexels enrichment found no alternative for draft ${post.id}; retaining the valid draft without changing its image.`,
          );
        }
      } catch {
        // Image enrichment must never discard an otherwise valid article draft.
        input.payload.logger.warn(
          `Pexels enrichment skipped for draft ${post.id}; an administrator can retry it manually.`,
        );
      }
    }
    return { duplicate: false as const, run, post, generated };
  } catch (error) {
    await markSeoRunFailure(
      input.payload,
      run,
      phase,
      error instanceof ArticleQualityBlockedError ? error.quality : undefined,
    );
    throw error;
  }
}

export async function regeneratePayloadBlogPost(input: {
  payload: Payload;
  provider: AiProvider;
  postId: number;
  idempotencyKey: string;
  correlationId: string;
  regenerationInstructions?: string;
}) {
  await assertPayloadAiUsageAvailable(input.payload, { reserve: 1 });
  const post = await input.payload.findByID({
    collection: "posts",
    id: input.postId,
    depth: 1,
    draft: true,
    overrideAccess: true,
  });
  if (post._status === "published") {
    throw new TypeError("Published articles cannot be regenerated in place");
  }
  if (post.locationText && !blogServiceAreas.includes(post.locationText)) {
    throw new TypeError(
      "Straipsnio vietovė nepatenka į aptarnaujamą Oslo regioną. Sukurkite naują tinkamos vietovės juodraštį.",
    );
  }
  const run = await input.payload.create({
    collection: "seo-runs",
    overrideAccess: true,
    data: {
      idempotencyKey: input.idempotencyKey,
      jobType: "blog.article.regenerate",
      triggerSource: "regenerate",
      status: "running",
      startedAt: new Date().toISOString(),
    },
  });
  try {
    const service = post.primaryService;
    const serviceKey =
      service && typeof service === "object" ? service.key : "takvask";
    const topic: TopicCandidate = {
      topic: post.titleNo,
      primaryKeyword: post.primaryKeyword || post.titleNo,
      secondaryKeywords: (post.secondaryKeywords || []).map(
        (item) => item.keyword,
      ),
      searchIntent: post.searchIntent || "informational",
      source: "manual",
      serviceKey,
      ...(post.locationText ? { location: post.locationText } : {}),
      factors: getManualTopicSeeds()[0]!.factors,
      reason:
        "Regenerering av eksisterende AI-utkast etter administratorhandling.",
    };
    const existing = (await existingTopics(input.payload)).filter(
      (item) => item.title !== post.titleNo,
    );
    const generated = await generateBlogDraft({
      provider: input.provider,
      topic,
      existing,
      correlationId: input.correlationId,
      regenerationFeedback: {
        savedContent: post.contentNo || "",
        previousWordCount: blogWordCount(post.contentNo),
        previousQualityIssues: priorQualityIssues(post.qualityChecks),
        ...(input.regenerationInstructions
          ? { regenerationInstructions: input.regenerationInstructions }
          : {}),
      },
    });
    const updated = await input.payload.update({
      collection: "posts",
      id: post.id,
      draft: true,
      overrideAccess: true,
      context: {
        trustedBlogQualityRevalidation: true,
        expectedBlogUpdatedAt: post.updatedAt,
        expectedBlogRevision: postRevision(post),
      },
      data: {
        titleNo: generated.article.title,
        excerptNo: generated.article.excerpt,
        contentNo: generated.article.content,
        seoTitleNo: generated.article.seoTitle,
        seoDescriptionNo: generated.article.seoDescription,
        editorialStatus: "ai_qa",
        scheduledAt: null,
        reviewerName: null,
        reviewedAt: null,
        primaryKeyword: generated.article.primaryKeyword,
        secondaryKeywords: generated.article.secondaryKeywords.map(
          (keyword) => ({ keyword }),
        ),
        sources: generated.article.sources,
        aiAssisted: true,
        aiGenerationRun: run.id,
        qualityScore: generated.quality.score,
        qualityChecks: generated.quality,
        reviewFlags: generated.article.claimsForReview.map((flag) => ({
          flag,
        })),
        proposedInternalLinks: generated.article.internalLinks,
        ctaVariant: generated.article.ctaVariant,
        faqItems: generated.article.faq.map((item) => ({
          questionNo: item.question,
          answerNo: item.answer,
        })),
        imageBrief: generated.article.imageBrief,
        ...(post.stockImage?.provider === "pexels"
          ? {}
          : { imageAlt: generated.article.imageAlt }),
        _status: "draft",
      },
    });
    await input.payload.update({
      collection: "seo-runs",
      id: run.id,
      overrideAccess: true,
      data: {
        status: "completed",
        finishedAt: new Date().toISOString(),
        modelVersion: generated.model,
        promptVersion: generated.promptVersion,
        knowledgeVersion: generated.knowledgeVersion,
        qualityResult: generated.quality,
        createdPost: updated.id,
      },
    });
    return { run, post: updated, generated };
  } catch (error) {
    if (error instanceof ArticleQualityBlockedError) error.runId = run.id;
    const sanitized = sanitizeJobError(error);
    await input.payload.update({
      collection: "seo-runs",
      id: run.id,
      overrideAccess: true,
      data: {
        status:
          error instanceof ArticleQualityBlockedError ? "attention" : "failed",
        finishedAt: new Date().toISOString(),
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
        ...(error instanceof ArticleQualityBlockedError
          ? {
              qualityResult: error.quality,
              ...(error.provenance
                ? {
                    modelVersion: error.provenance.model,
                    promptVersion: error.provenance.promptVersion,
                    knowledgeVersion: error.provenance.knowledgeVersion,
                  }
                : {}),
            }
          : {}),
      },
    });
    throw error;
  }
}
