export const blogKnowledgeVersion = "takfornyelse-blog-2026-09-03-v3";

export const approvedBlogKnowledge = {
  company: "Takfornyelse, en del av Fornyelse Gruppen AS",
  voice: ["rolig", "konkret", "ryddig", "hjelpsom", "faglig ydmyk"],
  services: ["takvask", "impregnering", "takmaling", "takfornying", "nytt tak"],
  packagePrices: [
    "Basic fra 99 kr/m² + mva",
    "Standard fra 138 kr/m² + mva",
    "Premium fra 337 kr/m² + mva",
  ],
  packageDefinitions: [
    "Basic: taksjekk, mosebehandling og skånsom takvask.",
    "Standard: alt i Basic, samt beskyttende impregnering som reduserer fuktopptak på egnet takstein.",
    "Premium: alt i Standard, samt profesjonell takmaling og valg av passende takfarge.",
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
    "Prisene er veiledende fra-priser. Endelig pris avhenger av takets størrelse, tilstand, hellingsgrad, adkomst, materialtype og geografisk beliggenhet. Kunden får et skriftlig tilbud før arbeidet starter.",
  treatmentClaims: [
    "På egnet takstein kan impregnering redusere fuktopptak.",
    "Når taket er teknisk egnet, kan riktig behandling bidra til å forlenge takets levetid.",
  ],
  authoritativeSources: [
    {
      claim: "Sikkerhet ved arbeid på tak og behov for sikringstiltak",
      label: "Unngå fall ved arbeid på tak",
      publisher: "Arbeidstilsynet",
      url: "https://www.arbeidstilsynet.no/risikofylt-arbeid/arbeid-i-hoyden/unnga-fall-ved-arbeid-pa-tak/",
    },
    {
      claim: "Beskyttelse av takkonstruksjonen mot nedbør og fuktskader",
      label: "TEK17 § 13-12. Nedbør",
      publisher: "Direktoratet for byggkvalitet",
      url: "https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/13/vi/13-12",
    },
  ],
  rejectedGenericSources: [
    "https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17",
  ],
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
  cta: "Be om en gratis og uforpliktende vurdering. Be om postnummer, valgfri adresse og gjerne bilder, uten å love endelig teknisk konklusjon eller pris.",
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
