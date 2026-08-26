import Link from "next/link";
import { ArrowRight, CalendarDays, Filter, Search, UserRound } from "lucide-react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import {
  loadAdminCaseList,
  type AdminCaseListFilters,
  type CaseListStatus,
} from "@/lib/admin-v2/case-list";
import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { statusLabel } from "@/lib/admin-v2/labels";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const actionOptions: CaseNextActionKind[] = [
  "generate_reply",
  "prepare_package",
  "review_cancellation",
  "approve_package",
  "approve_measurement",
  "measurement_required",
  "calculate_price",
  "create_quote",
  "approve_quote",
  "issue_quote",
  "wait_customer",
  "wait_worker_documentation",
  "follow_up_decline",
  "company_sign_contract",
  "create_work_order",
  "assign_worker",
  "schedule_work",
  "resolve_work_block",
  "review_completion",
  "approve_message",
  "retry_message",
  "none",
];

const serviceNames: Record<string, string> = {
  takvask: "Takvask",
  takvask_impregnering: "Takvask + impregnering",
  impregnering: "Impregnering",
  takmaling: "Takmaling",
  nytt_tak: "Nytt tak",
  usikker: "Usikker – taksjekk",
};

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

function selectedAction(input: string | undefined): CaseNextActionKind | "all" {
  return input && actionOptions.includes(input as CaseNextActionKind) ? input as CaseNextActionKind : "all";
}

function selectedStatus(input: string | undefined): CaseListStatus {
  return ["all", "open", "customer_waiting", "waiting_customer", "converted", "closed"].includes(input || "") ? input as CaseListStatus : "all";
}

export default async function AdminCasesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const caseCopy = getAdminCaseCopy(user.interfaceLanguage);
  const params = await searchParams;
  const filters: AdminCaseListFilters = {
    action: selectedAction(value(params.action)),
    dateFrom: value(params.dateFrom),
    dateTo: value(params.dateTo),
    query: value(params.q),
    status: selectedStatus(value(params.status)),
    workerId: Number(value(params.worker)) || undefined,
  };
  const result = await loadAdminCaseList(await getPayload(), filters);
  const locale = panelDateLocale(user.interfaceLanguage);
  const formatDate = (date?: string) => date
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Oslo" }).format(new Date(date))
    : "—";
  const dueLabel = (date?: string, overdue = false) => {
    if (!date) return copy.cases.noDue;
    if (overdue) return copy.cases.dueNow;
    return formatDate(date);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.control}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{copy.cases.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{copy.cases.intro}</p>
      </header>

      <section aria-labelledby="case-filter-title" className="rounded-3xl border border-white/10 bg-background-elevated/75 p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold" id="case-filter-title"><Filter aria-hidden="true" className="size-5 text-accent" />{copy.cases.filters}</h2>
        <form action="/admin-v2/cases" className="mt-5 grid gap-4 lg:grid-cols-12">
          <label className="grid gap-1.5 lg:col-span-5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.query}</span>
            <span className="flex min-h-12 items-center rounded-xl border border-white/10 bg-black/15 px-3 focus-within:border-accent/60">
              <Search aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" defaultValue={filters.query} name="q" type="search" />
            </span>
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.status}</span>
            <select className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm" defaultValue={filters.status} name="status">
              <option value="all">{copy.cases.all}</option>
              <option value="open">{copy.cases.open}</option>
              <option value="customer_waiting">{statusLabel(user.interfaceLanguage, "customer_waiting")}</option>
              <option value="waiting_customer">{copy.cases.waitingCustomer}</option>
              <option value="converted">{copy.cases.converted}</option>
              <option value="closed">{copy.cases.closed}</option>
            </select>
          </label>
          <label className="grid gap-1.5 lg:col-span-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.action}</span>
            <select className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm" defaultValue={filters.action} name="action">
              <option value="all">{copy.cases.all}</option>
              {actionOptions.map((action) => <option key={action} value={action}>{caseCopy.actionLabels[action]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 lg:col-span-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.employee}</span>
            <select className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm" defaultValue={filters.workerId || ""} name="worker">
              <option value="">{copy.cases.all}</option>
              {result.workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.dateFrom}</span>
            <input className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm" defaultValue={filters.dateFrom} name="dateFrom" type="date" />
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.dateTo}</span>
            <input className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm" defaultValue={filters.dateTo} name="dateTo" type="date" />
          </label>
          <div className="flex items-end gap-3 lg:col-span-2">
            <button className="min-h-12 flex-1 rounded-xl bg-accent px-4 font-bold text-accent-foreground hover:bg-accent-hover" type="submit">{copy.cases.apply}</button>
            <Link className="grid min-h-12 place-items-center rounded-xl border border-white/10 px-4 text-sm font-semibold hover:border-accent/50" href="/admin-v2/cases">{copy.cases.clear}</Link>
          </div>
        </form>
      </section>

      <section aria-live="polite">
        <p className="mb-3 text-sm font-semibold text-muted-foreground"><span className="text-white">{result.items.length}</span> {copy.cases.found}</p>
        {result.items.length ? (
          <div className="grid gap-3">
            {result.items.map((item) => (
              <Link className="group grid gap-4 rounded-3xl border border-white/10 bg-background-elevated/75 p-5 transition hover:-translate-y-0.5 hover:border-accent/45 lg:grid-cols-[minmax(0,1.15fr)_minmax(14rem,.85fr)_minmax(14rem,.8fr)_auto] lg:items-center" href={item.href} key={item.id}>
                <span className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">{caseCopy.case} #{item.id}</span>
                  <strong className="mt-1 block truncate text-lg">{item.customer}</strong>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">{item.postalAddress || item.email || item.phone || "—"}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">{serviceNames[item.inquiryType || ""] || item.inquiryType || "—"} · {copy.cases.created}: {formatDate(item.createdAt)}</span>
                </span>
                <span className="min-w-0 rounded-2xl border border-white/10 bg-black/15 p-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.cases.action}</span>
                  <strong className="mt-1 block text-sm">{caseCopy.actionLabels[item.nextAction]}</strong>
                  <span className={`mt-1 block text-xs ${item.overdue ? "font-bold text-accent" : "text-muted-foreground"}`}>{dueLabel(item.dueAt, item.overdue)}</span>
                </span>
                <span className="grid gap-2 text-sm">
                  <span className="inline-flex w-fit rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-accent">{statusLabel(user.interfaceLanguage, item.status)}</span>
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><UserRound aria-hidden="true" className="size-4" />{item.assignedWorker || copy.cases.unassigned}</span>
                  {item.workStatus ? <span className="inline-flex items-center gap-2 text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4" />{copy.cases.work}: {statusLabel(user.interfaceLanguage, item.workStatus)}</span> : null}
                </span>
                <span className="inline-flex items-center justify-end gap-2 font-bold text-accent">{copy.cases.openCase}<ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-background-elevated/45 p-8 text-center text-muted-foreground">{copy.cases.empty}</div>
        )}
      </section>
    </div>
  );
}
