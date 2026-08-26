type ReviewerUser = {
  displayName?: string | null;
  email?: string | null;
};

const professionalReviewerFallback = "Fagansvarlig i Takfornyelse";

export function publicReviewerName(
  value: string | null | undefined,
): string | null {
  const name = value?.trim();
  if (!name) return null;
  if (name.includes("@") || /^https?:\/\//i.test(name)) {
    return professionalReviewerFallback;
  }
  return name;
}

export function reviewerNameForUser(user: unknown): string {
  if (!user || typeof user !== "object") return professionalReviewerFallback;
  const candidate = user as ReviewerUser;
  return candidate.displayName?.trim() || professionalReviewerFallback;
}
