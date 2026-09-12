import type { GeneratedArticle } from "./article-schema";
import type { TopicCandidate } from "./topic-engine";

const paragraphs = [
  "En god vurdering starter med takets materiale, alder, overflate og hvor mye mose eller smuss som er synlig fra bakken. Boligeieren bør ikke gå opp på taket, fordi både underlaget og høyden kan gi risiko. En fagperson kan vurdere egnet metode, trygg adkomst og om vask er riktig tiltak. Vær, helning og behov for sikring påvirker også planleggingen. Kunden bør få et skriftlig og tydelig tilbud før arbeidet starter, slik at omfang og forutsetninger er forståelige.",
  "En befaring kan avklare hvilke deler av taket som bør undersøkes nærmere før det velges tiltak. Takstein, beslag, renner og adkomst vurderes i sammenheng, men en visuell gjennomgang er ikke det samme som en endelig teknisk konklusjon. Målet er å gi boligeieren et forståelig beslutningsgrunnlag. Når forholdene er dokumentert, kan arbeidet planlegges med riktige sikkerhetstiltak og et tilbud som beskriver oppgaven tydelig.",
  "Takets helling og plasseringen av huset påvirker hvordan arbeidet kan organiseres. Et lett tilgjengelig tak kan kreve en annen rigg enn et tak med vanskelig adkomst, trange passasjer eller mye høyde. Fagpersonen vurderer derfor både arbeidsmetode og sikring før oppstart. Dette er en viktig grunn til at en pris på takvask ikke kan fastsettes sikkert ut fra ett bilde eller bare antall kvadratmeter.",
  "Mose, lav, alger og annet smuss kan gjøre det vanskeligere å vurdere overflaten fra bakken. Før en eventuell behandling bør omfanget ses i lys av takets materiale og generelle tilstand. Det er ikke nødvendig at boligeieren selv prøver å fjerne begroing for å få en vurdering. Bilder fra bakken kan være nyttige som bakgrunn, mens fagpersonen tar stilling til hva som er en egnet og trygg videre prosess.",
  "Skånsom takvask handler om å velge en metode som passer det aktuelle taket og arbeidsforholdene. Planleggingen omfatter blant annet vannhåndtering, beskyttelse av nærliggende flater og sikker adkomst. Arbeidet bør ikke settes i gang før værforholdene er egnede og nødvendige tiltak er avklart. På den måten blir både kommunikasjonen og gjennomføringen mer ryddig for boligeieren og de som utfører oppdraget.",
  "På egnet takstein kan impregnering redusere fuktopptak, men om dette er riktig tiltak må vurderes konkret. En behandling erstatter ikke en faglig vurdering av takets samlede tilstand eller av andre forhold som krever oppfølging. Ved å skille mellom observasjoner og anbefalinger får boligeieren bedre grunnlag for å sammenligne alternativer. Det gjør også tilbudet enklere å forstå før noen avtale inngås.",
  "Takmaling kan være aktuelt når underlaget er teknisk egnet og ønsket om overflatefornyelse er avklart. Valg av farge, forarbeid og tilgjengelighet påvirker omfanget, og det bør fremgå tydelig hva som er inkludert. Maling skal ikke beskrives som en løsning som alene avgjør takets tette funksjon. En rolig gjennomgang av muligheter og begrensninger gir et mer realistisk utgangspunkt for videre beslutninger.",
  "Et skriftlig tilbud bør forklare hva som er observert, hvilken tjeneste som er foreslått og hvilke forutsetninger som ligger til grunn. Takets størrelse, tilstand, hellingsgrad, adkomst og materialtype kan påvirke sluttprisen. Veiledende fra-priser er derfor ikke en erstatning for vurderingen av den enkelte eiendommen. Når spørsmål blir avklart før arbeid starter, reduseres risikoen for at forventninger og faktisk omfang blir forskjellige.",
  "Vær og sesong kan påvirke når en faglig vurdering og et mulig tiltak kan gjennomføres. Tørt nok underlag, forsvarlig adkomst og hensyn til omgivelsene er deler av planleggingen. Det betyr ikke at samme løsning passer alle tak eller alle tidspunkt på året. En fagperson kan forklare hvilke praktiske forhold som er relevante for akkurat den aktuelle forespørselen før en bestemt dato kan vurderes.",
  "For å forberede en gratis og uforpliktende vurdering kan boligeieren oppgi postnummer og gjerne sende bilder av taket. Bildene hjelper med å forstå situasjonen, men er ikke et bindende pristilbud eller en teknisk konklusjon. Dersom det er behov for videre undersøkelser, beskrives neste steg før arbeid settes i gang. Slik får kunden en tydelig kontaktvei og et bedre grunnlag for å velge riktig tiltak.",
] as const;

const contentParagraphs = paragraphs.map(
  (paragraph) =>
    `${paragraph} Dette gir en saklig dialog om muligheter, kostnader og neste steg før kunden tar en beslutning.`,
);

export function validGeneratedArticle(
  overrides: Partial<GeneratedArticle> = {},
): GeneratedArticle {
  return {
    slug: "hva-pavirker-prisen-pa-takvask",
    title: "Hva påvirker prisen på profesjonell takvask?",
    excerpt:
      "Takets størrelse, tilstand, helning og adkomst påvirker både metode og pris når en fagperson vurderer takvask.",
    content: `## Kort svar\n\n${contentParagraphs[0]}\n\n${contentParagraphs[1]}\n\n## Tilstand og metode\n\n${contentParagraphs[2]}\n\n${contentParagraphs[3]}\n\n${contentParagraphs[4]}\n\n## Trygg planlegging\n\n${contentParagraphs[5]}\n\n${contentParagraphs[6]}\n\n${contentParagraphs[7]}\n\n## Pris og neste steg\n\n${contentParagraphs[8]}\n\n${contentParagraphs[9]}`,
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
