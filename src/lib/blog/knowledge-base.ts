export const blogKnowledgeVersion = "takfornyelse-blog-2026-09-12-oslo-v7";
export const blogServiceAreas = ["Oslo", "Bærum", "Asker", "Lillestrøm", "Lørenskog", "Ski"];

// The base prices remain unchanged. The displayed consumer prices apply the
// ordinary 25% VAT rate; verify the applicable rate before changing these facts.
export const approvedPackagePrices = {
  Basic: {
    excludingVat: "99 kr/m² ekskl. mva",
    includingVat: "123,75 kr/m² inkl. mva",
  },
  Standard: {
    excludingVat: "138 kr/m² ekskl. mva",
    includingVat: "172,50 kr/m² inkl. mva",
  },
  Premium: {
    excludingVat: "337 kr/m² ekskl. mva",
    includingVat: "421,25 kr/m² inkl. mva",
  },
} as const;

export const approvedPackageConsumerPricePhrases = {
  Basic: `Basic takvask fra ${approvedPackagePrices.Basic.includingVat} (${approvedPackagePrices.Basic.excludingVat})`,
  Standard: `Standard fra ${approvedPackagePrices.Standard.includingVat} (${approvedPackagePrices.Standard.excludingVat})`,
  Premium: `Premium fra ${approvedPackagePrices.Premium.includingVat} (${approvedPackagePrices.Premium.excludingVat})`,
} as const;

export const approvedPackageDefinitions = {
  Basic:
    `${approvedPackageConsumerPricePhrases.Basic}: taksjekk, mosebehandling og skånsom takvask.`,
  Standard:
    `${approvedPackageConsumerPricePhrases.Standard}: alt i Basic, samt beskyttende impregnering som reduserer fuktopptak på egnet takstein.`,
  Premium:
    `${approvedPackageConsumerPricePhrases.Premium}: alt i Standard, samt profesjonell takmaling og valg av passende takfarge.`,
} as const;

export const approvedBlogKnowledge = {
  company: "Takfornyelse, en del av Fornyelse Gruppen AS",
  voice: ["rolig", "konkret", "ryddig", "hjelpsom", "faglig ydmyk"],
  services: ["takvask", "impregnering", "takmaling", "takfornying", "nytt tak"],
  packagePrices: Object.values(approvedPackageConsumerPricePhrases),
  packageDefinitions: Object.values(approvedPackageDefinitions),
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
    "Prisene er veiledende fra-priser inkludert mva. Endelig pris avhenger av takets størrelse, tilstand, hellingsgrad, adkomst, materialtype og geografisk beliggenhet. Kunden får et skriftlig tilbud før arbeidet starter.",
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
  servedAreas: blogServiceAreas,
  serviceAreaPolicy: "Kun Oslo og de navngitte nærområdene. Ikke lov landsdekkende tjeneste eller tilby arbeid i andre regioner.",
  safety:
    "Ikke oppfordre boligeiere til å gå opp på taket. Ved lekkasje, snølast, konstruksjonsrisiko eller usikkerhet skal fagperson vurdere saken.",
  cta: "Be om en gratis og uforpliktende vurdering.",
  leadInformation:
    "Oppgi gjerne postnummer og valgfri adresse, og send gjerne bilder av taket. Bildene hjelper oss å forberede vurderingen, men er ikke en teknisk konklusjon eller et bindende pristilbud.",
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
