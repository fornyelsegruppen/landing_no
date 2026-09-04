import { describe, expect, it } from "vitest";
import { reviewRequiresAcknowledgement } from "./review-and-commit";

describe("ReviewAndCommit risk contract", () => {
  it("does not make ritual acknowledgement the default", () => {
    expect(reviewRequiresAcknowledgement("routine")).toBe(false);
    expect(reviewRequiresAcknowledgement("material")).toBe(true);
    expect(reviewRequiresAcknowledgement("destructive")).toBe(true);
  });
});
