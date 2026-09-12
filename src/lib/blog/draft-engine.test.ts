import { describe, expect, it } from "vitest";
import { DeterministicAiProvider } from "@/lib/providers/safe-providers";
import type { AiProvider } from "@/lib/providers/contracts";
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
    expect(
      [first, second].every((draft) => draft.article.content.length > 700),
    ).toBe(true);
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

  it("returns the repeated-prose issue through the normal draft-quality pipeline", async () => {
    const paragraph =
      "En faglig vurdering av taket tar utgangspunkt i materiale, alder, synlige flater og trygg adkomst før et tiltak anbefales. Boligeieren får forklart hvilke observasjoner som er relevante, hvilke spørsmål som bør avklares, og hvorfor endelig omfang må beskrives i et skriftlig tilbud før arbeidet planlegges.";
    const content = `${validGeneratedArticle().content}\n\n${Array.from({ length: 3 }, () => paragraph).join("\n\n")}`;

    await expect(
      generateBlogDraft({
        provider: new DeterministicAiProvider(
          validGeneratedArticle({ content }),
        ),
        topic: validTopic,
        existing: [],
        correlationId: "repeated-prose-quality-block",
      }),
    ).rejects.toMatchObject({
      name: "ArticleQualityBlockedError",
      quality: expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "repeated_meaningful_paragraph" }),
        ]),
      }),
    });
  });

  it("passes 587-word repair feedback to the provider and still blocks a bad replacement", async () => {
    const provider: AiProvider = {
      health: () => ({ status: "ready", provider: "test" }),
      generate: async (request) => {
        expect(request.prompt).toContain("Tidligere ordantall: 587");
        expect(request.prompt).toContain("content_too_short");
        return {
          data: { title: "For kort" },
          provider: "test",
          model: "test-model",
          promptVersion: "test-prompt",
        };
      },
    };

    await expect(
      generateBlogDraft({
        provider,
        topic: validTopic,
        existing: [],
        correlationId: "phase1-regeneration-feedback",
        regenerationFeedback: {
          savedContent: "Tidligere redigert innhold.",
          previousWordCount: 587,
          previousQualityIssues: [
            {
              code: "content_too_short",
              severity: "warning",
              message: "Artikkelen har bare 587 ord.",
            },
          ],
        },
      }),
    ).rejects.toMatchObject({
      name: "ArticleQualityBlockedError",
      provenance: expect.objectContaining({ model: "test-model" }),
    });
  });

  it("normalizes approved Norwegian and package copy before deterministic QA", async () => {
    const base = validGeneratedArticle();
    const result = await generateBlogDraft({
      provider: new DeterministicAiProvider(
        validGeneratedArticle({
          content: `${base.content}

## Pakker

* Basic: Standard overflatebehandling.
* Standard: Impregnering som styrker taksteinen.
* Premium: Dypere beskyttelse og maling.

Impregnering som redusere fuktopptak krever kontroll. Be om postnummer, valgfri adresse og gjerne bilder, uten å love endelig teknisk konklusjon eller pris.`,
        }),
      ),
      topic: validTopic,
      existing: [],
      correlationId: "phase4-test-normalized",
    });

    expect(result.quality.passed).toBe(true);
    expect(result.article.content).toContain(
      "Standard fra 172,50 kr/m² inkl. mva (138 kr/m² ekskl. mva): alt i Basic",
    );
    expect(result.article.content).toContain("som reduserer fuktopptak");
    expect(result.article.content).not.toContain("uten å love");
  });
});
