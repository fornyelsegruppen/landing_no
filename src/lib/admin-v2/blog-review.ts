import {
  isPreciseSourceUrl,
  publicationReadinessErrors,
  type EditorialPost,
} from "@/lib/blog/editorial-policy";

export type ReviewIssueSeverity = "warning" | "blocker";

export type ReviewIssue = {
  code?: string | null;
  gate?: string | null;
  message?: string | null;
  severity?: ReviewIssueSeverity | null;
};

export type ReviewSource = {
  label?: string | null;
  publisher?: string | null;
  url?: string | null;
};

export type ReviewFlag = {
  flag?: string | null;
};

export type StockImageReview = {
  licenseUrl?: string | null;
  photographer?: string | null;
  photographerUrl?: string | null;
  provider?: string | null;
  query?: string | null;
  sourceUrl?: string | null;
};

export type BlogReviewInput = {
  aiAssisted?: boolean | null;
  qualityChecks?: {
    issues?: ReviewIssue[] | null;
    passed?: boolean | null;
  } | null;
  qualityScore?: number | null;
  reviewedAt?: string | null;
  reviewerName?: string | null;
  reviewFlags?: ReviewFlag[] | null;
  scheduledAt?: string | null;
  sources?: ReviewSource[] | null;
  status?: string | null;
  stockImage?: StockImageReview | null;
};

export type PublicationBlocker =
  | "approval"
  | "review_record"
  | "quality"
  | "precise_source";

function normalizedUrl(raw: string) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isHomepageOnlySource(url?: string | null) {
  if (!url?.trim()) return false;
  const parsed = normalizedUrl(url);
  if (!parsed) return false;
  return parsed.pathname === "/" || parsed.pathname === "";
}

function editorialStatus(
  status?: string | null,
): EditorialPost["editorialStatus"] {
  return [
    "draft",
    "ai_qa",
    "human_review",
    "rejected",
    "approved",
    "scheduled",
    "published",
  ].includes(status || "")
    ? (status as EditorialPost["editorialStatus"])
    : null;
}

export function blogPublishEligibility(input: BlogReviewInput) {
  return (
    publicationReadinessErrors({
      _status: input.status === "published" ? "published" : "draft",
      aiAssisted: input.aiAssisted,
      editorialStatus: editorialStatus(input.status),
      qualityChecks: input.qualityChecks
        ? { passed: input.qualityChecks.passed === true }
        : null,
      qualityScore: input.qualityScore,
      reviewedAt: input.reviewedAt,
      reviewerName: input.reviewerName,
      sources: (input.sources || []).map((source) => ({ url: source.url })),
    }).length === 0
  );
}

export function summarizeBlogReview(input: BlogReviewInput) {
  const issues = Array.isArray(input.qualityChecks?.issues)
    ? input.qualityChecks?.issues.filter(Boolean)
    : [];
  const blockers = issues.filter((issue) => issue?.severity === "blocker");
  const warnings = issues.filter((issue) => issue?.severity === "warning");
  const reviewFlags = (input.reviewFlags || [])
    .map((item) => item?.flag?.trim())
    .filter((value): value is string => Boolean(value));
  const sources = (input.sources || []).filter(Boolean);
  const homepageOnlySources = sources.filter((source) =>
    isHomepageOnlySource(source?.url),
  );
  const publishReady = blogPublishEligibility(input);
  const publicationBlockers: PublicationBlocker[] = [];
  if (
    input.status !== "approved" &&
    input.status !== "scheduled" &&
    input.status !== "published"
  ) {
    publicationBlockers.push("approval");
  }
  if (!input.reviewerName?.trim() || !input.reviewedAt) {
    publicationBlockers.push("review_record");
  }
  if (
    input.aiAssisted === true &&
    (input.qualityChecks?.passed !== true || (input.qualityScore || 0) < 75)
  ) {
    publicationBlockers.push("quality");
  }
  if (!sources.some((source) => isPreciseSourceUrl(source.url))) {
    publicationBlockers.push("precise_source");
  }

  return {
    blockers,
    warnings,
    reviewFlags,
    sources,
    homepageOnlySources,
    publicationBlockers,
    publishReady,
    qualityPassed: input.qualityChecks?.passed === true,
    qualityScore:
      typeof input.qualityScore === "number" ? input.qualityScore : null,
    scheduledAt: input.scheduledAt || null,
    stockImage: input.stockImage || null,
  };
}
