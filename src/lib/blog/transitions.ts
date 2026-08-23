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

export function assertBlogAction(
  input: BlogTransitionInput,
  action: "approve" | "reject" | "schedule" | "publish" | "regenerate",
  scheduledAt?: string,
  now: Date = new Date(),
) {
  if (input.status === "published" && action !== "publish") {
    throw new TypeError("Published articles cannot use this action");
  }
  if (action === "approve") {
    if (!["ai_qa", "human_review", "rejected"].includes(input.status)) {
      throw new TypeError("Only reviewed drafts can be approved");
    }
    if (!input.qualityPassed || (input.qualityScore || 0) < 75) {
      throw new TypeError("The deterministic quality gate has not passed");
    }
    if (!input.reviewerName?.trim()) {
      throw new TypeError("Reviewer name is required");
    }
  }
  if (action === "schedule") {
    if (input.status !== "approved") {
      throw new TypeError("Only approved articles can be scheduled");
    }
    const date = scheduledAt ? new Date(scheduledAt) : null;
    if (!date || Number.isNaN(date.getTime()) || date <= now) {
      throw new TypeError("A future publishing time is required");
    }
  }
  if (action === "publish") {
    if (!["approved", "scheduled", "published"].includes(input.status)) {
      throw new TypeError("Only approved articles can be published");
    }
    if (!input.reviewerName?.trim() || !input.reviewedAt) {
      throw new TypeError("Human review evidence is required");
    }
  }
  return true;
}
