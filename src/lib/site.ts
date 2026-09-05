export function resolveSiteUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const exactPreviewHost = environment.VERCEL_URL?.trim();
  if (environment.VERCEL_ENV === "preview" && exactPreviewHost) {
    return `https://${exactPreviewHost.replace(/^https?:\/\//u, "").replace(/\/$/u, "")}`;
  }
  return (
    environment.NEXT_PUBLIC_SITE_URL ||
    (environment.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${environment.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://www.takfornyelse.as")
  );
}

export const siteConfig = {
  name: "Takfornyelse",
  domain: "takfornyelse.as",
  url: resolveSiteUrl(),
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
    renewalPerSqm: 421.25,
  },
  trust: {
    sqmRenewed: "2.000.000+",
    warrantyYears: 10,
    happyCustomers: "100+",
    rating: "Google",
  },
};

export type Locale = (typeof siteConfig.locales)[number];

export function isSiteLocale(value: string): value is Locale {
  return siteConfig.locales.includes(value as Locale);
}
