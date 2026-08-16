import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MarkdownLite } from "@/components/content/markdown-lite";
import { ServiceLandingPage } from "@/components/seo/service-landing-page";
import { Link, routing } from "@/i18n/routing";
import { getSiteContent } from "@/lib/cms-content";
import {
  getSeoLandingPage,
  seoLandingPages,
} from "@/content/seo-landing-pages";
import {
  getPageBySlug,
  getPublishedPages,
  getRedirectDestination,
  getRedirectForPath,
  localizeContent,
} from "@/lib/cms-pages";
import { redirectPathCandidates } from "@/lib/content-paths";
import { siteConfig, type Locale } from "@/lib/site";

export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  try {
    const pages = await getPublishedPages();
    const cmsParams = pages.flatMap((page) =>
      routing.locales.map((locale) => ({ locale, slug: page.slug })),
    );
    const seoParams = seoLandingPages.flatMap((page) =>
      routing.locales.map((locale) => ({ locale, slug: page.slug })),
    );
    return [...seoParams, ...cmsParams];
  } catch (error) {
    console.error("CMS page static params could not be generated:", error);
    return seoLandingPages.flatMap((page) =>
      routing.locales.map((locale) => ({ locale, slug: page.slug })),
    );
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const seoPage = getSeoLandingPage(slug);
  if (seoPage) {
    const loc = locale as Locale;
    const pageUrl = `${siteConfig.url}/${locale}/${slug}`;
    return {
      title: seoPage.metaTitle[loc],
      description: seoPage.metaDescription[loc],
      alternates: {
        canonical: pageUrl,
        languages: {
          no: `${siteConfig.url}/no/${slug}`,
          en: `${siteConfig.url}/en/${slug}`,
          "x-default": `${siteConfig.url}/no/${slug}`,
        },
      },
      openGraph: {
        title: seoPage.metaTitle[loc],
        description: seoPage.metaDescription[loc],
        type: "website",
        url: pageUrl,
        images: [{ url: seoPage.image, alt: seoPage.imageAlt[loc] }],
      },
      robots: { index: true, follow: true },
    };
  }
  const page = await getPageBySlug(slug);
  if (!page) return {};

  const loc = locale as Locale;
  const localized = localizeContent(page, loc);
  const { isEnabled: isDraftMode } = await draftMode();
  const pageUrl = `${siteConfig.url}/${locale}/${slug}`;

  return {
    title: localized.seoTitle,
    description: localized.seoDescription,
    alternates: {
      canonical: pageUrl,
      languages: Object.fromEntries(
        routing.locales.map((language) => [
          language,
          `${siteConfig.url}/${language}/${slug}`,
        ]),
      ),
    },
    openGraph: {
      title: localized.seoTitle,
      description: localized.seoDescription,
      type: "website",
      url: pageUrl,
    },
    robots: isDraftMode
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    dateStyle: "long",
  }).format(new Date(value));
}

export default async function CmsPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;
  const currentPath = `/${locale}/${slug}`;
  const seoPage = getSeoLandingPage(slug);

  if (seoPage) {
    const content = await getSiteContent();
    const pageUrl = `${siteConfig.url}/${locale}/${slug}`;
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": seoPage.slug === "priser" ? "WebPage" : "Service",
          "@id": `${pageUrl}#service`,
          name: seoPage.title[loc],
          description: seoPage.metaDescription[loc],
          url: pageUrl,
          provider: {
            "@type": "LocalBusiness",
            name: content.settings.brandName,
            url: siteConfig.url,
            telephone: content.settings.phoneHref.replace("tel:", ""),
          },
          areaServed: content.settings.seo.areaServed[loc],
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: loc === "no" ? "Forside" : "Home",
              item: `${siteConfig.url}/${locale}`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: seoPage.eyebrow[loc],
              item: pageUrl,
            },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: seoPage.faq.map((item) => ({
            "@type": "Question",
            name: item.question[loc],
            acceptedAnswer: { "@type": "Answer", text: item.answer[loc] },
          })),
        },
      ],
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
        <ServiceLandingPage
          page={seoPage}
          locale={loc}
          settings={content.settings}
        />
      </>
    );
  }

  const redirectDocument = await getRedirectForPath(loc, currentPath);
  const destination = redirectDocument
    ? getRedirectDestination(redirectDocument)
    : null;
  const sourceAliases = redirectPathCandidates(loc, currentPath);

  if (destination && !sourceAliases.includes(destination)) {
    if (redirectDocument?.permanent !== false) permanentRedirect(destination);
    redirect(destination);
  }

  const page = await getPageBySlug(slug);
  if (!page) notFound();

  const localized = localizeContent(page, loc);

  return (
    <article className="section-pad">
      <div className="container-narrow max-w-3xl">
        <p className="eyebrow">
          <Link href="/" className="hover:text-accent-hover">
            {loc === "no" ? "Forside" : "Home"}
          </Link>
        </p>
        <h1 className="heading-display mt-3 text-balance">{localized.title}</h1>
        {page.publishedAt && (
          <time
            dateTime={page.publishedAt}
            className="text-muted-foreground mt-4 block text-sm"
          >
            {formatDate(page.publishedAt, loc)}
          </time>
        )}
        {localized.excerpt && (
          <p className="text-muted-foreground mt-6 text-lg leading-8">
            {localized.excerpt}
          </p>
        )}
        <div className="mt-10">
          <MarkdownLite content={localized.content} />
        </div>
      </div>
    </article>
  );
}
