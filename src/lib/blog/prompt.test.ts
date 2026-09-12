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
    expect(combined).toContain("Takets alder er bare ett vurderingspunkt");
    expect(combined).toContain("må aldri brukes til å konkludere");
  });

  it("gives a bounded regeneration prompt the saved 587-word draft and actual quality feedback", () => {
    const article = buildBlogArticlePrompt(validTopic, [], {
      savedContent: "Lagret redaktørtekst som fortsatt har gode kilder.",
      previousWordCount: 587,
      previousQualityIssues: [
        {
          code: "content_too_short",
          severity: "warning",
          message: "Artikkelen har bare 587 ord.",
        },
        {
          code: "package_definition_drift",
          severity: "blocker",
          message: "Pakkeinnholdet må følge godkjent struktur.",
        },
      ],
      regenerationInstructions: "Behold den kontrollerte inngangen og rett bare pakkedelen.",
    });

    expect(article).toContain("Tidligere ordantall: 587");
    expect(article).toContain("content_too_short");
    expect(article).toContain("package_definition_drift");
    expect(article).toContain("Lagret redaktørtekst som fortsatt har gode kilder.");
    expect(article).toContain("Mål fortsatt 900–1400 ord; kvalitetsadvarsel gis under 700 ord.");
    expect(article).toContain("uten å svekke krav til pakker, fakta eller sikkerhet");
  });
});
