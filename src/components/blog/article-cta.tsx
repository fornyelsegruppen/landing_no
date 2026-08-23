"use client";

import { ArrowRight } from "lucide-react";
import { trackArticleCtaClick } from "@/components/analytics/marketing-analytics";
import { Link } from "@/i18n/routing";
import { storeContentSource } from "@/lib/lead-attribution";

type Props = {
  locale: "no" | "en";
  slug: string;
  variant?: "assessment" | "wash" | "renewal" | "new_roof" | null;
};

export function ArticleCta({ locale, slug, variant = "assessment" }: Props) {
  const serviceSpecific = variant && variant !== "assessment";
  const title =
    locale === "no"
      ? serviceSpecific
        ? "Ønsker du et konkret tilbud?"
        : "Usikker på hva taket trenger?"
      : serviceSpecific
        ? "Would you like a concrete quote?"
        : "Unsure what your roof needs?";
  const body =
    locale === "no"
      ? "Send oss noen opplysninger om taket. Vi vurderer behovet og gir deg et tydelig neste steg uten forpliktelser."
      : "Send us a few details about the roof. We will assess the need and give you a clear next step without obligation.";
  const label =
    locale === "no" ? "Be om gratis vurdering" : "Request a free assessment";

  return (
    <aside className="mt-12 rounded-2xl border border-accent/30 bg-accent/10 p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{body}</p>
      <Link
        href="/#kontakt"
        onClick={() => {
          storeContentSource(
            window.sessionStorage,
            `/${locale}/blogg/${slug}`,
          );
          trackArticleCtaClick(slug);
        }}
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {label}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </aside>
  );
}
