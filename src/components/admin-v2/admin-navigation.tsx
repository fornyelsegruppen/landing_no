"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

const links = [
  { key: "overview", href: "/admin-v2", queue: null },
  { key: "leads", href: "/admin-v2?queue=new-leads", queue: "new-leads" },
  { key: "quotes", href: "/admin-v2?queue=quote-review", queue: "quote-review" },
  { key: "contracts", href: "/admin-v2?queue=contract-signing", queue: "contract-signing" },
  { key: "work", href: "/admin-v2?queue=active-work", queue: "active-work" },
  { key: "documents", href: "/admin/collections/private-media", queue: "documents" },
  { key: "messages", href: "/admin-v2?queue=reply-drafts", queue: "reply-drafts" },
  { key: "blog", href: "/admin-v2?queue=blog-review", queue: "blog-review" },
  { key: "employees", href: "/admin/collections/users", queue: "employees" },
  { key: "settings", href: "/admin", queue: "settings" },
] as const;

export function AdminNavigation({ locale, mobile = false }: { locale: PanelLocale; mobile?: boolean }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const selectedQueue = searchParams.get("queue");
  const copy = getAdminV2Copy(locale);

  return (
    <nav aria-label={copy.control} className={mobile ? "grid grid-cols-2 gap-2" : "grid gap-1"}>
      {links.map((link) => {
        const active = link.queue === null
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
