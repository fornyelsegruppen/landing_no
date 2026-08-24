export const blogKnowledgeVersion = "takfornyelse-blog-2026-08-24-v2";

export const approvedBlogKnowledge = {
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
