import dynamic from "next/dynamic";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { HeroSection } from "@/components/sections/hero";
import { PackageOfferSection } from "@/components/sections/package-offer";
import { ServicesSection } from "@/components/sections/services";
import { NewRoofSection } from "@/components/sections/new-roof";
import { AboutSection } from "@/components/sections/about";
import { TestimonialsSection } from "@/components/sections/testimonials";
import { ProductsSection } from "@/components/sections/products";
import { FaqSection } from "@/components/sections/faq";
import { LatestGuidesSection } from "@/components/sections/latest-guides";
import { JsonLd } from "@/components/seo/json-ld";
import { routing } from "@/i18n/routing";
import { getSiteContent } from "@/lib/cms-content";
import { getLatestPublishedPosts } from "@/lib/cms-pages";
import { buildLatestGuideCards } from "@/lib/blog/latest-guides";
import { isSiteLocale } from "@/lib/site";

/** Defer heavier below-fold client JS so initial load ships less unused code. */
const CalculatorSection = dynamic(() =>
  import("@/components/sections/calculator").then((m) => ({
    default: m.CalculatorSection,
  })),
);
const ReferencesSection = dynamic(() =>
  import("@/components/sections/references").then((m) => ({
    default: m.ReferencesSection,
  })),
);
const ContactSection = dynamic(() =>
  import("@/components/sections/contact").then((m) => ({
    default: m.ContactSection,
  })),
);

export const revalidate = 30;

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isSiteLocale(locale)) notFound();
  setRequestLocale(locale);
  const loc = locale;
  const [content, latestPosts] = await Promise.all([
    getSiteContent(),
    getLatestPublishedPosts(loc, 3),
  ]);
  const latestGuides = buildLatestGuideCards(latestPosts, loc, 3);

  return (
    <>
      <JsonLd
        locale={loc}
        settings={content.settings}
        faq={content.faq}
        services={content.services}
        description={content.copy.meta.description[loc]}
      />
      <HeroSection />
      <PackageOfferSection locale={loc} />
      <ServicesSection items={content.services} />
      <CalculatorSection calculator={content.settings.calculator} />
      <NewRoofSection image={content.settings.images.newRoof} />
      <ReferencesSection projects={content.projects} />
      <AboutSection
        image={content.settings.images.about}
        settings={content.settings}
      />
      <TestimonialsSection />
      <ProductsSection products={content.products} />
      <FaqSection items={content.faq} />
      <LatestGuidesSection locale={loc} guides={latestGuides} />
      <ContactSection />
    </>
  );
}
