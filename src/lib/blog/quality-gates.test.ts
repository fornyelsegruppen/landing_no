import { describe, expect, it } from "vitest";
import { evaluateArticleQuality } from "./quality-gates";
import { validGeneratedArticle, validTopic } from "./test-fixtures";

describe("blog quality gates", () => {
  it("accepts a useful sourced Norwegian draft", () => {
    expect(
      evaluateArticleQuality(validGeneratedArticle(), validTopic),
    ).toMatchObject({
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
      {
        title: "Hva påvirker prisen på profesjonell takvask?",
        primaryKeyword: "takvask pris",
      },
    ]);
    expect(result.passed).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "high_overlap" }),
    );
  });

  it("blocks invented internal routes and homepage-only sources", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        internalLinks: [
          { href: "/tjenester/takvask", anchor: "takvask", reason: "Tjeneste" },
        ],
        sources: [
          {
            label: "SINTEF",
            url: "https://www.sintef.no",
            publisher: "SINTEF",
          },
        ],
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_internal_link",
          severity: "blocker",
        }),
        expect.objectContaining({
          code: "source_homepage_only",
          severity: "blocker",
        }),
        expect.objectContaining({
          code: "missing_precise_source",
          severity: "blocker",
        }),
      ]),
    );
  });

  it("blocks the Norwegian, package, treatment and CTA defects found by the canary", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}

## Pakkene

- Basic: For deg som kun ønsker standard overflatebehandling.
- Standard: Inkluderer grundigere vask og impregnering som styrker taksteinen.
- Premium: Fullstendig fornyelse med dypere beskyttelse og maling.

Taksteinen er sterkt angrepet av tilstoppinger. Bratte tak krever ekstra omtanke under utførelsen, og geografiske beliggenhet påvirker prisen. Med riktig arbeid forlenger du takets levetid betraktelig. Du kan bestille en [takfornying](/takfornying) for en faglig gjennomgang.`,
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unnatural_norwegian",
        "package_definition_drift",
        "unsupported_impregnation_claim",
        "unsupported_lifetime_claim",
        "inspection_cta_mismatch",
      ]),
    );
  });

  it("accepts the approved package structure and cautious treatment language", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}

## Pakkene

- Basic: Taksjekk, mosebehandling og skånsom takvask.
- Standard: Alt i Basic, samt beskyttende impregnering som reduserer fuktopptak på egnet takstein.
- Premium: Alt i Standard, samt profesjonell takmaling og valg av passende takfarge.

Når taket er teknisk egnet, kan riktig behandling bidra til å forlenge takets levetid. Be om en gratis og uforpliktende vurdering.`,
      }),
      validTopic,
    );

    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "package_definition_drift" }),
        expect.objectContaining({ code: "unsupported_lifetime_claim" }),
      ]),
    );
  });

  it("rejects the generic TEK17 index as the only substantive source", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        sources: [
          {
            label: "Byggteknisk forskrift (TEK17)",
            url: "https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17",
            publisher: "Direktoratet for byggkvalitet",
          },
        ],
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "generic_source_index",
          severity: "blocker",
        }),
        expect.objectContaining({
          code: "missing_precise_source",
          severity: "blocker",
        }),
      ]),
    );
  });
});
