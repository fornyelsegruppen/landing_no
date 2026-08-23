import type { GeneratedArticle } from "./article-schema";
import type { TopicCandidate } from "./topic-engine";

const paragraph =
  "En god vurdering starter med takets materiale, alder, overflate og hvor mye mose eller smuss som er synlig fra bakken. Boligeieren bør ikke gå opp på taket, fordi både underlaget og høyden kan gi risiko. En fagperson kan vurdere egnet metode, trygg adkomst og om vask er riktig tiltak. Vær, helning og behov for sikring påvirker også planleggingen. Kunden bør få et skriftlig og tydelig tilbud før arbeidet starter, slik at omfang og forutsetninger er forståelige.";

export function validGeneratedArticle(
  overrides: Partial<GeneratedArticle> = {},
): GeneratedArticle {
  return {
    slug: "hva-pavirker-prisen-pa-takvask",
    title: "Hva påvirker prisen på profesjonell takvask?",
    excerpt:
      "Takets størrelse, tilstand, helning og adkomst påvirker både metode og pris når en fagperson vurderer takvask.",
    content: `## Kort svar\n\n${paragraph}\n\n${paragraph}\n\n## Tilstand og metode\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}\n\n## Trygg planlegging\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}\n\n## Pris og neste steg\n\n${paragraph}\n\n${paragraph}\n\nBe om en gratis og uforpliktende vurdering når du ønsker et tydelig neste steg.`,
    seoTitle: "Takvask pris – dette påvirker tilbudet",
    seoDescription:
      "Se hva som påvirker pris og metode for takvask, og hvorfor takets tilstand, helning og adkomst må vurderes før tilbud.",
    primaryKeyword: "takvask pris",
    secondaryKeywords: ["pris på takvask", "vaske tak"],
    internalLinks: [
      {
        href: "/takvask",
        anchor: "les mer om takvask",
        reason: "Primær tjeneste",
      },
    ],
    faq: [
      {
        question: "Kan prisen bestemmes bare fra takarealet?",
        answer:
          "Nei. Tilstand, helning, materiale og adkomst må også vurderes før et tydelig tilbud kan gis.",
      },
      {
        question: "Må en fagperson se taket før arbeidet?",
        answer:
          "En faglig vurdering gir et tryggere grunnlag for metode, omfang og skriftlig tilbud før oppstart.",
      },
    ],
    sources: [
      {
        label: "Arbeid i høyden",
        url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
        publisher: "Arbeidstilsynet",
      },
    ],
    ctaVariant: "assessment",
    imageBrief:
      "Ekte norsk tak fotografert trygt fra bakken, med tydelig synlig begroing og ryddige omgivelser.",
    imageAlt: "Takstein med synlig mose før faglig vurdering av takvask",
    claimsForReview: ["Kontroller at den valgte kilden fortsatt er aktuell."],
    usefulnessReason:
      "Artikkelen forklarer prisdrivere og trygg prosess uten å love en bindende pris.",
    ...overrides,
  };
}

export const validTopic: TopicCandidate = {
  topic: "Hva koster takvask per m2?",
  primaryKeyword: "takvask pris",
  secondaryKeywords: ["pris på takvask"],
  searchIntent: "commercial",
  source: "manual",
  serviceKey: "takvask",
  factors: {
    serviceRelevance: 1,
    demand: 0.8,
    commercialValue: 0.9,
    contentGap: 0.8,
    seasonalRelevance: 0.5,
    originalEvidence: 0.5,
    localRelevance: 0,
  },
  reason: "Godkjent testtema",
};
