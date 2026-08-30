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
  qualityChecks?: { passed?: boolean | null } | null;
  qualityScore?: number | null;
  [key: string]: unknown;
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
  return qualityInputFields.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(incoming, field) &&
      JSON.stringify(incoming[field]) !== JSON.stringify(original[field]),
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
    if (!present(post.reviewerName)) errors.push("Faglig kontrollør mangler");
    if (!post.reviewedAt) errors.push("Kontrolldato mangler");
    if (
      post.editorialStatus !== "approved" &&
      post.editorialStatus !== "scheduled" &&
      post.editorialStatus !== "published"
    ) {
      errors.push("Innlegget er ikke redaksjonelt godkjent");
    }
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
  reviewerName: string,
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
    (merged.qualityChecks?.passed !== true || (merged.qualityScore || 0) < 75)
  ) {
    throw new TypeError(
      "AI-utkastet må bestå kvalitetskontrollen før publisering",
    );
  }

  const reviewed = {
    ...prepared,
    authorName: merged.authorName?.trim() || "Takfornyelse",
    reviewerName: merged.reviewerName?.trim() || reviewerName,
    reviewedAt: merged.reviewedAt || now.toISOString(),
    editorialStatus: ["approved", "scheduled", "published"].includes(
      merged.editorialStatus || "",
    )
      ? merged.editorialStatus
      : ("approved" as const),
  };

  return prepareEditorialPost(original, reviewed, now, {
    qualityRevalidated: true,
  });
}
