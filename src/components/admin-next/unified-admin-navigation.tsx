"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  BriefcaseBusiness,
  FileStack,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Menu,
  SearchCheck,
  Settings,
  Users,
  X,
} from "lucide-react";
import {
  adminNavigationHref,
  isAdminNavigationActive,
  isAdminUtilityNavigationActive,
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
    more: "Mer",
    moreTitle: "Flere arbeidsområder",
    moreDescription: "Naviger til flere arbeidsområder og administrasjon.",
    closeMore: "Lukk flere arbeidsområder",
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
    more: "Daugiau",
    moreTitle: "Daugiau darbo sričių",
    moreDescription: "Pereikite į kitas darbo ir administravimo sritis.",
    closeMore: "Uždaryti daugiau darbo sričių",
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
    more: "More",
    moreTitle: "More workspaces",
    moreDescription: "Navigate to more workspaces and administration areas.",
    closeMore: "Close more workspaces",
  },
} as const;

function NavigationLink({
  active,
  href,
  icon: Icon,
  label,
  mobile = false,
  onNavigate,
}: {
  href: string;
  icon: (typeof icons)[keyof typeof icons];
  label: string;
  mobile?: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={
        mobile
          ? `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${active ? "bg-[var(--an-action-soft)] text-[var(--an-action)]" : "text-[var(--an-text-muted)]"}`
          : `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-[var(--an-action-soft)] text-[var(--an-action)]" : "text-[var(--an-text-muted)] hover:bg-[var(--an-surface-soft)] hover:text-[var(--an-text-primary)]"}`
      }
      href={href}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" className={mobile ? "size-5" : "size-[18px]"} />
      <span>{label}</span>
    </Link>
  );
}

export function UnifiedAdminNavigation({
  customerContentNotice,
  locale,
  mode,
  mobile = false,
}: {
  customerContentNotice?: string;
  locale: PanelLocale;
  mode: AdminWorkspaceMode;
  mobile?: boolean;
}) {
  const copy = labels[locale];
  const primary = unifiedAdminPrimaryNavigation;
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (mobile) {
    const directDestinations = primary.slice(0, 4);
    const moreDestinations = primary.slice(4);
    const moreIsActive = [
      ...moreDestinations.map((item) =>
        isAdminNavigationActive(pathname, item, mode),
      ),
      ...unifiedAdminUtilityNavigation.map((item) =>
        isAdminUtilityNavigationActive(pathname, item.href),
      ),
    ].some(Boolean);

    return (
      <nav aria-label={copy.primary} className="grid grid-cols-5 gap-1">
        {directDestinations.map((item) => (
          <NavigationLink
            active={isAdminNavigationActive(pathname, item, mode)}
            href={adminNavigationHref(item, mode)}
            icon={icons[item.key]}
            key={item.key}
            label={copy[item.key]}
            mobile
          />
        ))}
        <Dialog.Root onOpenChange={setMoreOpen} open={moreOpen}>
          <Dialog.Trigger asChild>
            <button
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${moreIsActive ? "bg-[var(--an-action-soft)] text-[var(--an-action)]" : "text-[var(--an-text-muted)]"}`}
              type="button"
            >
              <Menu aria-hidden="true" className="size-5" />
              <span>{copy.more}</span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[51] bg-black/70 backdrop-blur-sm lg:hidden" />
            <Dialog.Content
              className="admin-next-theme fixed inset-x-3 bottom-[calc(var(--an-mobile-nav-offset)+.75rem)] z-[52] max-h-[calc(100dvh-var(--an-mobile-nav-offset)-1.5rem)] overflow-y-auto rounded-2xl border border-[var(--an-border-strong)] bg-[var(--an-surface-raised)] p-4 text-[var(--an-text-primary)] shadow-[var(--an-shadow)] lg:hidden"
              data-admin-mobile-more
            >
              <div className="flex items-center justify-between gap-4">
                <Dialog.Title className="text-lg font-bold">
                  {copy.moreTitle}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {copy.moreDescription}
                </Dialog.Description>
                <Dialog.Close asChild>
                  <button
                    aria-label={copy.closeMore}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--an-border)] text-[var(--an-text-muted)] hover:bg-[var(--an-surface-soft)] hover:text-[var(--an-text-primary)]"
                    type="button"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </button>
                </Dialog.Close>
              </div>
              <nav aria-label={copy.primary} className="mt-4 grid gap-1">
                {moreDestinations.map((item) => (
                  <NavigationLink
                    active={isAdminNavigationActive(pathname, item, mode)}
                    href={adminNavigationHref(item, mode)}
                    icon={icons[item.key]}
                    key={item.key}
                    label={copy[item.key]}
                    onNavigate={() => setMoreOpen(false)}
                  />
                ))}
              </nav>
              <nav
                aria-label={copy.utility}
                className="mt-4 grid gap-1 border-t border-[var(--an-border)] pt-4"
              >
                {unifiedAdminUtilityNavigation.map((item) => (
                  <NavigationLink
                    active={isAdminUtilityNavigationActive(pathname, item.href)}
                    href={item.href}
                    icon={icons[item.key]}
                    key={item.key}
                    label={copy[item.key]}
                    onNavigate={() => setMoreOpen(false)}
                  />
                ))}
              </nav>
              {customerContentNotice ? (
                <p
                  className="mt-4 border-t border-[var(--an-border)] pt-4 text-xs leading-relaxed text-[var(--an-text-subtle)]"
                  data-admin-customer-content-notice
                >
                  {customerContentNotice}
                </p>
              ) : null}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </nav>
    );
  }

  return (
    <>
      <nav aria-label={copy.primary} className="grid gap-1">
        {primary.map((item) => (
          <NavigationLink
            active={isAdminNavigationActive(pathname, item, mode)}
            href={adminNavigationHref(item, mode)}
            icon={icons[item.key]}
            key={item.key}
            label={copy[item.key]}
          />
        ))}
      </nav>
      <nav
        aria-label={copy.utility}
        className="mt-auto grid gap-1 border-t border-[var(--an-border)] pt-4"
      >
        {unifiedAdminUtilityNavigation.map((item) => (
          <NavigationLink
            active={isAdminUtilityNavigationActive(pathname, item.href)}
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
