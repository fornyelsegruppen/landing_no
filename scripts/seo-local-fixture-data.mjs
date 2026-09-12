export function localReviewFlags(reviewCanary = false) {
  return {
    FEATURE_AI_DRAFTS: "false",
    FEATURE_SEO_SCHEDULER: reviewCanary ? "true" : "false",
    FEATURE_SEO_AUTO_PUBLISH: reviewCanary ? "true" : "false",
  };
}

/** Missing metadata only; never replace an operator's saved text or review. */
export function fixtureMetadataPatch(post, article) {
  if (
    !["seo-local-draft", "seo-local-published-with-draft"].includes(
      post.slug,
    ) ||
    post.authorName !== "Synthetic local fixture"
  ) {
    throw new Error("Refusing to repair a non-fixture article");
  }
  const candidates = {
    secondaryKeywords: article.secondaryKeywords.map((keyword) => ({
      keyword,
    })),
    proposedInternalLinks: article.internalLinks,
    faqItems: article.faq.map((item) => ({
      questionNo: item.question,
      answerNo: item.answer,
    })),
    ctaVariant: article.ctaVariant,
    imageBrief: article.imageBrief,
    imageAlt: article.imageAlt,
    reviewFlags: article.claimsForReview.map((flag) => ({ flag })),
  };
  return Object.fromEntries(
    Object.entries(candidates).filter(([key]) => {
      const value = post[key];
      return (
        value == null ||
        (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && value.length === 0)
      );
    }),
  );
}
