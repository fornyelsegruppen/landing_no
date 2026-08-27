import Link from "next/link";
import { AdminLanguageSwitcher } from "@/components/admin-v2/admin-language-switcher";
import { AdminLogoutButton } from "@/components/admin-v2/admin-logout-button";
import { AdminNavigation } from "@/components/admin-v2/admin-navigation";
import { ControlledPilotBanner } from "@/components/admin-v2/controlled-pilot-banner";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { buildOperatingMode } from "@/lib/platform/operating-mode";

export const dynamic = "force-dynamic";

export default async function AdminV2Layout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);

  return (
    <div className="admin-v2-shell min-h-dvh bg-background bg-[radial-gradient(ellipse_75%_40%_at_60%_-10%,rgba(232,163,23,0.14),transparent_62%)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/92 backdrop-blur-xl lg:pl-72">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link className="font-bold tracking-tight lg:hidden" href="/admin-v2">
            <span className="text-accent">TF</span> Control
          </Link>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold">{user.displayName || user.email}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AdminLanguageSwitcher locale={user.interfaceLanguage} />
            <AdminLogoutButton locale={user.interfaceLanguage} />
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-[#090b0f]/95 p-5 lg:flex lg:flex-col">
        <Link className="mb-8 flex items-center gap-3" href="/admin-v2">
          <span className="grid size-11 place-items-center rounded-2xl bg-accent font-black text-accent-foreground">TF</span>
          <span><strong className="block">Takfornyelse</strong><small className="text-muted-foreground">Control Center</small></span>
        </Link>
        <AdminNavigation locale={user.interfaceLanguage} />
        <div className="mt-auto space-y-3 border-t border-white/10 pt-5 text-xs text-muted-foreground">
          <p>{copy.customerContentNotice}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link className="hover:text-accent" href="/user">{copy.employeePortal}</Link>
          </div>
          <details className="rounded-xl border border-white/10 p-2"><summary className="cursor-pointer font-semibold hover:text-accent">{copy.technicalAdmin}</summary><Link className="mt-2 block hover:text-accent" href="/admin">Payload backoffice</Link></details>
        </div>
      </aside>

      <div className="border-b border-white/10 px-4 py-3 lg:hidden">
        <details className="group rounded-2xl border border-white/10 bg-background-elevated/85 p-3">
          <summary className="cursor-pointer list-none font-semibold text-accent">{copy.menu}</summary>
          <div className="mt-3"><AdminNavigation locale={user.interfaceLanguage} mobile /></div>
        </details>
      </div>

      <main className="min-h-[calc(100dvh-4rem)] bg-background/0 px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8">
        <ControlledPilotBanner locale={user.interfaceLanguage} status={buildOperatingMode()} />
        {children}
      </main>
    </div>
  );
}
