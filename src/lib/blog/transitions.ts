export type BlogEditorialStatus =
  | "draft"
  | "ai_qa"
  | "human_review"
  | "rejected"
  | "approved"
  | "scheduled"
  | "published";

type BlogTransitionInput = {
  status: BlogEditorialStatus;
  qualityScore?: number | null;
  qualityPassed?: boolean;
  reviewerName?: string | null;
  reviewedAt?: string | null;
};

export class BlogTransitionError extends TypeError {
  constructor(
    readonly code:
      | "INVALID_TRANSITION"
      | "QUALITY_NOT_READY"
      | "REVIEWER_REQUIRED"
      | "FUTURE_SCHEDULE_REQUIRED"
      | "PUBLICATION_NOT_READY",
    message: string,
  ) {
    super(message);
    this.name = "BlogTransitionError";
  }
}

export function assertBlogAction(
  input: BlogTransitionInput,
  action: "approve" | "reject" | "schedule" | "publish" | "regenerate",
  scheduledAt?: string,
  now: Date = new Date(),
) {
  if (input.status === "published" && action !== "publish") {
    throw new BlogTransitionError(
      "INVALID_TRANSITION",
      "Published articles cannot use this action",
    );
  }
  if (action === "approve") {
    if (!["ai_qa", "human_review", "rejected"].includes(input.status)) {
      throw new BlogTransitionError(
        "INVALID_TRANSITION",
        "Only reviewed drafts can be approved",
      );
    }
    if (!input.qualityPassed || (input.qualityScore || 0) < 75) {
      throw new BlogTransitionError(
        "QUALITY_NOT_READY",
        "The deterministic quality gate has not passed",
      );
    }
    if (!input.reviewerName?.trim()) {
      throw new BlogTransitionError(
        "REVIEWER_REQUIRED",
        "Reviewer name is required",
      );
    }
  }
  if (action === "schedule") {
    if (!["approved", "scheduled"].includes(input.status)) {
      throw new BlogTransitionError(
        "INVALID_TRANSITION",
        "Only approved articles can be scheduled",
      );
    }
    if (!input.qualityPassed || (input.qualityScore || 0) < 75) {
      throw new BlogTransitionError(
        "QUALITY_NOT_READY",
        "The deterministic quality gate has not passed",
      );
    }
    if (!input.reviewerName?.trim() || !input.reviewedAt) {
      throw new BlogTransitionError(
        "REVIEWER_REQUIRED",
        "Recorded human review is required",
      );
    }
    const date = scheduledAt ? new Date(scheduledAt) : null;
    if (!date || Number.isNaN(date.getTime()) || date <= now) {
      throw new BlogTransitionError(
        "FUTURE_SCHEDULE_REQUIRED",
        "A future publishing time is required",
      );
    }
  }
  if (action === "publish") {
    if (!["approved", "scheduled", "published"].includes(input.status)) {
      throw new BlogTransitionError(
        "INVALID_TRANSITION",
        "Only approved articles can be published",
      );
    }
    if (!input.reviewerName?.trim()) {
      throw new BlogTransitionError(
        "REVIEWER_REQUIRED",
        "Reviewer name is required",
      );
    }
  }
  return true;
}
