import { currentBlogQualityPassed } from "./quality-policy";

export type EditorialPost = {
  _status?: "draft" | "published" | null;
  aiAssisted?: boolean | null;
  authorName?: string | null;
  category?: string | null;
  contentEn?: string | null;
  contentNo?: string | null;
  ctaVariant?: string | null;
  editorialStatus?:
    | "draft"
    | "ai_qa"
    | "human_review"
    | "rejected"
    | "approved"
    | "scheduled"
    | "published"
    | null;
  reviewedAt?: string | null;
  reviewerName?: string | null;
  scheduledAt?: string | null;
  titleEn?: string | null;
  titleNo?: string | null;
  publishedAt?: string | null;
  excerptEn?: string | null;
  excerptNo?: string | null;
  faqItems?: unknown;
  heroImage?: unknown;
  imageAlt?: string | null;
  imageBrief?: string | null;
  locationText?: string | null;
  primaryKeyword?: string | null;
  proposedInternalLinks?: unknown;
  qualityChecks?:
    | { passed?: boolean | null; [key: string]: unknown }
    | string
    | number
    | boolean
    | unknown[]
    | null;
  qualityScore?: number | null;
  sources?: Array<{
    url?: string | null;
  }> | null;
  relatedPosts?: unknown;
  relatedServices?: unknown;
  reviewFlags?: unknown;
  searchIntent?: string | null;
  seoDescriptionEn?: string | null;
  seoDescriptionNo?: string | null;
  seoTitleEn?: string | null;
  seoTitleNo?: string | null;
  secondaryKeywords?: unknown;
  stockImage?: unknown;
};

type EditorialPreparationOptions = {
  forceReviewReset?: boolean;
  qualityRevalidated?: boolean;
};

// These fields feed the public blog renderer, its localized metadata/schema, image
// attribution, FAQ/related/CTA sections, or public guide listing. The stable field
// ordering gives one central invalidation fingerprint. It is not a canonical
// immutable approval identity: nested/relation values need normalization before a
// later persisted approval token can rely on it.
export const publicPostContentFields = [
  "slug",
  "titleNo",
  "titleEn",
  "excerptNo",
  "excerptEn",
  "contentNo",
  "contentEn",
  "seoTitleNo",
  "seoTitleEn",
  "seoDescriptionNo",
  "seoDescriptionEn",
  "heroImage",
  "stockImage",
  "imageAlt",
  "authorName",
  "publishedAt",
  "sources",
  "faqItems",
  "relatedPosts",
  "relatedServices",
  "ctaVariant",
  "category",
  "locationText",
  "imageBrief",
  "primaryKeyword",
  "secondaryKeywords",
  "searchIntent",
  "reviewFlags",
  "proposedInternalLinks",
  "aiAssisted",
] as const;

export function publicPostContentFingerprint(
  fields: Readonly<Record<string, unknown>>,
): string {
  return JSON.stringify(
    publicPostContentFields.map((field) => [field, fields[field] ?? null]),
  );
}

function publicContentChanged(
  original: EditorialPost | null | undefined,
  incoming: EditorialPost,
) {
  if (!original || Object.keys(original).length === 0) return false;
  const merged = { ...original, ...incoming };
  // The first draft -> published transition necessarily supplies public author
  // metadata. It is not itself an editorial content change; compare all other
  // public fields normally so a changed draft still cannot bypass review.
  const originalForComparison =
    original._status !== "published" &&
    !original.publishedAt &&
    !original.authorName?.trim() &&
    merged._status === "published"
      ? {
          ...original,
          authorName: merged.authorName,
          publishedAt: merged.publishedAt,
        }
      : original;
  return (
    publicPostContentFingerprint(
      originalForComparison as Record<string, unknown>,
    ) !== publicPostContentFingerprint(merged as Record<string, unknown>)
  );
}

function invalidateStaleReview(
  original: EditorialPost | null | undefined,
  incoming: EditorialPost,
  options: EditorialPreparationOptions,
) {
  if (
    !options.forceReviewReset &&
    (options.qualityRevalidated || !publicContentChanged(original, incoming))
  ) {
    return incoming;
  }
  return {
    ...incoming,
    _status: "draft" as const,
    editorialStatus: "human_review" as const,
    qualityScore: null,
    qualityChecks: null,
    scheduledAt: null,
    reviewerName: null,
    reviewedAt: null,
    ...(original?.aiAssisted === true ? { aiAssisted: true } : {}),
    ...(original?.publishedAt ? { publishedAt: original.publishedAt } : {}),
  };
}

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function isPreciseSourceUrl(url: string | null | undefined) {
  try {
    const parsed = new URL(url || "");
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.pathname !== "/" &&
      parsed.pathname !== ""
    );
  } catch {
    return false;
  }
}

const genericSourceKeys = new Set([
  "dibk.no/regelverk/byggteknisk-forskrift-tek17",
]);

function normalizedSourceKey(url: string) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.toLowerCase().replace(/\/$/, "");
  return `${host}${path}`;
}

export function isSubstantiveBlogSourceUrl(url: string | null | undefined) {
  if (!isPreciseSourceUrl(url)) return false;
  try {
    return !genericSourceKeys.has(normalizedSourceKey(url || ""));
  } catch {
    return false;
  }
}

export function publicationReadinessErrors(post: EditorialPost): string[] {
  const errors: string[] = [];
  const alreadyPublished =
    post._status === "published" && post.editorialStatus === "published";

  if (
    post.editorialStatus !== "approved" &&
    post.editorialStatus !== "scheduled" &&
    !alreadyPublished
  ) {
    errors.push("Innlegget må være godkjent før publisering");
  }

  if (!present(post.reviewerName)) {
    errors.push("Faglig kontrollør mangler");
  }

  if (!post.reviewedAt) {
    errors.push("Kontrolldato mangler");
  }

  if (
    !currentBlogQualityPassed(post.qualityChecks) ||
    (post.qualityScore || 0) < 75
  ) {
    errors.push(
      "Artikkelen må bestå kvalitetskontrollen etter gjeldende regler. Kjør kontrollen på nytt i Admin V2 før publisering.",
    );
  }

  const preciseSourceCount = (post.sources || []).filter((source) =>
    isSubstantiveBlogSourceUrl(source?.url),
  ).length;
  if (preciseSourceCount < 1) {
    errors.push("Minst én presis kilde må være lagt inn før publisering");
  }

  return errors;
}

export function assertPostPublishable(post: EditorialPost) {
  const errors = publicationReadinessErrors(post);
  if (errors.length) throw new TypeError(errors.join("; "));
  return true;
}

export function availablePostLocales(post: EditorialPost): ("no" | "en")[] {
  const locales: ("no" | "en")[] = [];
  if (present(post.titleNo) && present(post.contentNo)) locales.push("no");
  if (present(post.titleEn) && present(post.contentEn)) locales.push("en");
  return locales;
}

export function validateEditorialPost(post: EditorialPost): string[] {
  const errors: string[] = [];

  if (!present(post.titleNo)) errors.push("Norsk tittel mangler");
  if (!present(post.contentNo)) errors.push("Norsk innhold mangler");

  if (
    post.scheduledAt &&
    post.editorialStatus !== "approved" &&
    post.editorialStatus !== "scheduled"
  ) {
    errors.push("Bare godkjente innlegg kan planlegges");
  }

  if (post._status === "published") {
    if (!present(post.authorName)) errors.push("Forfatter mangler");
    errors.push(...publicationReadinessErrors(post));
  }

  return errors;
}

export function prepareEditorialPost(
  original: EditorialPost | null | undefined,
  incoming: EditorialPost,
  now: Date = new Date(),
  options: EditorialPreparationOptions = {},
) {
  const prepared = invalidateStaleReview(original, incoming, options);
  const merged = { ...(original ?? {}), ...prepared };
  const errors = validateEditorialPost(merged);
  if (errors.length) throw new TypeError(errors.join("; "));
  if (
    ["approved", "scheduled"].includes(prepared.editorialStatus || "") &&
    (!currentBlogQualityPassed(merged.qualityChecks) ||
      (merged.qualityScore || 0) < 75)
  ) {
    throw new TypeError(
      "Current deterministic quality review is required before approval or scheduling. Run the quality check again in Admin V2.",
    );
  }
  if (merged._status !== "published") return prepared;
  return {
    ...prepared,
    editorialStatus: "published" as const,
    publishedAt:
      prepared.publishedAt || original?.publishedAt || now.toISOString(),
  };
}

export function prepareAdminPublication(
  original: EditorialPost | null | undefined,
  incoming: EditorialPost,
  _reviewerName: string,
  now: Date = new Date(),
  options: EditorialPreparationOptions = {},
) {
  const prepared = invalidateStaleReview(original, incoming, options);
  const merged = { ...(original ?? {}), ...prepared };
  if (merged._status !== "published") {
    return prepareEditorialPost(original, prepared, now, {
      qualityRevalidated: true,
    });
  }

  if (
    !currentBlogQualityPassed(merged.qualityChecks) ||
    (merged.qualityScore || 0) < 75
  ) {
    throw new TypeError(
      "Artikkelen må bestå kvalitetskontrollen etter gjeldende regler. Kjør kontrollen på nytt i Admin V2 før publisering.",
    );
  }

  const reviewed = {
    ...prepared,
    authorName: merged.authorName?.trim() || "Takfornyelse",
    reviewerName: merged.reviewerName,
    reviewedAt: merged.reviewedAt,
    editorialStatus: merged.editorialStatus,
  };

  return prepareEditorialPost(original, reviewed, now, {
    ...options,
    qualityRevalidated: true,
  });
}
