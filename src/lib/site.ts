export const siteConfig = {
  name: "Takfornyelse",
  domain: "takfornyelse.as",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://www.takfornyelse.as"),
  phone: "+47 47 73 58 88",
  phoneHref: "tel:+4747735888",
  email: "post@takfornyelse.as",
  address: {
    street: "Lyngveien 28",
    postal: "1182",
    city: "Oslo",
    country: "NO",
  },
  orgNr: "916 693 168",
  parentOrg: "Fornyelse Gruppen AS",
  locales: ["no", "en"] as const,
  defaultLocale: "no" as const,
  calculator: {
    minSqm: 50,
    maxSqm: 500,
    defaultSqm: 150,
    newRoofPerSqm: 2500,
    renewalPerSqm: 750,
  },
  trust: {
    sqmRenewed: "2.000.000+",
    warrantyYears: 10,
    happyCustomers: "100+",
    rating: "4.9/5",
  },
};

export type Locale = (typeof siteConfig.locales)[number];
