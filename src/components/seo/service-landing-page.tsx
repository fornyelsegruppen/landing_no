import Image from "next/image";
import { Check, Phone } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import type { SeoLandingPage } from "@/content/seo-landing-pages";
import type { CmsSettings } from "@/lib/cms-content";
import type { Locale } from "@/lib/site";

type Props = { page: SeoLandingPage; locale: Locale; settings: CmsSettings };

export function ServiceLandingPage({ page, locale, settings }: Props) {
  const relatedPages = [
    { slug: "takvask", no: "Takvask", en: "Roof cleaning" },
    { slug: "takmaling", no: "Takmaling", en: "Roof coating" },
    { slug: "takfornying", no: "Takfornying", en: "Roof renewal" },
    { slug: "takvask-oslo", no: "Takvask i Oslo", en: "Roof cleaning in Oslo" },
    {
      slug: "takfornying-viken",
      no: "Takfornying i Viken",
      en: "Roof renewal in Viken",
    },
    { slug: "priser", no: "Priser", en: "Prices" },
  ]
    .filter((item) => item.slug !== page.slug)
    .slice(0, 4);

  return (
    <article>
      <section className="section-pad relative overflow-hidden pt-28 sm:pt-32">
        <div
          className="absolute inset-0 bg-[var(--surface-glow)]"
          aria-hidden
        />
        <div className="container-narrow relative grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <nav
              className="text-muted-foreground text-sm"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-accent">
                {locale === "no" ? "Forside" : "Home"}
              </Link>
              <span aria-hidden className="px-2">
                /
              </span>
              <span>{page.eyebrow[locale]}</span>
            </nav>
            <p className="eyebrow mt-8">{page.eyebrow[locale]}</p>
            <h1 className="heading-display mt-3 text-balance">
              {page.title[locale]}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
              {page.intro[locale]}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/#kontakt">
                  {locale === "no"
                    ? "Få gratis befaring"
                    : "Book a free inspection"}
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <a href={settings.phoneHref}>
                  <Phone />
                  {settings.phone}
                </a>
              </Button>
            </div>
          </div>
          <div className="surface-card overflow-hidden">
            <Image
              src={page.image}
              alt={page.imageAlt[locale]}
              width={900}
              height={600}
              className="aspect-[3/2] w-full object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <section className="section-pad bg-background-elevated/40 border-y border-white/10">
        <div className="container-narrow grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div className="surface-card p-6 sm:p-8">
            <p className="eyebrow">{locale === "no" ? "Pris" : "Price"}</p>
            <h2 className="mt-3 text-2xl font-bold text-balance">
              {page.price[locale]}
            </h2>
            <p className="text-muted-foreground mt-4 leading-7">
              {page.priceNote[locale]}
            </p>
            {page.slug !== "priser" ? (
              <Link
                href="/priser"
                className="text-accent hover:text-accent-hover mt-6 inline-flex font-semibold"
              >
                {locale === "no"
                  ? "Se alle prisdrivere →"
                  : "See all price factors →"}
              </Link>
            ) : null}
          </div>
          <div>
            <p className="eyebrow">
              {locale === "no" ? "Dette får du" : "What you get"}
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {locale === "no"
                ? "En løsning tilpasset taket"
                : "A solution adapted to your roof"}
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {page.benefits.map((benefit) => (
                <div key={benefit.no} className="surface-card flex gap-3 p-4">
                  <Check className="text-accent mt-0.5 size-5 shrink-0" />
                  <span>{benefit[locale]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-narrow">
          <p className="eyebrow">
            {locale === "no" ? "Arbeidsprosess" : "Process"}
          </p>
          <h2 className="heading-display mt-3">
            {locale === "no"
              ? "Fra befaring til ferdig resultat"
              : "From inspection to finished result"}
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {page.process.map((step, index) => (
              <div key={step.title.no} className="surface-card p-6">
                <span className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-full text-sm font-bold">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">
                  {step.title[locale]}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {step.description[locale]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-background-elevated/40">
        <div className="container-narrow max-w-4xl">
          <p className="eyebrow">
            {locale === "no" ? "Spørsmål og svar" : "Questions and answers"}
          </p>
          <h2 className="heading-display mt-3">
            {locale === "no"
              ? `Vanlige spørsmål om ${page.eyebrow.no.toLowerCase()}`
              : `Common questions about ${page.eyebrow.en.toLowerCase()}`}
          </h2>
          <div className="mt-8 space-y-3">
            {page.faq.map((item) => (
              <details
                key={item.question.no}
                className="surface-card group open:border-accent/30 p-5"
              >
                <summary className="cursor-pointer list-none pr-8 font-semibold">
                  {item.question[locale]}
                </summary>
                <p className="text-muted-foreground mt-4 leading-7">
                  {item.answer[locale]}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad border-t border-white/10">
        <div className="container-narrow">
          <p className="eyebrow">
            {locale === "no" ? "Se også" : "Related pages"}
          </p>
          <h2 className="mt-3 text-3xl font-bold">
            {locale === "no" ? "Tjenester og områder" : "Services and areas"}
          </h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {relatedPages.map((item) => (
              <Link
                key={item.slug}
                href={`/${item.slug}`}
                className="surface-card hover:border-accent/40 hover:text-accent p-5 font-semibold transition"
              >
                {item[locale]} <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-narrow surface-card max-w-4xl p-8 text-center sm:p-12">
          <p className="eyebrow">
            {locale === "no" ? "Neste steg" : "Next step"}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-balance">
            {locale === "no"
              ? "Få taket vurdert før du bestemmer deg"
              : "Have the roof assessed before deciding"}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            {locale === "no"
              ? "Send adresse og gjerne bilder. Vi avklarer behovet og avtaler gratis, uforpliktende befaring."
              : "Send the address and preferably photos. We clarify the need and arrange a free, no-obligation inspection."}
          </p>
          <Button asChild size="xl" className="mt-8">
            <Link href="/#kontakt">
              {locale === "no"
                ? "Be om gratis befaring"
                : "Request a free inspection"}
            </Link>
          </Button>
        </div>
      </section>
    </article>
  );
}
