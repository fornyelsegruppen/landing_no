"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu, Phone, X } from "lucide-react";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withGuideNavigation } from "@/lib/public-navigation";
import {
  usePageCopy,
  useSiteSettings,
} from "@/components/site-settings-provider";

const fallbackLinks = [
  { href: "/#tjenester", key: "services" as const },
  { href: "/#referanser", key: "references" as const },
  { href: "/#om-oss", key: "about" as const },
  { href: "/#produkter", key: "products" as const },
  { href: "/#kontakt", key: "contact" as const },
];

export function Navbar() {
  const copy = usePageCopy();
  const locale = useLocale();
  const pathname = usePathname();
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);
  const otherLocale = locale === "no" ? "en" : "no";
  const otherLocaleLabel =
    otherLocale === "no" ? copy.nav.localeNo : copy.nav.localeEn;
  const baseLinks =
    settings.navItems.length > 0
      ? settings.navItems
          .filter((item) => item.visible)
          .map((item) => ({
            href: item.href,
            label: item.label[locale as "no" | "en"],
          }))
      : fallbackLinks.map((item) => ({
          href: item.href,
          label: copy.nav[item.key],
        }));
  const links = withGuideNavigation(baseLinks, locale as "no" | "en");

  const parentLine = settings.parentOrg
    ? locale === "no"
      ? `${settings.brandName} – en del av ${settings.parentOrg}`
      : `${settings.brandName} – part of ${settings.parentOrg}`
    : null;

  return (
    <header className="bg-background/80 fixed inset-x-0 top-0 z-50 border-b border-white/5 backdrop-blur-xl">
      <div className="container-narrow flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group relative flex shrink-0 items-center"
          onClick={() => setOpen(false)}
          aria-label={settings.brandName}
        >
          <span className="flex flex-col justify-center">
            <span className="block">
              <Image
                src={settings.images.logo.url}
                alt={settings.images.logo.alt || settings.brandName}
                width={900}
                height={376}
                sizes="(max-width: 640px) 168px, (max-width: 1024px) 220px, 240px"
                className="h-10 w-auto max-w-[168px] object-contain object-left sm:h-12 sm:max-w-[220px] lg:max-w-[240px]"
                priority
                quality={75}
              />
            </span>
            {parentLine ? (
              <span className="text-muted-foreground mt-1 hidden max-w-[240px] text-[10px] leading-snug lg:block">
                {parentLine}
              </span>
            ) : null}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link, index) => (
            <Link
              key={`${link.href}-${index}`}
              href={link.href}
              className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={pathname}
            locale={otherLocale}
            className="text-muted-foreground hover:text-foreground hidden rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors hover:bg-white/5 sm:inline-flex"
            aria-label={otherLocaleLabel}
          >
            {otherLocaleLabel}
          </Link>

          <Button
            asChild
            size="sm"
            variant="secondary"
            className="hidden sm:inline-flex"
          >
            <a href={settings.phoneHref}>
              <Phone className="size-3.5" />
              {copy.nav.call}
            </a>
          </Button>

          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/#kontakt">{copy.nav.contactUs}</Link>
          </Button>

          <button
            type="button"
            className="text-foreground inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"
            aria-label={open ? copy.nav.close : copy.nav.menu}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "bg-background/95 border-t border-white/5 backdrop-blur-xl lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="container-narrow flex flex-col gap-1 px-4 py-4">
          {parentLine ? (
            <p className="text-muted-foreground mb-2 px-4 text-xs leading-relaxed">
              {parentLine}
            </p>
          ) : null}
          {links.map((link, index) => (
            <Link
              key={`${link.href}-${index}`}
              href={link.href}
              className="rounded-xl px-4 py-3 text-base font-medium hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 border-t border-white/10 pt-4">
            <Button asChild className="flex-1" variant="secondary">
              <a href={settings.phoneHref}>
                <Phone className="size-4" />
                {copy.nav.call}
              </a>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/#kontakt" onClick={() => setOpen(false)}>
                {copy.nav.contactUs}
              </Link>
            </Button>
          </div>
          <Link
            href={pathname}
            locale={otherLocale}
            className="text-muted-foreground mt-2 rounded-xl px-4 py-3 text-center text-sm font-semibold tracking-wider uppercase hover:bg-white/5"
            onClick={() => setOpen(false)}
          >
            {otherLocaleLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
