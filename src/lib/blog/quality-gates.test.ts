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

  it("blocks the grammar, category and instruction leaks found in post 5", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}

Standard inkluderer impregnering som redusere fuktopptak på egnet takstein. Et bratt tak kan ha høyt monterte flater, og det er streng regulering knyttet til sikring. Taket samler organisk materiale som mose og sot. Be om postnummer, valgfri adresse og gjerne bilder, uten å love endelig teknisk konklusjon eller pris.`,
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unnatural_norwegian",
        "material_category_error",
        "internal_instruction_leak",
      ]),
    );
  });

  it("blocks the awkward prose and third-person CTA found in post 6", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}

Når man vurderer å friske opp boligens øverste flater, dukker spørsmålet om timing naturlig opp. For at en takvask og påfølgende behandlinger skal få gode vilkår, må klimaet spille på lag. Lang soltid tørker opp taket raskt, mens høsten gir nedfall i form av blader.

For å forberede vurderingen kan kunden oppgi postnummer, valgfri adresse og gjerne sende bilder.`,
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unnatural_norwegian",
        "internal_instruction_leak",
      ]),
    );
  });

  it("blocks the language and unsupported roof-function claims found in post 7", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}

Det finnes flere tydelige indikasjonar på at taket har det vanskelig. Du kan oppgi postnummer, samt sende gjerne bilder. Taksteinen har mistet sin opprinnelige form og bæreevne. Hvis overflatebehandling ikke lenger kan sikre denne tette funksjonen, er et uunngåelig takskifte eneste løsning.`,
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unnatural_norwegian",
        "unsupported_roof_tile_load_claim",
        "roof_system_function_claim",
        "overstated_replacement_claim",
      ]),
    );
  });

  it("blocks missing Markdown headings and the language defects found in post 8", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content.replace(/^#{2,3}\s+/gm, "")}

Kort svar uten Markdown-overskrift. Avhengig av hva en befant viser, vurderes type begroing: Sterkt begrodd med mose, lav eller alger. Vurder takets faktiske tåleevne og boligens ytre vern mot nedbør.`,
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unnatural_norwegian",
        "missing_markdown_structure",
      ]),
    );
  });

  it("blocks the post 9 grammar and unsupported moss-treatment promises", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}

## Mose på taket

Mosen kan etne seg fast, og når det har slutten å regne blir sterk begrodd mose farlig. Tidlig behandling sikrer at taket holder seg trygt og funksjonelt i mange år fremover. Mose kan holde på fukt som gir frostskader og sprekker i taksteinen.`,
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unnatural_norwegian",
        "overstated_treatment_outcome",
        "unsupported_growth_damage_claim",
      ]),
    );
  });

  it("blocks the post 10 language defects and overconfident assessments", () => {
    const result = evaluateArticleQuality(
      validGeneratedArticle({
        content: `${validGeneratedArticle().content}

## Vurdering av taket

Slkumring ved knkt takstein kan bli myesande masse. TEK17 § 13-12 betyr at kravet til fuktsikring ikke lenger ivaretas. Takets alder i alle tilfeller avgjør om det må skiftes.`,
      }),
      validTopic,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unnatural_norwegian",
        "unsupported_tek17_conclusion",
        "age_as_decisive_roof_assessment",
      ]),
    );
  });
});
