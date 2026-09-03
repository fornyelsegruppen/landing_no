export type EditorialPost = {
  _status?: "draft" | "published" | null;
  aiAssisted?: boolean | null;
  authorName?: string | null;
  contentEn?: string | null;
  contentNo?: string | null;
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
};

type EditorialPreparationOptions = {
  qualityRevalidated?: boolean;
};

const qualityInputFields = [
  "slug",
  "titleNo",
  "excerptNo",
  "contentNo",
  "seoTitleNo",
  "seoDescriptionNo",
  "primaryKeyword",
  "secondaryKeywords",
  "searchIntent",
  "locationText",
  "sources",
  "reviewFlags",
  "proposedInternalLinks",
  "ctaVariant",
  "faqItems",
  "imageBrief",
  "imageAlt",
  "aiAssisted",
] as const;

function qualityInputChanged(
  original: EditorialPost | null | undefined,
  incoming: EditorialPost,
) {
  if (!original) return false;
  const originalFields = original as Record<string, unknown>;
  const incomingFields = incoming as Record<string, unknown>;
  return qualityInputFields.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(incomingFields, field) &&
      JSON.stringify(incomingFields[field]) !==
        JSON.stringify(originalFields[field]),
  );
}

function qualityChecksPassed(value: EditorialPost["qualityChecks"]): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.passed === true,
  );
}

function invalidateStaleReview(
  original: EditorialPost | null | undefined,
  incoming: EditorialPost,
  options: EditorialPreparationOptions,
) {
  if (options.qualityRevalidated || !qualityInputChanged(original, incoming)) {
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
    post.aiAssisted === true &&
    (!qualityChecksPassed(post.qualityChecks) || (post.qualityScore || 0) < 75)
  ) {
    errors.push("AI-utkastet må bestå kvalitetskontrollen før publisering");
  }

  const preciseSourceCount = (post.sources || []).filter((source) =>
    isPreciseSourceUrl(source?.url),
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
    merged.aiAssisted === true &&
    (!qualityChecksPassed(merged.qualityChecks) ||
      (merged.qualityScore || 0) < 75)
  ) {
    throw new TypeError(
      "AI-utkastet må bestå kvalitetskontrollen før publisering",
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
    qualityRevalidated: true,
  });
}
