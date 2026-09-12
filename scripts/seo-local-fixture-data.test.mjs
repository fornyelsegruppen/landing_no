import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fixtureMetadataPatch,
  localReviewFlags,
} from "./seo-local-fixture-data.mjs";
test("review canary is opt-in and cannot enable AI or configure an executor", () => {
  assert.deepEqual(localReviewFlags(), {
    FEATURE_AI_DRAFTS: "false",
    FEATURE_SEO_SCHEDULER: "false",
    FEATURE_SEO_AUTO_PUBLISH: "false",
  });
  assert.deepEqual(localReviewFlags(true), {
    FEATURE_AI_DRAFTS: "false",
    FEATURE_SEO_SCHEDULER: "true",
    FEATURE_SEO_AUTO_PUBLISH: "true",
  });
});
const article = {
  secondaryKeywords: ["takvask"],
  internalLinks: [{ href: "/takvask" }],
  faq: [{ question: "Q", answer: "A" }],
  ctaVariant: "assessment",
  imageBrief: "synthetic brief",
  imageAlt: "synthetic alt",
  claimsForReview: ["synthetic"],
};
test("repair fills missing structural metadata without touching operator content or existing metadata", () => {
  const post = {
    slug: "seo-local-draft",
    authorName: "Synthetic local fixture",
    contentNo: "operator edited text",
    titleNo: "operator title",
    imageAlt: "operator alt",
    faqItems: [{ questionNo: "operator question" }],
    qualityChecks: { passed: false },
    reviewerName: "operator",
  };
  const before = JSON.stringify(post);
  const patch = fixtureMetadataPatch(post, article);
  for (const protectedField of [
    "contentNo",
    "titleNo",
    "imageAlt",
    "faqItems",
    "qualityChecks",
    "reviewerName",
    "_status",
    "editorialStatus",
  ])
    assert.equal(protectedField in patch, false);
  assert.equal(patch.imageBrief, article.imageBrief);
  assert.equal(JSON.stringify(post), before);
  assert.deepEqual(fixtureMetadataPatch({ ...post, ...patch }, article), {});
});
test("repair refuses ordinary articles even when their title resembles a fixture", () => {
  assert.throws(() =>
    fixtureMetadataPatch(
      { slug: "ordinary-post", authorName: "Synthetic local fixture" },
      article,
    ),
  );
  assert.throws(() =>
    fixtureMetadataPatch(
      { slug: "seo-local-draft", authorName: "Real author" },
      article,
    ),
  );
});
