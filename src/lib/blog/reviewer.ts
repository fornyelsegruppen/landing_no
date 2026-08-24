type ReviewerUser = {
  displayName?: string | null;
  email?: string | null;
};

export function reviewerNameForUser(user: unknown): string {
  if (!user || typeof user !== "object") return "Administrator";
  const candidate = user as ReviewerUser;
  return (
    candidate.displayName?.trim() || candidate.email?.trim() || "Administrator"
  );
}
