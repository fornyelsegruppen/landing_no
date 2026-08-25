import Link from "next/link";
import { ExternalLink, FileCheck2, FileSearch, Filter, FolderOpen, Search } from "lucide-react";
import { adminDocumentTypes, loadAdminDocuments, type AdminDocumentType } from "@/lib/admin-v2/documents";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { statusLabel } from "@/lib/admin-v2/labels";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

function documentType(input?: string): AdminDocumentType {
  return adminDocumentTypes.includes(input as AdminDocumentType) ? input as AdminDocumentType : "all";
}

export default async function AdminDocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const params = await searchParams;
  const filters = {
    query: value(params.q),
    status: value(params.status) || "all",
    type: documentType(value(params.type)),
  };
  const payload = await getPayload();
  const allDocuments = await loadAdminDocuments(payload);
  const documents = await loadAdminDocuments(payload, filters);
  const statuses = [...new Set(allDocuments.map((item) => item.status).filter((item): item is string => Boolean(item)))].sort();
  const groups = [...documents.reduce((map, item) => {
    const group = map.get(item.leadId) || { caseHref: item.caseHref, customer: item.customer, leadId: item.leadId, documents: [] as typeof documents };
    group.documents.push(item);
    map.set(item.leadId, group);
    return map;
  }, new Map<number, { caseHref: string; customer: string; leadId: number; documents: typeof documents }>()).values()];
  const locale = panelDateLocale(user.interfaceLanguage);
  const formatDate = (date?: string) => date
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))
    : "—";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.control}</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl"><FolderOpen aria-hidden="true" className="size-8 text-accent" />{copy.documents.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{copy.documents.intro}</p>
      </header>

      <section aria-labelledby="document-filter-title" className="rounded-3xl border border-white/10 bg-background-elevated/75 p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold" id="document-filter-title"><Filter aria-hidden="true" className="size-5 text-accent" />{copy.documents.filters}</h2>
        <form action="/admin-v2/documents" className="mt-5 grid gap-4 lg:grid-cols-12">
          <label className="grid gap-1.5 lg:col-span-6">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.documents.query}</span>
            <span className="flex min-h-12 items-center rounded-xl border border-white/10 bg-black/15 px-3 focus-within:border-accent/60">
              <Search aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" defaultValue={filters.query} name="q" type="search" />
            </span>
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.documents.type}</span>
            <select className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm" defaultValue={filters.type} name="type">
              <option value="all">{copy.documents.all}</option>
              {adminDocumentTypes.filter((type) => type !== "all").map((type) => <option key={type} value={type}>{copy.documents.types[type]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.documents.status}</span>
            <select className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm" defaultValue={filters.status} name="status">
              <option value="all">{copy.documents.all}</option>
              {statuses.map((status) => <option key={status} value={status}>{statusLabel(user.interfaceLanguage, status)}</option>)}
            </select>
          </label>
          <div className="flex gap-3 lg:col-span-12 lg:justify-end">
            <Link className="grid min-h-12 place-items-center rounded-xl border border-white/10 px-5 text-sm font-semibold hover:border-accent/50" href="/admin-v2/documents">{copy.documents.clear}</Link>
            <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover" type="submit">{copy.documents.apply}</button>
          </div>
        </form>
      </section>

      <section aria-live="polite">
        <p className="mb-3 text-sm font-semibold text-muted-foreground"><span className="text-white">{documents.length}</span> {copy.documents.found} · <span className="text-white">{groups.length}</span> {copy.documents.cases}</p>
        {groups.length ? (
          <div className="grid gap-5">
            {groups.map((group) => (
              <article className="overflow-hidden rounded-3xl border border-white/10 bg-background-elevated/75" key={group.leadId}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-accent">#{group.leadId}</p>
                    <h2 className="mt-1 text-xl font-bold">{group.customer}</h2>
                  </div>
                  <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent/35 px-4 text-sm font-bold text-accent hover:bg-accent/10" href={group.caseHref}>{copy.documents.openCase}<ExternalLink aria-hidden="true" className="size-4" /></Link>
                </header>
                <div className="divide-y divide-white/10">
                  {group.documents.map((document) => (
                    <div className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,.6fr)_auto] lg:items-center" key={document.id}>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent"><FileCheck2 aria-hidden="true" className="size-4" />{copy.documents.types[document.type]}</p>
                        <strong className="mt-1 block truncate">{document.reference}</strong>
                        <p className="truncate text-sm text-muted-foreground">{document.filename}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>{document.version ? `${copy.documents.version} ${document.version} · ` : ""}{document.status ? statusLabel(user.interfaceLanguage, document.status) : "—"}</p>
                        <p className="mt-1">{formatDate(document.createdAt)}</p>
                        {document.hash ? <p className="mt-1 font-mono text-xs" title={document.hash}>{copy.documents.integrity}: {document.hash.slice(0, 12)}…</p> : null}
                      </div>
                      <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent-hover" href={document.href} rel="noreferrer" target="_blank"><FileSearch aria-hidden="true" className="size-4" />{copy.documents.openDocument}</a>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-background-elevated/45 p-8 text-center text-muted-foreground">{copy.documents.empty}</div>
        )}
      </section>
    </div>
  );
}
