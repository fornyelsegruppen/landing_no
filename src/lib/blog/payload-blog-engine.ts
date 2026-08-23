import { createHash } from "node:crypto";
import type { Payload } from "payload";
import type { AiProvider, SearchSignal } from "@/lib/providers/contracts";
import { sanitizeJobError } from "@/lib/jobs/job-policy";
import { ArticleQualityBlockedError, generateBlogDraft } from "./draft-engine";
import {
  highestTopicOverlap,
  manualTopicSeeds,
  topicScore,
  candidateFromSignal,
  type ExistingTopic,
  type TopicCandidate,
} from "./topic-engine";

type TriggerSource = "manual" | "cron" | "regenerate";

function fingerprint(candidate: Pick<TopicCandidate, "primaryKeyword" | "searchIntent" | "location">) {
  return createHash("sha256")
    .update(`${candidate.primaryKeyword}|${candidate.searchIntent}|${candidate.location || ""}`.toLocaleLowerCase("nb-NO"))
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
    audience: "Boligeiere i Norge over 30 år som vurderer vedlikehold eller fornying av tak.",
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

async function createTopicCandidate(payload: Payload, candidate: TopicCandidate, existing: ExistingTopic[]) {
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
      secondaryKeywords: candidate.secondaryKeywords.map((keyword) => ({ keyword })),
      searchIntent: candidate.searchIntent,
      ...(relatedServiceId ? { service: relatedServiceId } : {}),
      ...(candidate.location ? { location: candidate.location } : {}),
      ...(candidate.season ? { season: candidate.season } : {}),
      source: candidate.source,
      sourceMetrics: { kind: candidate.source === "manual" ? "approved-manual-seed" : "aggregated-signal" },
      proposedBrief: suggestedBrief(candidate),
      topicScore: topicScore(candidate.factors),
      overlapScore: overlap,
      scoreBreakdown: candidate.factors,
      reasonForSelection: candidate.reason,
      status: overlap >= 70 ? "rejected" : "candidate",
      ...(overlap >= 70 ? { rejectionReasons: [{ reason: "Høy overlapp med eksisterende innhold" }] } : {}),
      checkedAt: new Date().toISOString(),
    },
  });
  return true;
}

export async function ensureManualBlogTopics(payload: Payload) {
  const existing = await existingTopics(payload);
  let created = 0;
  for (const candidate of manualTopicSeeds) {
    if (await createTopicCandidate(payload, candidate, existing)) {
      created += 1;
      existing.push({ title: candidate.topic, primaryKeyword: candidate.primaryKeyword });
    }
  }
  return created;
}

export async function importSearchSignals(payload: Payload, signals: SearchSignal[]) {
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
      existing.push({ title: candidate.topic, primaryKeyword: candidate.primaryKeyword });
    }
  }
  return { accepted, filtered, received: signals.length };
}

async function assertGeminiDailyLimit(payload: Payload, now = new Date()) {
  const configured = Number(process.env.GEMINI_DAILY_REQUEST_LIMIT || 20);
  const limit = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 20;
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const usage = await payload.count({
    collection: "seo-runs",
    overrideAccess: true,
    where: {
      and: [
        { startedAt: { greater_than_equal: start.toISOString() } },
        { jobType: { in: ["blog.article.draft", "blog.article.regenerate"] } },
      ],
    },
  });
  if (usage.totalDocs >= limit) throw new Error("Gemini daily request limit reached");
}

function relationId(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "number" ? id : undefined;
  }
  return undefined;
}

function topicFromDocument(document: Record<string, unknown>): TopicCandidate {
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
      : manualTopicSeeds[0]!.factors;
  return {
    topic: String(document.topic),
    primaryKeyword: String(document.primaryKeyword),
    secondaryKeywords: keywords,
    searchIntent: document.searchIntent as TopicCandidate["searchIntent"],
    source: document.source as TopicCandidate["source"],
    serviceKey,
    ...(document.location ? { location: String(document.location) } : {}),
    ...(document.season ? { season: String(document.season) } : {}),
    factors,
    reason: String(document.reasonForSelection || "Godkjent temakandidat"),
  };
}

async function nextTopic(payload: Payload) {
  const result = await payload.find({
    collection: "seo-topics",
    depth: 1,
    limit: 20,
    sort: "-topicScore",
    overrideAccess: true,
    where: {
      and: [
        { status: { in: ["candidate", "queued"] } },
        { overlapScore: { less_than: 70 } },
      ],
    },
  });
  return result.docs[0] || null;
}

async function availableSlug(payload: Payload, requested: string) {
  const base = requested.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "fagartikkel";
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
}) {
  const duplicate = await input.payload.find({
    collection: "seo-runs",
    depth: 1,
    limit: 1,
    overrideAccess: true,
    where: { idempotencyKey: { equals: input.idempotencyKey } },
  });
  if (duplicate.docs[0]) {
    return { duplicate: true as const, run: duplicate.docs[0] };
  }

  await ensureManualBlogTopics(input.payload);
  await assertGeminiDailyLimit(input.payload);
  const topicDocument = await nextTopic(input.payload);
  if (!topicDocument) throw new Error("No eligible SEO topic is available");
  const run = await input.payload.create({
    collection: "seo-runs",
    overrideAccess: true,
    data: {
      idempotencyKey: input.idempotencyKey,
      jobType: "blog.article.draft",
      triggerSource: input.triggerSource,
      ...(input.weekKey ? { weekKey: input.weekKey } : {}),
      ...(input.slot ? { slot: input.slot } : {}),
      status: "running",
      startedAt: new Date().toISOString(),
      selectedTopics: [topicDocument.id],
    },
  });

  try {
    const existing = await existingTopics(input.payload);
    const generated = await generateBlogDraft({
      provider: input.provider,
      topic: topicFromDocument(topicDocument as unknown as Record<string, unknown>),
      existing,
      correlationId: input.correlationId,
    });
    const primaryService = relationId(topicDocument.service);
    const slug = await availableSlug(input.payload, generated.article.slug);
    const post = await input.payload.create({
      collection: "posts",
      draft: true,
      overrideAccess: true,
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
        secondaryKeywords: generated.article.secondaryKeywords.map((keyword) => ({ keyword })),
        ...(primaryService ? { primaryService } : {}),
        ...(topicDocument.location ? { locationText: topicDocument.location } : {}),
        sources: generated.article.sources,
        authorName: "Takfornyelse",
        aiAssisted: true,
        aiGenerationRun: run.id,
        qualityScore: generated.quality.score,
        qualityChecks: generated.quality,
        reviewFlags: generated.article.claimsForReview.map((flag) => ({ flag })),
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
    await Promise.all([
      input.payload.update({
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
          createdPost: post.id,
        },
      }),
      input.payload.update({
        collection: "seo-topics",
        id: topicDocument.id,
        overrideAccess: true,
        data: { status: "drafted", relatedPost: post.id },
      }),
    ]);
    return { duplicate: false as const, run, post, generated };
  } catch (error) {
    const sanitized = sanitizeJobError(error);
    await input.payload.update({
      collection: "seo-runs",
      id: run.id,
      overrideAccess: true,
      data: {
        status: error instanceof ArticleQualityBlockedError ? "attention" : "failed",
        finishedAt: new Date().toISOString(),
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
        ...(error instanceof ArticleQualityBlockedError
          ? { qualityResult: error.quality }
          : {}),
      },
    });
    throw error;
  }
}

export async function regeneratePayloadBlogPost(input: {
  payload: Payload;
  provider: AiProvider;
  postId: number;
  idempotencyKey: string;
  correlationId: string;
}) {
  await assertGeminiDailyLimit(input.payload);
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
      secondaryKeywords: (post.secondaryKeywords || []).map((item) => item.keyword),
      searchIntent: post.searchIntent || "informational",
      source: "manual",
      serviceKey,
      ...(post.locationText ? { location: post.locationText } : {}),
      factors: manualTopicSeeds[0]!.factors,
      reason: "Regenerering av eksisterende AI-utkast etter administratorhandling.",
    };
    const existing = (await existingTopics(input.payload)).filter(
      (item) => item.title !== post.titleNo,
    );
    const generated = await generateBlogDraft({
      provider: input.provider,
      topic,
      existing,
      correlationId: input.correlationId,
    });
    const updated = await input.payload.update({
      collection: "posts",
      id: post.id,
      draft: true,
      overrideAccess: true,
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
        secondaryKeywords: generated.article.secondaryKeywords.map((keyword) => ({ keyword })),
        sources: generated.article.sources,
        aiAssisted: true,
        aiGenerationRun: run.id,
        qualityScore: generated.quality.score,
        qualityChecks: generated.quality,
        reviewFlags: generated.article.claimsForReview.map((flag) => ({ flag })),
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
    const sanitized = sanitizeJobError(error);
    await input.payload.update({
      collection: "seo-runs",
      id: run.id,
      overrideAccess: true,
      data: {
        status: error instanceof ArticleQualityBlockedError ? "attention" : "failed",
        finishedAt: new Date().toISOString(),
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
        ...(error instanceof ArticleQualityBlockedError
          ? { qualityResult: error.quality }
          : {}),
      },
    });
    throw error;
  }
}
