import type { Post } from "@/payload/payload-types";
import { evaluateArticleQuality } from "./quality-gates";
import {
  manualTopicSeeds,
  type ExistingTopic,
  type TopicCandidate,
} from "./topic-engine";

export type BlogTextEdits = {
  titleNo: string;
  excerptNo?: string | null;
  contentNo: string;
  seoTitleNo?: string | null;
  seoDescriptionNo?: string | null;
  primaryKeyword?: string | null;
};

const fallbackTopic = manualTopicSeeds[0]!;

/** Re-runs the existing deterministic AI-draft gates against administrator edits. */
export function evaluateEditedBlogDraft(input: {
  post: Post;
  edits: BlogTextEdits;
  existing?: ExistingTopic[];
  now?: Date;
}) {
  const primaryKeyword = input.edits.primaryKeyword?.trim() || "";
  const secondaryKeywords = (input.post.secondaryKeywords || []).map(
    (item) => item.keyword,
  );
  const article = {
    slug: input.post.slug,
    title: input.edits.titleNo,
    excerpt: input.edits.excerptNo || "",
    content: input.edits.contentNo,
    seoTitle: input.edits.seoTitleNo || input.edits.titleNo,
    seoDescription: input.edits.seoDescriptionNo || input.edits.excerptNo || "",
    primaryKeyword,
    secondaryKeywords,
    internalLinks: (input.post.proposedInternalLinks || []).map((link) => ({
      href: link.href,
      anchor: link.anchor,
      reason: link.reason,
    })),
    faq: (input.post.faqItems || []).map((item) => ({
      question: item.questionNo,
      answer: item.answerNo,
    })),
    sources: (input.post.sources || []).map((source) => ({
      label: source.label,
      url: source.url,
      publisher: source.publisher || "",
    })),
    ctaVariant: input.post.ctaVariant,
    imageBrief: input.post.imageBrief || "",
    imageAlt: input.post.imageAlt || "",
    claimsForReview: (input.post.reviewFlags || []).map((item) => item.flag),
    usefulnessReason:
      "Artikkelen er kontrollert på nytt etter administratorredigering.",
  };
  const topic: TopicCandidate = {
    ...fallbackTopic,
    topic: input.edits.titleNo,
    primaryKeyword,
    secondaryKeywords,
    searchIntent: input.post.searchIntent || fallbackTopic.searchIntent,
    ...(input.post.locationText ? { location: input.post.locationText } : {}),
    reason:
      "Det redigerte utkastet må bestå de samme deterministiske kvalitetsportene.",
  };

  return evaluateArticleQuality(
    article,
    topic,
    input.existing || [],
    input.now,
  );
}
