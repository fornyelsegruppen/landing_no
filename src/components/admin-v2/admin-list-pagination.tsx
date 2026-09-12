import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import { adminListPageHref, type AdminListPaginationMeta } from "@/lib/admin-v2/pagination";

const labels = {
  nb: { next: "Neste", previous: "Forrige", page: "Side", of: "av" },
  lt: { next: "Kitas", previous: "Ankstesnis", page: "Puslapis", of: "iš" },
  en: { next: "Next", previous: "Previous", page: "Page", of: "of" },
} as const;

export function AdminListPagination({ locale, meta, pathname, params }: {
  locale: PanelLocale;
  meta: AdminListPaginationMeta;
  pathname: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const copy = labels[locale];
  if (meta.totalDocs === 0) return null;
  return <nav aria-label={`${copy.page} ${meta.page} ${copy.of} ${meta.totalPages}`} className="mt-5 flex flex-wrap items-center justify-between gap-3" role="navigation">
    <span className="text-sm text-muted-foreground">{copy.page} {meta.page} {copy.of} {meta.totalPages}</span>
    <div className="flex gap-2">
      {meta.hasPrevPage ? <Link aria-label={copy.previous} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold hover:border-accent/50" href={adminListPageHref(pathname, params, meta.page - 1)}><ChevronLeft aria-hidden="true" className="size-4" />{copy.previous}</Link> : null}
      {meta.hasNextPage ? <Link aria-label={copy.next} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold hover:border-accent/50" href={adminListPageHref(pathname, params, meta.page + 1)}>{copy.next}<ChevronRight aria-hidden="true" className="size-4" /></Link> : null}
    </div>
  </nav>;
}
