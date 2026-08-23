import { describe, expect, it } from "vitest";
import { DeterministicAiProvider } from "@/lib/providers/safe-providers";
import { ArticleQualityBlockedError, generateBlogDraft } from "./draft-engine";
import { validGeneratedArticle, validTopic } from "./test-fixtures";

describe("AI blog draft engine", () => {
  it("passes two complete test drafts through AI QA without publishing", async () => {
    const first = await generateBlogDraft({
      provider: new DeterministicAiProvider(validGeneratedArticle()),
      topic: validTopic,
      existing: [],
      correlationId: "phase4-test-first",
    });
    const second = await generateBlogDraft({
      provider: new DeterministicAiProvider(
        validGeneratedArticle({
          slug: "nar-bor-taket-vaskes",
          title: "Når på året bør et norsk tak vaskes?",
          primaryKeyword: "beste tid for takvask",
        }),
      ),
      topic: { ...validTopic, primaryKeyword: "beste tid for takvask" },
      existing: [],
      correlationId: "phase4-test-second",
    });
    expect([first, second].every((draft) => draft.quality.passed)).toBe(true);
    expect([first, second].every((draft) => draft.article.content.length > 700)).toBe(true);
  });

  it("never returns a blocked provider output as a draft", async () => {
    await expect(
      generateBlogDraft({
        provider: new DeterministicAiProvider({ title: "For kort" }),
        topic: validTopic,
        existing: [],
        correlationId: "phase4-test-blocked",
      }),
    ).rejects.toBeInstanceOf(ArticleQualityBlockedError);
  });
});
