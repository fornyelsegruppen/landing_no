export const blogKnowledgeVersion = "takfornyelse-blog-2026-09-03-v1";

/**
 * A small, deterministic set of public deep links that the draft model may
 * cite. Keep the URLs verbatim: they are also used as prompt input and must
 * not be reconstructed from a publisher homepage or URL pattern.
 */
export const officialDeepSourceCatalogue = [
  {
    label: "Råd om tak",
    url: "https://www.dibk.no/smartere-oppussing/raad/tak",
    publisher: "Direktoratet for byggkvalitet (DiBK)",
    relevance: "tak, vedlikehold og oppussing",
  },
  {
    label: "TEK17 § 13-17 – Nedbør",
    url: "https://www.dibk.no/regelverk/tek/3/13/vi/13-17",
    publisher: "Direktoratet for byggkvalitet (DiBK)",
    relevance: "krav til beskyttelse mot nedbør",
  },
  {
    label: "Unngå fall ved arbeid på tak",
    url: "https://www.arbeidstilsynet.no/risikofylt-arbeid/arbeid-i-hoyden/unnga-fall-ved-arbeid-pa-tak/",
    publisher: "Arbeidstilsynet",
    relevance: "sikkerhet og arbeid i høyden",
  },
  {
    label: "Unngå skader på boligtak – tekk om i tide og velg riktig",
    url: "https://www.sintef.no/sintef-community/fagblogg/poster/unnga-skader-pa-boligtak-tekk-om-i-tide-og-velg-ri/",
    publisher: "SINTEF",
    relevance: "tilstand, tekking og rehabilitering av boligtak",
  },
  {
    label: "Unngå byggskader ved prosjektering av tak",
    url: "https://www.sintef.no/sintef-community/fagblogg/poster/unnga-byggskader-ved-prosjektering-av-tak/",
    publisher: "SINTEF",
    relevance: "prosjektering og forebygging av byggskader",
  },
  {
    label: "Fukt og mugg på plater ved rehabilitering av kalde loft",
    url: "https://www.sintef.no/siste-nytt/2024/fukt-og-mugg-pa-plater-ved-rehabilitering-av-kalde-loft/",
    publisher: "SINTEF",
    relevance: "fukt, mugg og rehabilitering av kalde loft",
  },
] as const;

export const approvedBlogKnowledge = {
  officialDeepSourceCatalogue,
  company: "Takfornyelse, en del av Fornyelse Gruppen AS",
  voice: [
    "rolig",
    "konkret",
    "ryddig",
    "hjelpsom",
    "faglig ydmyk",
  ],
  services: [
    "takvask",
    "impregnering",
    "takmaling",
    "takfornying",
    "nytt tak",
  ],
  packagePrices: [
    "Basic fra 99 kr/m² + mva",
    "Standard fra 138 kr/m² + mva",
    "Premium fra 337 kr/m² + mva",
  ],
  internalPaths: [
    "/takvask",
    "/takvask-og-impregnering",
    "/takmaling",
    "/takfornying",
    "/nytt-tak",
    "/priser",
    "/blogg",
  ],
  priceDisclaimer:
    "Endelig pris avhenger av takets størrelse, tilstand, hellingsgrad, adkomst, materialtype og geografiske beliggenhet. Kunden får et skriftlig tilbud før arbeidet starter.",
  servedAreas: [
    "Agder",
    "Innlandet",
    "Møre og Romsdal",
    "Nordland",
    "Oslo",
    "Rogaland",
    "Trøndelag",
    "Vestfold og Telemark",
    "Vestland",
    "Viken",
    "Ålesund",
  ],
  safety:
    "Ikke oppfordre boligeiere til å gå opp på taket. Ved lekkasje, snølast, konstruksjonsrisiko eller usikkerhet skal fagperson vurdere saken.",
  cta:
    "Be om en gratis og uforpliktende vurdering. Be om postnummer, valgfri adresse og gjerne bilder, uten å love endelig teknisk konklusjon eller pris.",
  forbiddenClaims: [
    "Norges beste",
    "billigst i markedet",
    "garantert lavest pris",
    "helt risikofritt",
    "perfekt resultat",
    "ledig team i morgen",
  ],
} as const;

export function approvedKnowledgePrompt() {
  return JSON.stringify(
    {
      version: blogKnowledgeVersion,
      ...approvedBlogKnowledge,
    },
    null,
    2,
  );
}
