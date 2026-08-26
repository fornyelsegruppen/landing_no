import type { Metadata } from "next";
import { ArrowRight, BookOpen } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link, routing } from "@/i18n/routing";
import { getPosts, localizeContent, postHasLocale } from "@/lib/cms-pages";
import { siteConfig, type Locale } from "@/lib/site";
import { guideLabels } from "@/lib/public-navigation";

export const revalidate = 60;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

const guideLinks = [
  {
    href: "/takvask",
    title: {
      no: "Når er takvask riktig?",
      en: "When is roof cleaning suitable?",
    },
    description: {
      no: "Se hva som påvirker metode, sikkerhet og pris når mose, alger og smuss skal fjernes.",
      en: "See what affects method, safety and price when moss, algae and dirt are removed.",
    },
  },
  {
    href: "/takvask-og-impregnering",
    title: {
      no: "Vask og impregnering",
      en: "Cleaning and impregnation",
    },
    description: {
      no: "Les hvorfor taket må være rent, tørt og egnet før en beskyttende behandling påføres.",
      en: "Learn why the roof must be clean, dry and suitable before protective treatment is applied.",
    },
  },
  {
    href: "/takmaling",
    title: {
      no: "Kan taksteinen males?",
      en: "Can roof tiles be coated?",
    },
    description: {
      no: "Få oversikt over tilstand, forarbeid, heft og værforhold som avgjør om takmaling er riktig.",
      en: "Understand the condition, preparation, adhesion and weather requirements for roof coating.",
    },
  },
  {
    href: "/takfornying",
    title: {
      no: "Hva innebærer takfornying?",
      en: "What does roof renewal involve?",
    },
    description: {
      no: "Sammenlign vask, impregnering og maling, og se hvordan riktig tiltak velges etter befaring.",
      en: "Compare cleaning, impregnation and coating and see how the right treatment is chosen after inspection.",
    },
  },
  {
    href: "/nytt-tak",
    title: {
      no: "Når bør taket skiftes?",
      en: "When should a roof be replaced?",
    },
    description: {
      no: "Les hvilke tegn som kan bety at reparasjon eller full utskifting bør vurderes fremfor overflatebehandling.",
      en: "Learn which signs may call for repair or replacement rather than surface treatment.",
    },
  },
  {
    href: "/priser",
    title: {
      no: "Hva påvirker prisen?",
      en: "What affects the price?",
    },
    description: {
      no: "Se de viktigste prisdriverne og hvorfor et skriftlig tilbud etter befaring gir et tryggere grunnlag.",
      en: "See the main price factors and why a written quotation after inspection is a safer basis.",
    },
  },
] as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const loc = locale as Locale;
  const title =
    loc === "no"
      ? "Takguide – råd om takvask og takfornying"
      : "Roof guide – cleaning, coating and renewal advice";
  const description =
    loc === "no"
      ? "Praktiske råd om takvask, impregnering, takmaling, takfornying og nytt tak. Se hva som påvirker valg, prosess og pris."
      : "Practical advice about roof cleaning, impregnation, coating, renewal and replacement. Understand choices, process and price factors.";

  return {
    title,
    description,
    alternates: {
      canonical: `${siteConfig.url}/${locale}/blogg`,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((language) => [
            language,
            `${siteConfig.url}/${language}/blogg`,
          ]),
        ),
        "x-default": `${siteConfig.url}/no/blogg`,
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteConfig.url}/${locale}/blogg`,
    },
  };
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    dateStyle: "long",
  }).format(new Date(value));
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;
  const posts = (await getPosts()).filter((post) => postHasLocale(post, loc));
  const pageUrl = `${siteConfig.url}/${locale}/blogg`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#collection`,
        url: pageUrl,
        name:
          loc === "no"
            ? "Takguide for boligeiere"
            : "Roof guide for homeowners",
        inLanguage: loc === "no" ? "nb-NO" : "en",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: posts.map((post, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: localizeContent(post, loc).title,
            url: `${pageUrl}/${post.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
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
            name: guideLabels[loc],
            item: pageUrl,
          },
        ],
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
      <section className="section-pad">
        <div className="container-narrow">
          <p className="eyebrow">
            <Link href="/" className="hover:text-accent-hover">
              {loc === "no" ? "Forside" : "Home"}
            </Link>
          </p>
          <h1 className="heading-display mt-3">
            {loc === "no"
              ? "Takguide for boligeiere"
              : "Roof guide for homeowners"}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            {loc === "no"
              ? "Finn riktig startpunkt før du bestiller arbeid. Guidene forklarer hva som kan vedlikeholdes, hva som bør undersøkes nærmere og når større tiltak kan være nødvendig."
              : "Find the right starting point before booking work. These guides explain what can be maintained, what needs closer inspection and when larger measures may be necessary."}
          </p>

          <section className="mt-12" aria-labelledby="guide-topics">
            <div className="flex items-center gap-3">
              <BookOpen className="text-accent size-6" aria-hidden />
              <h2 id="guide-topics" className="text-2xl font-semibold">
                {loc === "no" ? "Velg tema" : "Choose a topic"}
              </h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {guideLinks.map((guide) => (
                <article
                  key={guide.href}
                  className="surface-card flex flex-col p-6"
                >
                  <h3 className="text-xl font-semibold tracking-tight">
                    {guide.title[loc]}
                  </h3>
                  <p className="text-muted-foreground mt-3 text-sm leading-6">
                    {guide.description[loc]}
                  </p>
                  <Link
                    href={guide.href}
                    className="text-accent hover:text-accent-hover mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold"
                  >
                    {loc === "no" ? "Les guiden" : "Read the guide"}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {posts.length > 0 ? (
            <section className="mt-16" aria-labelledby="latest-articles">
              <h2 id="latest-articles" className="text-2xl font-semibold">
                {loc === "no" ? "Nye artikler" : "Latest articles"}
              </h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {posts.map((post) => {
                  const localized = localizeContent(post, loc);
                  const date = post.publishedAt || post.createdAt;

                  return (
                    <article
                      key={String(post.id)}
                      className="surface-card p-6 sm:p-8"
                    >
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                        <time dateTime={date}>{formatDate(date, loc)}</time>
                        {post._status === "draft" && (
                          <span className="border-accent/40 text-accent rounded-full border px-2 py-0.5 text-xs font-semibold">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                        <Link
                          href={`/blogg/${post.slug}`}
                          className="hover:text-accent transition-colors"
                        >
                          {localized.title}
                        </Link>
                      </h3>
                      {localized.excerpt && (
                        <p className="text-muted-foreground mt-3 leading-7">
                          {localized.excerpt}
                        </p>
                      )}
                      <Link
                        href={`/blogg/${post.slug}`}
                        className="text-accent hover:text-accent-hover mt-6 inline-flex text-sm font-semibold"
                      >
                        {loc === "no" ? "Les mer" : "Read more"}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="text-muted-foreground mt-10 max-w-2xl text-sm leading-6">
              {loc === "no"
                ? "Vi utvider takguiden med dokumenterte prosjekter og svar på spørsmål vi møter under befaringer."
                : "We are expanding the roof guide with documented projects and answers to questions we receive during inspections."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
