import Link from "next/link";
import { Bell, ChevronDown, Wrench } from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import { adminNextDarkThemeCss } from "@/lib/admin-next/design-tokens";
import type { AdminWorkspaceMode } from "@/lib/admin-next/navigation-contract";
import { AdminLanguageSwitcher } from "@/components/admin-v2/admin-language-switcher";
import { AdminLogoutButton } from "@/components/admin-v2/admin-logout-button";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { AdminGlobalSearch } from "./admin-global-search";
import { UnifiedAdminNavigation } from "./unified-admin-navigation";

const copy = {
  nb: {
    product: "Takfornyelse",
    workspace: "Arbeidsflate",
    preview: "Beskyttet Preview · ingen skriving",
    account: "Administrator",
    skip: "Hopp til hovedinnhold",
    notifications: "Varsler er ikke tilgjengelige ennå",
    technical: "Teknisk administrasjon",
  },
  lt: {
    product: "Takfornyelse",
    workspace: "Darbo sistema",
    preview: "Apsaugota Preview · be įrašymo",
    account: "Administratorius",
    skip: "Pereiti prie pagrindinio turinio",
    notifications: "Pranešimai dar nepasiekiami",
    technical: "Techninis administravimas",
  },
  en: {
    product: "Takfornyelse",
    workspace: "Operations workspace",
    preview: "Protected Preview · no writes",
    account: "Administrator",
    skip: "Skip to main content",
    notifications: "Notifications are not available yet",
    technical: "Technical administration",
  },
} as const;

export function AdminNextShell({
  children,
  displayName,
  locale,
  mode = "preview",
  notice,
}: {
  children: React.ReactNode;
  displayName?: string | null;
  locale: PanelLocale;
  mode?: AdminWorkspaceMode;
  notice?: React.ReactNode;
}) {
  const t = copy[locale];
  const customerContentNotice =
    mode === "canonical"
      ? getAdminV2Copy(locale).customerContentNotice
      : undefined;
  const homeHref =
    mode === "preview"
      ? "/admin-next-preview/work?view=today&queue=all&limit=25"
      : "/admin-v2";
  return (
    <div
      className="admin-next-shell admin-next-theme min-h-dvh bg-[var(--an-canvas)] text-[var(--an-text-primary)]"
      data-admin-shell
      style={
        {
          "--an-mobile-nav-offset": "calc(5rem + env(safe-area-inset-bottom))",
        } as React.CSSProperties
      }
    >
      <style>{`${adminNextDarkThemeCss}
        :root { --an-mobile-nav-offset: calc(5rem + env(safe-area-inset-bottom)); }
        @media (max-width: 63.999rem) {
          html { scroll-padding-bottom: calc(6rem + env(safe-area-inset-bottom)); }
          .admin-next-shell :where(a, button, input, select, textarea, [tabindex]):focus {
            scroll-margin-bottom: calc(6rem + env(safe-area-inset-bottom));
          }
        }
      `}</style>
      <a
        className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-lg bg-[var(--an-action)] px-4 py-2 font-bold text-[var(--an-action-ink)] focus:translate-y-0"
        href="#admin-main-content"
      >
        {t.skip}
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[var(--an-border)] bg-[var(--an-sidebar)] px-4 py-5 lg:flex lg:flex-col">
        <Link className="flex items-center gap-3 px-2" href={homeHref}>
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--an-action)] text-sm font-black text-[var(--an-action-ink)]">
            TF
          </span>
          <span>
            <strong className="block text-sm leading-tight">{t.product}</strong>
            <small className="text-xs font-semibold text-[var(--an-text-muted)]">
              {t.workspace}
            </small>
          </span>
        </Link>
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <UnifiedAdminNavigation locale={locale} mode={mode} />
        </div>
        {customerContentNotice ? (
          <p
            className="mt-4 border-t border-[var(--an-border)] px-2 pt-4 text-xs leading-relaxed text-[var(--an-text-subtle)]"
            data-admin-customer-content-notice
          >
            {customerContentNotice}
          </p>
        ) : null}
        <Link
          className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-[var(--an-border)] px-3 text-xs font-semibold text-[var(--an-text-subtle)] hover:bg-[var(--an-surface-soft)] hover:text-[var(--an-text-primary)]"
          href="/admin"
        >
          <Wrench aria-hidden="true" className="size-4" />
          {t.technical}
        </Link>
      </aside>
      <header
        className="sticky top-0 z-30 border-b border-[var(--an-border)] bg-[color:rgba(11,17,24,.94)] backdrop-blur lg:ml-64"
        data-admin-shell-header
      >
        <div
          className="flex min-h-16 min-w-0 items-center gap-3 px-4 sm:px-6 lg:px-8"
          data-admin-shell-header-controls
        >
          <Link
            className="flex min-w-0 shrink-0 items-center gap-2 lg:hidden"
            href={homeHref}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--an-action)] text-xs font-black text-[var(--an-action-ink)]">
              TF
            </span>
            <strong className="hidden truncate text-sm sm:block">
              {t.workspace}
            </strong>
          </Link>
          <div className="mx-auto hidden w-full max-w-xl min-w-0 flex-1 xl:block">
            <AdminGlobalSearch locale={locale} />
          </div>
          {mode === "preview" ? (
            <span className="ml-auto hidden rounded-full border border-[var(--an-action)] bg-[var(--an-action-soft)] px-3 py-1.5 text-xs font-bold whitespace-nowrap text-[var(--an-action)] xl:inline-flex">
              {t.preview}
            </span>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
            <AdminLanguageSwitcher locale={locale} />
            <AdminLogoutButton locale={locale} />
          </div>
          <button
            aria-label={t.notifications}
            className="an-disabled relative hidden size-11 cursor-not-allowed place-items-center rounded-xl border sm:grid"
            disabled
            title={t.notifications}
            type="button"
          >
            <Bell aria-hidden="true" className="size-5" />
          </button>
          <Link
            aria-label={t.account}
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] px-3 text-left xl:flex"
            href="/admin-v2/settings"
          >
            <span className="grid size-8 place-items-center rounded-full bg-[var(--an-action-soft)] text-xs font-black text-[var(--an-action)]">
              AD
            </span>
            <span className="max-w-32 truncate text-xs font-semibold">
              {displayName || t.account}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 text-[var(--an-text-subtle)]"
            />
          </Link>
        </div>
        <div
          className="px-4 pb-3 sm:px-6 lg:px-8 xl:hidden"
          data-admin-shell-search-row
        >
          <AdminGlobalSearch locale={locale} />
        </div>
      </header>
      <div className="lg:ml-64">
        {mode === "preview" ? (
          <div className="border-b border-[var(--an-action)] bg-[var(--an-action-soft)] px-4 py-2 text-center text-xs font-semibold text-[var(--an-action)] xl:hidden">
            {t.preview}
          </div>
        ) : null}
        <main
          className="min-h-[calc(100dvh-4rem)] px-4 py-5 pb-[calc(var(--an-mobile-nav-offset)+1rem)] sm:px-6 lg:px-8 lg:py-8 lg:pb-8"
          id="admin-main-content"
          tabIndex={-1}
        >
          {notice}
          {children}
        </main>
      </div>
      <div
        className="fixed inset-x-0 bottom-0 z-50 min-h-[var(--an-mobile-nav-offset)] border-t border-[var(--an-border)] bg-[color:rgba(11,17,24,.96)] px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
        data-admin-mobile-navigation
      >
        <UnifiedAdminNavigation
          customerContentNotice={customerContentNotice}
          locale={locale}
          mobile
          mode={mode}
        />
      </div>
    </div>
  );
}
