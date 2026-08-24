import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, Search, UserRoundX } from "lucide-react";
import {
  loadAdminDashboard,
  loadAdminQueue,
  normalizeAdminSearchTerm,
  parseAdminQueue,
  searchAdminRecords,
  type AdminQueueKey,
} from "@/lib/admin-v2/dashboard";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const cardDefinitions = [
  { key: "newLeads", queue: "new-leads" },
  { key: "replyDrafts", queue: "reply-drafts" },
  { key: "changeAgreements", queue: "change-agreements" },
  { key: "aiDrafts", queue: "blog-review" },
  { key: "pendingQuotes", queue: "quote-review" },
  { key: "pendingContracts", queue: "contract-signing" },
  { key: "activeWork", queue: "active-work" },
] as const;

function queueTitle(queue: AdminQueueKey, copy: ReturnType<typeof getAdminV2Copy>) {
  const titles: Record<AdminQueueKey, string> = {
    "new-leads": copy.cards.newLeads,
    "reply-drafts": copy.cards.replyDrafts,
    "change-agreements": copy.cards.changeAgreements,
    "blog-review": copy.cards.aiDrafts,
    "quote-review": copy.cards.pendingQuotes,
    "contract-signing": copy.cards.pendingContracts,
    "active-work": copy.cards.activeWork,
    attention: copy.needsAttention,
    "unassigned-work": copy.unassignedWork,
    "upcoming-work": copy.next72Hours,
  };
  return titles[queue];
}

function safeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminV2Page({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const params = await searchParams;
  const query = normalizeAdminSearchTerm(safeParam(params.q));
  const queue = parseAdminQueue(safeParam(params.queue));
  const payload = await getPayload();
  const dashboard = await loadAdminDashboard(payload);

  let searchResults: Awaited<ReturnType<typeof searchAdminRecords>> = [];
  let queueItems: Awaited<ReturnType<typeof loadAdminQueue>> = [];
  let detailLoadFailed = false;
  try {
    if (query.length >= 2) searchResults = await searchAdminRecords(payload, query);
    if (queue) queueItems = await loadAdminQueue(payload, queue);
  } catch {
    detailLoadFailed = true;
  }

  const counts = dashboard.counts;
  const dateFormatter = new Intl.DateTimeFormat(panelDateLocale(user.interfaceLanguage), {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.control}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{queue ? queueTitle(queue, copy) : copy.dashboard}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{queue ? copy.queue : copy.dashboardIntro}</p>
        </div>
        <form action="/admin-v2" className="w-full max-w-xl" role="search">
          <label className="sr-only" htmlFor="admin-search">{copy.searchLabel}</label>
          <div className="flex rounded-2xl border border-white/10 bg-background-elevated/90 p-1.5 shadow-xl shadow-black/10 focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20">
            <Search aria-hidden="true" className="ml-3 mt-3 size-5 shrink-0 text-muted-foreground" />
            <input
              className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70"
              defaultValue={query}
              id="admin-search"
              maxLength={80}
              name="q"
              placeholder={copy.searchPlaceholder}
              type="search"
            />
            <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent-hover" type="submit">{copy.search}</button>
          </div>
          <p className="mt-1.5 px-2 text-xs text-muted-foreground">{copy.searchHint}</p>
        </form>
      </section>

      {!dashboard.ok || detailLoadFailed ? (
        <div className="flex gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm" role="alert">
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-danger" />
          <p>{copy.dataUnavailable}</p>
        </div>
      ) : null}

      {query.length >= 2 ? (
        <section aria-labelledby="search-results-title" className="rounded-3xl border border-white/10 bg-background-elevated/75 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold" id="search-results-title">{copy.searchResults}</h2>
            <Link className="text-sm font-semibold text-accent hover:text-accent-hover" href="/admin-v2">×</Link>
          </div>
          {searchResults.length ? (
            <div className="mt-4 grid gap-2">
              {searchResults.map((result) => (
                <Link className="group flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 transition hover:border-accent/50 hover:bg-white/5" href={result.href} key={`${result.type}-${result.id}`}>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-accent">{copy.resultTypes[result.type]}</span>
                    <strong className="mt-0.5 block truncate">{result.reference}</strong>
                    {result.subtitle ? <small className="block truncate text-muted-foreground">{result.subtitle}</small> : null}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
              ))}
            </div>
          ) : <p className="mt-5 text-muted-foreground">{copy.noSearchResults}</p>}
        </section>
      ) : null}

      {queue ? (
        <section aria-labelledby="queue-title" className="rounded-3xl border border-white/10 bg-background-elevated/75 p-4 sm:p-6">
          <h2 className="text-xl font-bold" id="queue-title">{queueTitle(queue, copy)}</h2>
          {queueItems.length ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              {queueItems.map((item) => (
                <Link className="group grid min-h-20 gap-2 border-b border-white/10 bg-black/10 p-4 transition last:border-b-0 hover:bg-white/5 sm:grid-cols-[minmax(0,1.4fr)_minmax(8rem,.7fr)_auto] sm:items-center" href={item.href} key={`${item.href}-${item.id}`}>
                  <span className="min-w-0">
                    <strong className="block truncate">{item.reference}</strong>
                    {item.subtitle ? <small className="block truncate text-muted-foreground">{item.subtitle}</small> : null}
                  </span>
                  <span className="text-sm text-muted-foreground">{item.status ? `${copy.status}: ${item.status}` : ""}</span>
                  <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground sm:justify-end">
                    {item.createdAt ? dateFormatter.format(new Date(item.createdAt)) : ""}
                    <ArrowRight aria-hidden="true" className="size-4 transition group-hover:text-accent" />
                  </span>
                </Link>
              ))}
            </div>
          ) : <p className="mt-5 text-muted-foreground">{copy.queueEmpty}</p>}
        </section>
      ) : (
        <>
          <section aria-label={copy.dashboard} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cardDefinitions.map((card) => (
              <Link className="group min-h-36 rounded-3xl border border-white/10 bg-background-elevated/75 p-5 transition hover:-translate-y-0.5 hover:border-accent/45 hover:bg-background-elevated" href={`/admin-v2?queue=${card.queue}`} key={card.key}>
                <strong className="block text-4xl font-black tracking-tight text-white">{counts ? counts[card.key] : "—"}</strong>
                <span className="mt-3 block max-w-52 font-semibold text-white/85">{copy.cards[card.key]}</span>
                <span className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">{copy.openQueue}<ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Link className="rounded-3xl border border-danger/30 bg-danger/10 p-5 transition hover:border-danger/60" href="/admin-v2?queue=attention">
              <AlertTriangle aria-hidden="true" className="size-6 text-danger" />
              <strong className="mt-4 block text-3xl">{counts ? counts.attention : "—"}</strong>
              <span className="mt-1 block font-semibold">{copy.needsAttention}</span>
            </Link>
            <Link className="rounded-3xl border border-white/10 bg-background-elevated/75 p-5 transition hover:border-accent/45" href="/admin-v2?queue=unassigned-work">
              <UserRoundX aria-hidden="true" className="size-6 text-accent" />
              <strong className="mt-4 block text-3xl">{counts ? counts.unassignedWork : "—"}</strong>
              <span className="mt-1 block font-semibold">{copy.unassignedWork}</span>
            </Link>
            <Link className="rounded-3xl border border-white/10 bg-background-elevated/75 p-5 transition hover:border-accent/45" href="/admin-v2?queue=upcoming-work">
              <CalendarClock aria-hidden="true" className="size-6 text-accent" />
              <strong className="mt-4 block text-3xl">{counts ? counts.upcomingWork : "—"}</strong>
              <span className="mt-1 block font-semibold">{copy.next72Hours}</span>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
