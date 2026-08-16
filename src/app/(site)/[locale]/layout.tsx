import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";
import { getSiteContent } from "@/lib/cms-content";
import { localizeCopy } from "@/lib/page-copy";
import { optimizeRemoteImageUrl } from "@/lib/images";
import { SiteSettingsProvider } from "@/components/site-settings-provider";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { StickyBottomCta } from "@/components/layout/sticky-cta";
import { LivePreviewRefresh } from "@/components/live-preview-refresh";
import { MarketingAttributionCapture } from "@/components/marketing-attribution";
import { GoogleAdsConsent } from "@/components/google-ads-consent";
import "../../globals.css";

export const revalidate = 30;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0d10",
};

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const content = await getSiteContent();
  const meta = localizeCopy(content.copy, locale as "no" | "en").meta;
  const ogImage = optimizeRemoteImageUrl(content.settings.images.hero.url, {
    width: 1200,
    quality: 70,
  });
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${siteConfig.url}/${l}`]),
  );

  return {
    metadataBase: new URL(siteConfig.url),
    title: meta.title,
    description: meta.description,
    applicationName: content.settings.brandName,
    icons: {
      icon: [{ url: "/icon.png", type: "image/png" }],
      apple: [{ url: "/apple-icon.png", type: "image/png" }],
    },
    alternates: {
      canonical: `${siteConfig.url}/${locale}`,
      languages: {
        ...languages,
        "x-default": `${siteConfig.url}/no`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${siteConfig.url}/${locale}`,
      siteName: content.settings.brandName,
      locale: locale === "no" ? "nb_NO" : "en_GB",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: content.settings.images.hero.alt || content.settings.brandName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "no" | "en")) {
    notFound();
  }

  setRequestLocale(locale);
  const { isEnabled: isDraftMode } = await draftMode();
  const [messages, content] = await Promise.all([
    getMessages(),
    getSiteContent(),
  ]);

  return (
    <html
      lang={locale === "no" ? "nb-NO" : "en"}
      className="dark"
      suppressHydrationWarning
    >
      <body className={`${manrope.variable} font-sans antialiased`}>
        {isDraftMode && <LivePreviewRefresh />}
        <NextIntlClientProvider messages={messages}>
          <SiteSettingsProvider settings={content.settings} copy={content.copy}>
            <MarketingAttributionCapture />
            <Navbar />
            <main>{children}</main>
            <Footer />
            <StickyBottomCta />
            <GoogleAdsConsent />
            <Toaster theme="dark" position="top-center" richColors />
          </SiteSettingsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
