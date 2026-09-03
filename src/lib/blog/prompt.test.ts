import { describe, expect, it } from "vitest";
import { buildBlogArticlePrompt, buildBlogSystemPrompt } from "./prompt";
import { validTopic } from "./test-fixtures";

describe("blog generator prompt guardrails", () => {
  it("pins package definitions, cautious claims, CTA and source relevance", () => {
    const system = buildBlogSystemPrompt();
    const article = buildBlogArticlePrompt(validTopic, []);
    const combined = `${system}\n${article}`;

    expect(combined).toContain("Basic er takvask");
    expect(combined).toContain("Standard er alt i Basic pluss impregnering");
    expect(combined).toContain(
      "Premium er alt i Standard pluss profesjonell takmaling",
    );
    expect(combined).toContain("Ikke skriv at impregnering styrker taksteinen");
    expect(combined).toContain("kan bidra");
    expect(combined).toContain("impregnering som reduserer fuktopptak");
    expect(combined).toContain("Ikke kall sot organisk materiale");
    expect(combined).toContain("gratis og uforpliktende vurdering");
    expect(combined).toContain("Ikke kopier interne instruksjoner");
    expect(combined).toContain("generell forskriftsindeks");
    expect(combined).toContain("TEK17 § 13-12. Nedbør");
    expect(combined).toContain("mose, lav eller alger");
    expect(combined).toContain("faktiske motivet");
  });
});
