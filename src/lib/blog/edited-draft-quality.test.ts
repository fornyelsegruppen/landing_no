import { describe, expect, it } from "vitest";
import type { Post } from "@/payload/payload-types";
import { validGeneratedArticle } from "./test-fixtures";
import { evaluateEditedBlogDraft } from "./edited-draft-quality";

function postFixture(): Post {
  const article = validGeneratedArticle();
  return {
    id: 9,
    slug: article.slug,
    titleNo: article.title,
    excerptNo: article.excerpt,
    contentNo: article.content,
    seoTitleNo: article.seoTitle,
    seoDescriptionNo: article.seoDescription,
    editorialStatus: "ai_qa",
    searchIntent: "commercial",
    primaryKeyword: article.primaryKeyword,
    secondaryKeywords: article.secondaryKeywords.map((keyword) => ({
      keyword,
    })),
    sources: article.sources,
    proposedInternalLinks: article.internalLinks,
    faqItems: article.faq.map((item) => ({
      questionNo: item.question,
      answerNo: item.answer,
    })),
    ctaVariant: article.ctaVariant,
    imageBrief: article.imageBrief,
    imageAlt: article.imageAlt,
    reviewFlags: article.claimsForReview.map((flag) => ({ flag })),
    aiAssisted: true,
    updatedAt: "2026-08-30T12:00:00.000Z",
    createdAt: "2026-08-30T12:00:00.000Z",
    _status: "draft",
  };
}

describe("edited blog draft quality", () => {
  it("re-evaluates the current edited text with the existing deterministic gates", () => {
    const post = postFixture();
    const result = evaluateEditedBlogDraft({
      post,
      edits: {
        titleNo: post.titleNo,
        excerptNo: post.excerptNo,
        contentNo: post.contentNo,
        seoTitleNo: post.seoTitleNo,
        seoDescriptionNo: post.seoDescriptionNo,
        primaryKeyword: post.primaryKeyword,
      },
      now: new Date("2026-08-30T13:00:00.000Z"),
    });

    expect(result).toMatchObject({
      passed: true,
      score: 100,
      checkedAt: "2026-08-30T13:00:00.000Z",
    });
  });

  it("blocks newly introduced unsafe claims instead of preserving stale QA", () => {
    const post = postFixture();
    const result = evaluateEditedBlogDraft({
      post,
      edits: {
        titleNo: post.titleNo,
        excerptNo: post.excerptNo,
        contentNo: `${post.contentNo}\n\nVi garanterer 20 års garanti. Du kan klatre på taket selv.`,
        seoTitleNo: post.seoTitleNo,
        seoDescriptionNo: post.seoDescriptionNo,
        primaryKeyword: post.primaryKeyword,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported_guarantee" }),
        expect.objectContaining({ code: "unsafe_roof_advice" }),
      ]),
    );
  });

  it("fails QA when an administrator clears the primary keyword", () => {
    const post = postFixture();
    const result = evaluateEditedBlogDraft({
      post,
      edits: {
        titleNo: post.titleNo,
        excerptNo: post.excerptNo,
        contentNo: post.contentNo,
        seoTitleNo: post.seoTitleNo,
        seoDescriptionNo: post.seoDescriptionNo,
        primaryKeyword: "",
      },
    });

    expect(result).toMatchObject({ passed: false, score: 0 });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_output",
          severity: "blocker",
        }),
      ]),
    );
  });
});
