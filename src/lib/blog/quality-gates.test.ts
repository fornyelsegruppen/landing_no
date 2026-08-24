import { describe, expect, it } from "vitest";
import { evaluateArticleQuality } from "./quality-gates";
import { validGeneratedArticle, validTopic } from "./test-fixtures";

describe("blog quality gates", () => {
  it("accepts a useful sourced Norwegian draft", () => {
    expect(evaluateArticleQuality(validGeneratedArticle(), validTopic)).toMatchObject({
      passed: true,
      score: 100,
    });
  });

  it("blocks invented prices, guarantees and dangerous roof advice", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}\n\nDette koster 150 kr/m2. Vi garanterer 20 års garanti. Du kan klatre på taket selv.`,
      }),
      validTopic,
    );
    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unapproved_price",
        "unsupported_guarantee",
        "unsafe_roof_advice",
      ]),
    );
  });

  it("blocks high semantic overlap", () => {
    const result = evaluateArticleQuality(validGeneratedArticle(), validTopic, [
      { title: "Hva påvirker prisen på profesjonell takvask?", primaryKeyword: "takvask pris" },
    ]);
    expect(result.passed).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "high_overlap" }));
  });

  it("blocks invented internal routes and warns about homepage-only sources", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        internalLinks: [{ href: "/tjenester/takvask", anchor: "takvask", reason: "Tjeneste" }],
        sources: [{ label: "SINTEF", url: "https://www.sintef.no", publisher: "SINTEF" }],
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_internal_link", severity: "blocker" }),
      expect.objectContaining({ code: "source_homepage_only", severity: "warning" }),
    ]));
  });
});
