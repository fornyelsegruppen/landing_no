import { expect, it } from "vitest";
import {
  BLOG_QUALITY_POLICY_VERSION,
  currentBlogQualityPassed,
  hasCurrentBlogQuality,
} from "./quality-policy";
import { evaluateArticleQuality } from "./quality-gates";
import { validGeneratedArticle, validTopic } from "./test-fixtures";
import { publicationReadinessErrors } from "./editorial-policy";

it.each([
  null,
  {},
  { passed: true },
  { passed: true, policyVersion: "older" },
  { passed: true, policyVersion: "future" },
])("does not trust historical or unknown quality evidence %j", (value) => {
  expect(hasCurrentBlogQuality(value)).toBe(false);
  expect(currentBlogQualityPassed(value)).toBe(false);
});
it("recognizes a current failed check without turning it into a pass", () => {
  const value = { policyVersion: BLOG_QUALITY_POLICY_VERSION, passed: false };
  expect(hasCurrentBlogQuality(value)).toBe(true);
  expect(currentBlogQualityPassed(value)).toBe(false);
});
it("a non-AI flag does not bypass legacy quality freshness for new publication", () => {
  expect(
    publicationReadinessErrors({
      aiAssisted: false,
      editorialStatus: "approved",
      qualityChecks: { passed: true },
      qualityScore: 100,
      reviewerName: "Kari",
      reviewedAt: "2026-09-12T10:00:00.000Z",
      sources: [{ url: "https://example.invalid/source" }],
    }),
  ).not.toEqual([]);
});
it("stamps the current policy on both valid and invalid evaluator results", () => {
  for (const article of [validGeneratedArticle(), {}]) {
    expect(evaluateArticleQuality(article, validTopic).policyVersion).toBe(
      BLOG_QUALITY_POLICY_VERSION,
    );
  }
});
