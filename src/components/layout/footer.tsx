"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  usePageCopy,
  useSiteSettings,
} from "@/components/site-settings-provider";
import { MarketingSettingsButton } from "@/components/analytics/marketing-analytics";
import { withGuideNavigation } from "@/lib/public-navigation";

const serviceLinks = [
  { href: "/takvask", no: "Takvask", en: "Roof cleaning" },
  {
    href: "/takvask-og-impregnering",
    no: "Vask og impregnering",
    en: "Cleaning and impregnation",
  },
  { href: "/takmaling", no: "Takmaling", en: "Roof coating" },
  { href: "/takfornying", no: "Takfornying", en: "Roof renewal" },
  { href: "/priser", no: "Priser", en: "Prices" },
] as const;

const areaLinks = [
  { href: "/takvask-oslo", no: "Takvask i Oslo", en: "Roof cleaning in Oslo" },
  {
    href: "/takfornying-baerum",
    no: "Takfornying i Bærum",
    en: "Roof renewal in Bærum",
  },
  {
    href: "/takmaling-drammen",
    no: "Takmaling i Drammen",
    en: "Roof coating in Drammen",
  },
  {
    href: "/takvask-og-impregnering-lillestrom",
    no: "Takvask i Lillestrøm",
    en: "Roof cleaning in Lillestrøm",
  },
  {
    href: "/takfornying-viken",
    no: "Takfornying i Viken",
    en: "Roof renewal in Viken",
  },
] as const;

export function Footer() {
  const copy = usePageCopy();
  const locale = useLocale() as "no" | "en";
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
  const resourceLinks = [
    {
      href: "/kundeomtaler",
      label: locale === "no" ? "Kundeomtaler" : "Customer reviews",
    },
  ];
  const quickWithResources = withGuideNavigation(
    [
      ...quick,
      ...resourceLinks.filter(
        (resource) => !quick.some((item) => item.href === resource.href),
      ),
    ],
    locale,
  );

  return (
    <footer className="border-t border-white/15 bg-[#0a0d12] pb-24 md:pb-0">
      <div className="container-narrow section-pad grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
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
            {quickWithResources.map((item, index) => (
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
            {locale === "no" ? "Tjenester" : "Services"}
          </p>
          <ul className="space-y-2">
            {serviceLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-accent text-sm transition-colors"
                >
                  {item[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold tracking-wider uppercase">
            {locale === "no" ? "Områder" : "Areas"}
          </p>
          <ul className="space-y-2">
            {areaLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-accent text-sm transition-colors"
                >
                  {item[locale]}
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
        <div className="container-narrow text-muted-foreground flex flex-col gap-2 px-4 py-6 text-[13px] leading-relaxed sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-sm lg:px-8">
          <p>
            © {year} {settings.brandName}. {copy.footer.rights}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/personvern" className="hover:text-accent">
              {settings.privacy.linkLabel[locale]}
            </Link>
            <Link href="/angreskjema" className="hover:text-accent">
              {locale === "no" ? "Angreskjema" : "Withdrawal form"}
            </Link>
            <MarketingSettingsButton />
          </div>
          <p>{copy.footer.warrantyNote}</p>
          <p className="tracking-wider uppercase">{locale}</p>
        </div>
      </div>
    </footer>
  );
}
