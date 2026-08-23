import { describe, expect, it } from "vitest";
import { assertBlogAction } from "./transitions";

describe("editorial admin actions", () => {
  it("requires passed QA and a named reviewer before approval", () => {
    expect(() =>
      assertBlogAction({ status: "ai_qa", qualityPassed: false, qualityScore: 100 }, "approve"),
    ).toThrow(/quality gate/);
    expect(
      assertBlogAction(
        { status: "ai_qa", qualityPassed: true, qualityScore: 90, reviewerName: "Kari" },
        "approve",
      ),
    ).toBe(true);
  });

  it("requires approval before scheduling and review before publishing", () => {
    expect(() =>
      assertBlogAction(
        { status: "ai_qa", qualityPassed: true, qualityScore: 90, reviewerName: "Kari" },
        "schedule",
        "2027-01-01T08:00:00.000Z",
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toThrow(/Only approved/);
    expect(() =>
      assertBlogAction({ status: "scheduled" }, "publish"),
    ).toThrow(/Human review/);
  });
});
