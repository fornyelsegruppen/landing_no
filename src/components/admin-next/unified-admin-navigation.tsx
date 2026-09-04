"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BriefcaseBusiness,
  FileStack,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  SearchCheck,
  Settings,
  Users,
} from "lucide-react";
import {
  adminNavigationHref,
  isAdminNavigationActive,
  unifiedAdminPrimaryNavigation,
  unifiedAdminUtilityNavigation,
  type AdminWorkspaceMode,
} from "@/lib/admin-next/navigation-contract";
import type { PanelLocale } from "@/lib/panel-i18n";

const icons = {
  archive: Archive,
  cases: FolderKanban,
  documents: FileStack,
  operations: Gauge,
  seo: SearchCheck,
  settings: Settings,
  team: Users,
  today: LayoutDashboard,
  work: BriefcaseBusiness,
} as const;

const labels = {
  nb: {
    primary: "Arbeidsområder",
    utility: "Administrasjon",
    today: "I dag",
    cases: "Saker",
    work: "Arbeid",
    documents: "Dokumenter",
    seo: "SEO-studio",
    operations: "Operasjoner",
    archive: "Arkiv",
    team: "Team og tilganger",
    settings: "Innstillinger",
  },
  lt: {
    primary: "Darbo sritys",
    utility: "Administravimas",
    today: "Šiandien",
    cases: "Bylos",
    work: "Darbai",
    documents: "Dokumentai",
    seo: "SEO studija",
    operations: "Operacijos",
    archive: "Archyvas",
    team: "Komanda ir teisės",
    settings: "Nustatymai",
  },
  en: {
    primary: "Workspaces",
    utility: "Administration",
    today: "Today",
    cases: "Cases",
    work: "Work",
    documents: "Documents",
    seo: "SEO studio",
    operations: "Operations",
    archive: "Archive",
    team: "Team and access",
    settings: "Settings",
  },
} as const;

function NavigationLink({
  href,
  icon: Icon,
  label,
  mobile = false,
}: {
  href: string;
  icon: (typeof icons)[keyof typeof icons];
  label: string;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const active = isAdminNavigationActive(pathname, href);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={mobile
        ? `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${active ? "bg-[var(--an-action-soft)] text-[var(--an-action)]" : "text-[var(--an-text-muted)]"}`
        : `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-[var(--an-action-soft)] text-[var(--an-action)]" : "text-[var(--an-text-muted)] hover:bg-[var(--an-surface-soft)] hover:text-[var(--an-text-primary)]"}`}
      href={href}
    >
      <Icon aria-hidden="true" className={mobile ? "size-5" : "size-[18px]"} />
      <span>{label}</span>
    </Link>
  );
}

export function UnifiedAdminNavigation({
  locale,
  mode,
  mobile = false,
}: {
  locale: PanelLocale;
  mode: AdminWorkspaceMode;
  mobile?: boolean;
}) {
  const copy = labels[locale];
  const primary = unifiedAdminPrimaryNavigation;

  if (mobile) {
    return (
      <nav aria-label={copy.primary} className="grid grid-cols-5 gap-1">
        {primary.map((item) => (
          <NavigationLink
            href={adminNavigationHref(item, mode)}
            icon={icons[item.key]}
            key={item.key}
            label={copy[item.key]}
            mobile
          />
        ))}
      </nav>
    );
  }

  return (
    <>
      <nav aria-label={copy.primary} className="grid gap-1">
        {primary.map((item) => (
          <NavigationLink
            href={adminNavigationHref(item, mode)}
            icon={icons[item.key]}
            key={item.key}
            label={copy[item.key]}
          />
        ))}
      </nav>
      <nav aria-label={copy.utility} className="mt-auto grid gap-1 border-t border-[var(--an-border)] pt-4">
        {unifiedAdminUtilityNavigation.map((item) => (
          <NavigationLink
            href={item.href}
            icon={icons[item.key]}
            key={item.key}
            label={copy[item.key]}
          />
        ))}
      </nav>
    </>
  );
}
