import { describe, expect, it } from "vitest";
import {
  claimReviewCommitAttempt,
  reviewRequiresAcknowledgement,
} from "./review-and-commit";

describe("ReviewAndCommit risk contract", () => {
  it("does not make ritual acknowledgement the default", () => {
    expect(reviewRequiresAcknowledgement("routine")).toBe(false);
    expect(reviewRequiresAcknowledgement("material")).toBe(true);
    expect(reviewRequiresAcknowledgement("destructive")).toBe(true);
  });

  it("claims an idempotency key once until the attempt is explicitly reset", () => {
    const attempt = { current: null as string | null };

    expect(claimReviewCommitAttempt(attempt, "commit-case-42-r7")).toBe(true);
    expect(claimReviewCommitAttempt(attempt, "commit-case-42-r7")).toBe(false);

    attempt.current = null;
    expect(claimReviewCommitAttempt(attempt, "commit-case-42-r7")).toBe(true);
  });
});
