import Image from "next/image";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { LatestGuideCard } from "@/lib/blog/latest-guides";
import type { Locale } from "@/lib/site";

type Props = {
  locale: Locale;
  guides: LatestGuideCard[];
};

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function LatestGuidesSection({ locale, guides }: Props) {
  if (guides.length === 0) return null;

  return (
    <section
      className="section-pad bg-background-elevated border-y border-white/[0.06]"
      aria-labelledby="latest-guides-heading"
    >
      <div className="container-narrow">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">
              {locale === "no" ? "Råd og guider" : "Advice & guides"}
            </p>
            <h2 id="latest-guides-heading" className="heading-display mt-3">
              {locale === "no"
                ? "Nyttig kunnskap før du bestemmer deg"
                : "Useful knowledge before you decide"}
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              {locale === "no"
                ? "Les faglige råd om vedlikehold, behandling og valg for taket ditt."
                : "Read practical advice about roof maintenance, treatment and the choices available to you."}
            </p>
          </div>
          <Link
            href="/blogg"
            className="text-accent hover:text-accent-hover focus-visible:ring-accent inline-flex w-fit items-center gap-2 rounded-lg text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {locale === "no"
              ? "Se alle råd og guider"
              : "See all advice and guides"}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <article
              key={String(guide.id)}
              className="surface-card group flex min-w-0 flex-col overflow-hidden"
            >
              <Link
                href={`/blogg/${guide.slug}`}
                className="focus-visible:ring-accent relative block aspect-[16/10] overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(245,166,35,0.2),transparent_55%),linear-gradient(145deg,#171d27,#0d1118)] focus-visible:ring-2 focus-visible:outline-none"
                aria-label={guide.title}
              >
                {guide.image ? (
                  <Image
                    src={guide.image.url}
                    alt={guide.image.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-accent-soft text-accent flex size-16 items-center justify-center rounded-2xl">
                      <BookOpen className="size-8" aria-hidden />
                    </span>
                  </span>
                )}
              </Link>

              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-accent font-bold tracking-[0.12em] uppercase">
                    {guide.category}
                  </span>
                  <time dateTime={guide.publishedAt}>
                    {formatDate(guide.publishedAt, locale)}
                  </time>
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-balance">
                  <Link
                    href={`/blogg/${guide.slug}`}
                    className="hover:text-accent focus-visible:ring-accent rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {guide.title}
                  </Link>
                </h3>
                {guide.excerpt ? (
                  <p className="text-muted-foreground mt-3 line-clamp-3 text-sm leading-6">
                    {guide.excerpt}
                  </p>
                ) : null}
                <Link
                  href={`/blogg/${guide.slug}`}
                  className="text-accent hover:text-accent-hover focus-visible:ring-accent mt-auto inline-flex w-fit items-center gap-2 rounded-sm pt-5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {locale === "no" ? "Les mer" : "Read more"}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
