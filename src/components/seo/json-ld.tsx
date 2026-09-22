import type { CmsFaq, CmsService, CmsSettings } from "@/lib/cms-content";
import { siteConfig } from "@/lib/site";

type Props = {
  locale: "no" | "en";
  settings: CmsSettings;
  faq: CmsFaq[];
  services: CmsService[];
  description: string;
};

function absoluteUrl(path: string) {
  return new URL(path, `${siteConfig.url}/`).toString();
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function JsonLd({
  locale,
  settings,
  faq,
  services,
  description,
}: Props) {
  const pageUrl = `${siteConfig.url}/${locale}`;
  const organizationId = `${siteConfig.url}/#organization`;
  const businessId = `${siteConfig.url}/#local-business`;
  const websiteId = `${siteConfig.url}/#website`;

  const business = {
    "@type": "LocalBusiness",
    "@id": businessId,
    name: settings.brandName,
    alternateName: "Takfornyelsenorge.no",
    description,
    url: pageUrl,
    telephone: settings.phoneHref.replace("tel:", ""),
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address.street,
      addressLocality: settings.address.city,
      postalCode: settings.address.postal,
      addressCountry: siteConfig.address.country,
    },
    areaServed: settings.seo.areaServed[locale],
    priceRange: "$$",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: settings.seo.openingHours.days,
      opens: settings.seo.openingHours.opens,
      closes: settings.seo.openingHours.closes,
    },
    ...(settings.parentOrg
      ? {
          parentOrganization: {
            "@type": "Organization",
            name: settings.parentOrg,
          },
        }
      : {}),
  };

  const organization = {
    "@type": "Organization",
    "@id": organizationId,
    name: settings.brandName,
    alternateName: "Takfornyelsenorge.no",
    url: siteConfig.url,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(settings.images.logo.url),
    },
    telephone: settings.phoneHref.replace("tel:", ""),
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address.street,
      addressLocality: settings.address.city,
      postalCode: settings.address.postal,
      addressCountry: siteConfig.address.country,
    },
  };

  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    url: siteConfig.url,
    name: settings.brandName,
    description,
    inLanguage: locale === "no" ? "nb-NO" : "en",
    publisher: {
      "@id": organizationId,
    },
  };

  const serviceSchemas = services
    .map((service) => ({
      service,
      name: service.title[locale]?.trim(),
      serviceDescription: service.description[locale]?.trim(),
    }))
    .filter((item) => Boolean(item.name))
    .map(({ service, name, serviceDescription }) => ({
      "@type": "Service",
      "@id": `${pageUrl}#service-${encodeURIComponent(service.id || service.key)}`,
      name,
      ...(serviceDescription ? { description: serviceDescription } : {}),
      url: `${pageUrl}#tjenester`,
      provider: {
        "@id": businessId,
      },
      areaServed: settings.seo.areaServed[locale],
    }));

  const faqSchema = {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question[locale],
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer[locale],
      },
    })),
  };

  const schema = {
    "@context": "https://schema.org",
    "@graph": [organization, website, business, ...serviceSchemas, faqSchema],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
    />
  );
}
