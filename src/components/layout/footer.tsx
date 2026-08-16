"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  usePageCopy,
  useSiteSettings,
} from "@/components/site-settings-provider";
import {
  googleAdsMeasurementConfigured,
  openGoogleAdsPrivacyChoices,
} from "@/components/google-ads-consent";

export function Footer() {
  const copy = usePageCopy();
  const locale = useLocale();
  const settings = useSiteSettings();
  const year = new Date().getFullYear();

  const quick =
    settings.navItems.length > 0
      ? settings.navItems
          .filter((item) => item.visible)
          .map((item) => ({
            href: item.href,
            label: item.label[locale as "no" | "en"],
          }))
      : [
          { href: "/", label: copy.nav.home },
          { href: "/#tjenester", label: copy.nav.services },
          { href: "/#referanser", label: copy.nav.references },
          { href: "/#om-oss", label: copy.nav.about },
          { href: "/#kontakt", label: copy.nav.contact },
        ];

  return (
    <footer className="border-t border-white/10 bg-[#080a0e] pb-24 md:pb-0">
      <div className="container-narrow section-pad grid gap-10 md:grid-cols-3">
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-block"
            aria-label={settings.brandName}
          >
            <Image
              src={settings.images.logo.url}
              alt={settings.images.logo.alt || settings.brandName}
              width={900}
              height={376}
              sizes="320px"
              className="h-14 w-auto max-w-[280px] object-contain object-left sm:h-16 sm:max-w-[320px]"
              loading="lazy"
              quality={75}
            />
          </Link>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            {copy.footer.tagline}
          </p>
          {settings.parentOrg ? (
            <p className="text-muted-foreground text-sm">
              {copy.footer.partOf}{" "}
              <span className="text-foreground">{settings.parentOrg}</span>
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold tracking-wider uppercase">
            {copy.footer.quickLinks}
          </p>
          <ul className="space-y-2">
            {quick.map((item, index) => (
              <li key={`${item.href}-${index}`}>
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-accent text-sm transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold tracking-wider uppercase">
            {copy.footer.contact}
          </p>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <a
                href={`mailto:${settings.email}`}
                className="hover:text-accent"
              >
                {settings.email}
              </a>
            </li>
            <li>
              <a href={settings.phoneHref} className="hover:text-accent">
                {settings.phone}
              </a>
            </li>
            <li>
              {settings.address.street}, {settings.address.postal}{" "}
              {settings.address.city}
            </li>
            <li>
              {copy.footer.orgLabel} {settings.orgNr}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="container-narrow text-muted-foreground flex flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {year} {settings.brandName}. {copy.footer.rights}
          </p>
          <p>
            <Link href="/personvern" className="hover:text-accent">
              {settings.privacy.linkLabel[locale as "no" | "en"]}
            </Link>
            {googleAdsMeasurementConfigured() ? (
              <button
                type="button"
                className="hover:text-accent ml-3"
                onClick={openGoogleAdsPrivacyChoices}
              >
                {locale === "no" ? "Personvernvalg" : "Privacy choices"}
              </button>
            ) : null}
          </p>
          <p>{copy.footer.warrantyNote}</p>
          <p className="tracking-wider uppercase">{locale}</p>
        </div>
      </div>
    </footer>
  );
}
