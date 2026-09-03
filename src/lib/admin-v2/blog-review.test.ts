import { describe, expect, it } from "vitest";
import {
  blogPublishEligibility,
  isHomepageOnlySource,
  summarizeBlogReview,
} from "./blog-review";

describe("blog review helpers", () => {
  it("flags homepage-only sources", () => {
    expect(isHomepageOnlySource("https://example.com/")).toBe(true);
    expect(isHomepageOnlySource("https://example.com/article")).toBe(false);
    expect(isHomepageOnlySource("not-a-url")).toBe(false);
  });

  it("allows direct publish only for approved or scheduled status", () => {
    const approved = {
      status: "approved",
      reviewerName: "Kari",
      reviewedAt: "2026-09-03T01:00:00.000Z",
      sources: [{ url: "https://example.com/article" }],
    };
    expect(blogPublishEligibility(approved)).toBe(true);
    expect(blogPublishEligibility({ ...approved, status: "scheduled" })).toBe(
      true,
    );
    expect(
      blogPublishEligibility({ ...approved, status: "human_review" }),
    ).toBe(false);
    expect(blogPublishEligibility({ ...approved, reviewerName: null })).toBe(
      false,
    );
    expect(
      blogPublishEligibility({
        ...approved,
        aiAssisted: true,
        qualityChecks: { passed: false },
        qualityScore: 90,
      }),
    ).toBe(false);
  });

  it("summarizes issues, review flags and homepage risks", () => {
    const review = summarizeBlogReview({
      qualityChecks: {
        passed: false,
        issues: [
          { code: "missing_internal_link", severity: "blocker" },
          { code: "source_homepage_only", severity: "warning" },
        ],
      },
      qualityScore: 68,
      aiAssisted: true,
      reviewerName: "Kari",
      reviewedAt: "2026-09-03T01:00:00.000Z",
      reviewFlags: [{ flag: "Verify latest municipal guidance." }],
      sources: [
        {
          label: "Publisher homepage",
          url: "https://example.com/",
        },
        {
          label: "Specific source",
          url: "https://example.com/rules/tak",
        },
      ],
      status: "human_review",
      stockImage: { provider: "pexels" },
    });

    expect(review.blockers).toHaveLength(1);
    expect(review.warnings).toHaveLength(1);
    expect(review.reviewFlags).toEqual(["Verify latest municipal guidance."]);
    expect(review.homepageOnlySources).toHaveLength(1);
    expect(review.publicationBlockers).toEqual(["approval", "quality"]);
    expect(review.publishReady).toBe(false);
    expect(review.stockImage).toEqual({ provider: "pexels" });
  });
});
