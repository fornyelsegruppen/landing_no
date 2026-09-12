import Link from "next/link";
import type { CaseHistoryPage } from "@/lib/admin-v2/case-read-model";

type Locale = "nb" | "lt" | "en";

const copy = {
  nb: {
    label: "Historikk-sider",
    newer: "Nyere",
    older: "Eldre",
    of: "av",
    total: "Totalt",
  },
  lt: {
    label: "Istorijos puslapiai",
    newer: "Naujesni",
    older: "Senesni",
    of: "iš",
    total: "Iš viso",
  },
  en: {
    label: "History pages",
    newer: "Newer",
    older: "Older",
    of: "of",
    total: "Total",
  },
} as const;

export function caseHistoryPageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  pageKey: "documentPage" | "messagePage",
  page: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set(pageKey, String(page));
  else query.delete(pageKey);
  const serialized = query.toString();
  const anchor =
    pageKey === "messagePage" ? "messages-section" : "documents-section";
  return `${basePath}${serialized ? `?${serialized}` : ""}#${anchor}`;
}

export function CaseHistoryPagination<T>({
  basePath,
  locale,
  pageData,
  pageKey,
  params,
}: {
  basePath: string;
  locale: Locale;
  pageData: CaseHistoryPage<T>;
  pageKey: "documentPage" | "messagePage";
  params: Record<string, string | undefined>;
}) {
  if (!pageData.totalDocs) return null;
  const labels = copy[locale];
  const buttonClass =
    "inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-bold hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-accent";
  const disabledClass =
    "inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-bold text-muted-foreground/50";
  return (
    <nav
      aria-label={labels.label}
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"
    >
      <span className="text-muted-foreground text-sm">
        {pageData.page} {labels.of} {Math.max(pageData.totalPages, 1)} ·{" "}
        {labels.total}: {pageData.totalDocs}
      </span>
      <span className="flex flex-wrap gap-2">
        {pageData.hasPrevPage ? (
          <Link
            className={buttonClass}
            href={caseHistoryPageHref(
              basePath,
              params,
              pageKey,
              pageData.page - 1,
            )}
            prefetch={false}
          >
            {labels.newer}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {labels.newer}
          </span>
        )}
        {pageData.hasNextPage ? (
          <Link
            className={buttonClass}
            href={caseHistoryPageHref(
              basePath,
              params,
              pageKey,
              pageData.page + 1,
            )}
            prefetch={false}
          >
            {labels.older}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {labels.older}
          </span>
        )}
      </span>
    </nav>
  );
}
