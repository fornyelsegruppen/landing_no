"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

export const adminNavigationLinks = [
  { key: "overview", href: "/admin-v2", queue: null },
  { key: "leads", href: "/admin-v2/cases", queue: "cases" },
  { key: "contractRequests", href: "/admin-v2/contract-requests", queue: "contractRequests" },
  { key: "quotes", href: "/admin-v2/offers", queue: "offers" },
  { key: "contracts", href: "/admin-v2/contracts", queue: "contracts" },
  { key: "work", href: "/admin-v2/work", queue: "work" },
  { key: "documents", href: "/admin-v2/documents", queue: "documents" },
  { key: "archive", href: "/admin-v2/archive", queue: "archive" },
  { key: "blog", href: "/admin-v2/blog", queue: "blog" },
  { key: "employees", href: "/admin-v2/employees", queue: "employees" },
  { key: "settings", href: "/admin-v2/settings", queue: "settings" },
] as const;

export function AdminNavigation({ locale, mobile = false }: { locale: PanelLocale; mobile?: boolean }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const selectedQueue = searchParams.get("queue");
  const copy = getAdminV2Copy(locale);

  return (
    <nav aria-label={copy.control} className={mobile ? "grid grid-cols-2 gap-2" : "grid gap-1"}>
      {adminNavigationLinks.map((link) => {
        const active = link.queue === "cases"
          ? pathname.startsWith("/admin-v2/cases")
          : link.queue === "documents"
          ? pathname.startsWith("/admin-v2/documents")
          : link.queue === "archive"
          ? pathname.startsWith("/admin-v2/archive")
          : ["contractRequests", "offers", "contracts", "work", "blog", "employees", "settings"].includes(link.queue || "")
          ? pathname.startsWith(link.href)
          : link.queue === null
          ? pathname === "/admin-v2" && !selectedQueue
          : pathname === "/admin-v2" && selectedQueue === link.queue;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? "bg-accent text-accent-foreground" : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
            href={link.href}
            key={link.key}
          >
            {copy.navigation[link.key]}
          </Link>
        );
      })}
    </nav>
  );
}
