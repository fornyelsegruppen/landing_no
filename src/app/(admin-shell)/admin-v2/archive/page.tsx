import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import { loadAdminCaseList, type CaseListRecordState } from "@/lib/admin-v2/case-list";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function AdminArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const caseCopy = getAdminCaseCopy(user.interfaceLanguage);
  const params = await searchParams;
  const state: CaseListRecordState = first(params.state) === "trashed" ? "trashed" : "archived";
  const query = first(params.q);
  const result = await loadAdminCaseList(await getPayload(), { query, recordState: state, status: "all" });
  const locale = panelDateLocale(user.interfaceLanguage);
  const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Oslo" }).format(new Date(value)) : "—";
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.control}</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{copy.archive.title}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{copy.archive.intro}</p></header>
    <section className="rounded-3xl border border-white/10 bg-background-elevated/75 p-4 sm:p-6">
      <form action="/admin-v2/archive" className="grid gap-4 sm:grid-cols-[1fr_15rem_auto] sm:items-end">
        <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.query}</span><span className="flex min-h-12 items-center rounded-xl border border-white/10 bg-black/15 px-3"><Search aria-hidden="true" className="mr-2 size-4 text-muted-foreground"/><input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue={query} name="q" type="search"/></span></label>
        <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.archive.state}</span><select className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3" defaultValue={state} name="state"><option value="archived">{copy.archive.archived}</option><option value="trashed">{copy.archive.trashed}</option></select></label>
        <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground" type="submit">{copy.cases.apply}</button>
      </form>
    </section>
    <section><p className="mb-3 text-sm text-muted-foreground"><strong className="text-white">{result.items.length}</strong> {copy.cases.found}</p>{result.items.length ? <div className="grid gap-3">{result.items.map((item) => <Link className="group grid gap-3 rounded-3xl border border-white/10 bg-background-elevated/75 p-5 transition hover:border-accent/45 sm:grid-cols-[1fr_auto] sm:items-center" href={item.href} key={item.id}><span><span className="text-xs font-bold uppercase tracking-wider text-accent">{caseCopy.case} #{item.id}</span><strong className="mt-1 block text-lg">{item.customer}</strong><span className="mt-1 block text-sm text-muted-foreground">{item.postalAddress || item.email || item.phone || "—"}</span><span className="mt-2 block text-xs text-muted-foreground">{copy.archive.classification}: {item.archiveClassification ? caseCopy.archiveClasses[item.archiveClassification as keyof typeof caseCopy.archiveClasses] : "—"} · {copy.cases.created}: {formatDate(item.createdAt)}</span>{item.purgeAfter ? <span className="mt-1 block text-xs text-muted-foreground">{copy.archive.purgeAfter}: {formatDate(item.purgeAfter)}</span> : null}</span><span className="inline-flex items-center gap-2 font-bold text-accent">{copy.cases.openCase}<ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-1"/></span></Link>)}</div> : <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-muted-foreground">{copy.cases.empty}</div>}</section>
  </div>;
}
