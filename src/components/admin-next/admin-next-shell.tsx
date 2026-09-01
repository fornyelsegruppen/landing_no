import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FolderKanban,
  House,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";

const copy = {
  nb: {
    product: "Takfornyelse",
    workspace: "Admin Next",
    preview: "Beskyttet Preview · syntetiske data",
    search: "Søk etter kunde, adresse eller referanse",
    account: "Administrator",
    help: "Hjelp",
    status: "Modulstatus",
    menu: "Meny",
    notifications: "Varsler er ikke tilgjengelige i beskyttet Preview",
    nav: {
      today: "I dag",
      cases: "Saker",
      calendar: "Plan",
      customers: "Kunder",
      work: "Arbeid",
      documents: "Dokumenter",
      settings: "Innstillinger",
    },
  },
  lt: {
    product: "Takfornyelse",
    workspace: "Admin Next",
    preview: "Apsaugota Preview · sintetiniai duomenys",
    search: "Ieškoti kliento, adreso arba numerio",
    account: "Administratorius",
    help: "Pagalba",
    status: "Modulių būsena",
    menu: "Meniu",
    notifications: "Pranešimai apsaugotoje Preview versijoje dar nepasiekiami",
    nav: {
      today: "Šiandien",
      cases: "Bylos",
      calendar: "Planas",
      customers: "Klientai",
      work: "Darbai",
      documents: "Dokumentai",
      settings: "Nustatymai",
    },
  },
  en: {
    product: "Takfornyelse",
    workspace: "Admin Next",
    preview: "Protected Preview · synthetic data",
    search: "Search customer, address or reference",
    account: "Administrator",
    help: "Help",
    status: "Module status",
    menu: "Menu",
    notifications: "Notifications are not available in protected Preview",
    nav: {
      today: "Today",
      cases: "Cases",
      calendar: "Schedule",
      customers: "Customers",
      work: "Work",
      documents: "Documents",
      settings: "Settings",
    },
  },
} as const;

const primaryNavigation = [
  { key: "today", href: "/admin-next-preview/today", icon: LayoutDashboard },
  { key: "cases", href: "/admin-next-preview/cases/TF-1042", icon: FolderKanban },
  { key: "calendar", href: "/admin-v2/work", icon: CalendarDays },
  { key: "customers", href: "/admin-v2/cases", icon: Users },
  { key: "work", href: "/admin-v2/work", icon: BriefcaseBusiness },
  { key: "documents", href: "/admin-v2/documents", icon: ClipboardCheck },
] as const;

const mobileNavigation = [
  { key: "today", href: "/admin-next-preview/today", icon: House },
  { key: "cases", href: "/admin-next-preview/cases/TF-1042", icon: FolderKanban },
  { key: "calendar", href: "/admin-v2/work", icon: CalendarDays },
  { key: "work", href: "/admin-v2/next-preview", icon: Menu },
] as const;

export function AdminNextShell({
  children,
  locale,
  displayName,
}: {
  children: React.ReactNode;
  locale: PanelLocale;
  displayName?: string | null;
}) {
  const t = copy[locale];

  return (
    <div className="admin-next-shell min-h-dvh bg-[#f3f5f7] text-[#17202b]">
      <style>{`
        .admin-next-shell:has([data-admin-next-section="today"]) [data-admin-next-nav="today"],
        .admin-next-shell:has([data-admin-next-section="cases"]) [data-admin-next-nav="cases"] {
          background: #eaf2f8;
          color: #102c46;
        }
      `}</style>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#dfe4e8] bg-white px-4 py-5 lg:flex lg:flex-col">
        <Link className="flex items-center gap-3 px-2" href="/admin-next-preview/today">
          <span className="grid size-10 place-items-center rounded-xl bg-[#152a42] text-sm font-black text-white">
            TF
          </span>
          <span>
            <strong className="block text-sm leading-tight">{t.product}</strong>
            <small className="text-xs font-semibold text-[#657181]">{t.workspace}</small>
          </span>
        </Link>

        <nav aria-label={t.workspace} className="mt-8 grid gap-1">
          {primaryNavigation.map(({ key, href, icon: Icon }) => {
            return (
              <Link
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#596779] transition hover:bg-[#f3f5f7] hover:text-[#17202b]"
                data-admin-next-nav={key}
                href={href}
                key={key}
              >
                <Icon aria-hidden="true" className="size-[18px]" />
                {t.nav[key]}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-1 border-t border-[#e5e9ed] pt-4">
          <Link className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#596779] hover:bg-[#f3f5f7]" href="/admin-v2/next-preview">
            <CircleHelp aria-hidden="true" className="size-[18px]" />
            {t.status}
          </Link>
          <Link className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#596779] hover:bg-[#f3f5f7]" href="/admin-v2/settings">
            <Settings aria-hidden="true" className="size-[18px]" />
            {t.nav.settings}
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-[#dfe4e8] bg-white/95 backdrop-blur lg:ml-64">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link aria-label={t.status} className="grid size-11 place-items-center rounded-xl border border-[#dfe4e8] lg:hidden" href="/admin-v2/next-preview">
            <Menu aria-hidden="true" className="size-5" />
          </Link>
          <Link className="flex min-w-0 items-center gap-2 lg:hidden" href="/admin-next-preview/today">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#152a42] text-xs font-black text-white">TF</span>
            <strong className="truncate text-sm">{t.workspace}</strong>
          </Link>

          <form action="/admin-v2" className="mx-auto hidden w-full max-w-xl md:block" role="search">
            <label className="sr-only" htmlFor="admin-next-global-search">{t.search}</label>
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[#dfe4e8] bg-[#f7f8f9] px-3 focus-within:border-[#527896] focus-within:ring-2 focus-within:ring-[#527896]/15">
              <Search aria-hidden="true" className="size-[18px] text-[#758291]" />
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#7b8794]" id="admin-next-global-search" name="q" placeholder={t.search} type="search" />
              <kbd className="rounded border border-[#d7dde2] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#73808d]">⌘ K</kbd>
            </div>
          </form>

          <span className="ml-auto hidden rounded-full bg-[#fff4d9] px-3 py-1.5 text-xs font-bold text-[#7a5612] xl:inline-flex">
            {t.preview}
          </span>
          <button aria-label={t.notifications} className="relative grid size-11 cursor-not-allowed place-items-center rounded-xl border border-[#dfe4e8] bg-[#f7f8f9] text-[#8a949e]" disabled title={t.notifications} type="button">
            <Bell aria-hidden="true" className="size-5" />
          </button>
          <Link aria-label={t.nav.settings} className="hidden min-h-11 items-center gap-2 rounded-xl border border-[#dfe4e8] bg-white px-3 text-left sm:flex" href="/admin-v2/settings">
            <span className="grid size-8 place-items-center rounded-full bg-[#dfeaf2] text-xs font-black text-[#183b58]">AD</span>
            <span className="max-w-32 truncate text-xs font-semibold">{displayName || t.account}</span>
            <ChevronDown aria-hidden="true" className="size-4 text-[#7b8794]" />
          </Link>
        </div>
      </header>

      <div className="lg:ml-64">
        <div className="border-b border-[#ead9ae] bg-[#fff8e7] px-4 py-2 text-center text-xs font-semibold text-[#6c5219] xl:hidden">
          {t.preview}
        </div>
        <main className="min-h-[calc(100dvh-4rem)] px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav aria-label={t.workspace} className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#dfe4e8] bg-white/96 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        {mobileNavigation.map(({ key, href, icon: Icon }) => {
          return (
            <Link className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-[#6d7987]" data-admin-next-nav={key} href={href} key={key}>
              <Icon aria-hidden="true" className="size-5" />
              {t.nav[key]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
