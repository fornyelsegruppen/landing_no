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
};

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
) {
  const merged = { ...(original ?? {}), ...incoming };
  const errors = validateEditorialPost(merged);
  if (errors.length) throw new TypeError(errors.join("; "));

  if (merged._status !== "published") return incoming;
  return {
    ...incoming,
    editorialStatus: "published" as const,
    publishedAt:
      incoming.publishedAt || original?.publishedAt || now.toISOString(),
  };
}

export function prepareAdminPublication(
  original: EditorialPost | null | undefined,
  incoming: EditorialPost,
  reviewerName: string,
  now: Date = new Date(),
) {
  const merged = { ...(original ?? {}), ...incoming };
  if (merged._status !== "published") {
    return prepareEditorialPost(original, incoming, now);
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
    ...incoming,
    authorName: merged.authorName?.trim() || "Takfornyelse",
    reviewerName: merged.reviewerName?.trim() || reviewerName,
    reviewedAt: merged.reviewedAt || now.toISOString(),
    editorialStatus: ["approved", "scheduled", "published"].includes(
      merged.editorialStatus || "",
    )
      ? merged.editorialStatus
      : ("approved" as const),
  };

  return prepareEditorialPost(original, reviewed, now);
}
