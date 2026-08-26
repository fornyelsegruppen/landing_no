import Link from "next/link";
import { ArrowRight, CalendarClock, ShieldAlert } from "lucide-react";
import type { Where } from "payload";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const copy = {
  nb: { eyebrow: "Kundebevaring og avtalehåndtering", title: "Angre- og endringsmeldinger", intro: "Alle strukturerte kundemeldinger med fristindikasjon, arbeidsstans, samtykke og neste handling.", all: "Alle", active: "Krever behandling", closed: "Avsluttet", recovered: "Kunden beholdt", noContact: "Ikke kontakt", withdrawal: "Angrerett", change: "Endring / kansellering", received: "Mottatt", follow: "Oppfølging", open: "Åpne kundesaken", empty: "Ingen meldinger i denne visningen.", consent: "Én oppfølging tillatt", noConsent: "Ingen salgsoppfølging" },
  lt: { eyebrow: "Klientų išlaikymas ir sutarčių valdymas", title: "Atsisakymai ir pakeitimai", intro: "Visi struktūruoti klientų pranešimai su termino indikacija, darbų sustabdymu, sutikimu ir kitu veiksmu.", all: "Visi", active: "Reikia sprendimo", closed: "Užbaigti", recovered: "Klientas išsaugotas", noContact: "Nebekontaktuoti", withdrawal: "Atsisakymo teisė", change: "Pakeitimas / atšaukimas", received: "Gauta", follow: "Kontaktas", open: "Atidaryti kliento bylą", empty: "Šiame rodinyje pranešimų nėra.", consent: "Leistas vienas kontaktas", noConsent: "Nėra sutikimo pardavimo kontaktui" },
  en: { eyebrow: "Customer recovery and agreement control", title: "Withdrawals and changes", intro: "All structured customer notices with deadline indicator, work hold, consent and next action.", all: "All", active: "Needs review", closed: "Closed", recovered: "Recovered", noContact: "Do not contact", withdrawal: "Withdrawal right", change: "Change / cancellation", received: "Received", follow: "Follow-up", open: "Open customer case", empty: "No notices in this view.", consent: "One follow-up allowed", noConsent: "No sales follow-up" },
} as const;

function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input; }
function relationId(input: unknown) { return typeof input === "number" ? input : input && typeof input === "object" && "id" in input && typeof (input as { id?: unknown }).id === "number" ? (input as { id: number }).id : 0; }
function relationName(input: unknown) { return input && typeof input === "object" && "name" in input && typeof (input as { name?: unknown }).name === "string" ? (input as { name: string }).name : `#${relationId(input)}`; }

export default async function ContractRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const labels = copy[user.interfaceLanguage];
  const mode = value((await searchParams).status) || "active";
  const where: Where = mode === "active" ? { status: { in: ["received", "admin_review", "alternative_requested", "follow_up_scheduled"] } }
    : mode === "closed" ? { status: { equals: "closed" } }
      : mode === "recovered" ? { status: { equals: "recovered" } }
        : mode === "do_not_contact" ? { status: { equals: "do_not_contact" } }
          : {};
  const result = await (await getPayload()).find({ collection: "customer-contract-requests", depth: 1, limit: 100, sort: "-receivedAt", overrideAccess: true, where });
  const dateLocale = panelDateLocale(user.interfaceLanguage);
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{labels.title}</h1><p className="mt-2 max-w-3xl text-muted-foreground">{labels.intro}</p></header>
    <nav aria-label={labels.title} className="flex flex-wrap gap-2">{[["all", labels.all], ["active", labels.active], ["closed", labels.closed], ["recovered", labels.recovered], ["do_not_contact", labels.noContact]].map(([key, label]) => <Link className={`rounded-xl border px-4 py-2 text-sm font-bold ${mode === key ? "border-accent bg-accent text-black" : "border-white/10 hover:border-accent/40"}`} href={`/admin-v2/contract-requests?status=${key}`} key={key}>{label}</Link>)}</nav>
    {result.docs.length ? <div className="grid gap-3">{result.docs.map((item) => {
      const leadId = relationId(item.lead); const potential = item.recoveryPotential;
      return <article className="grid gap-4 rounded-3xl border border-white/10 bg-background-elevated/75 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(14rem,.8fr)_auto] lg:items-center" key={item.id}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wider text-accent">{item.reference}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${potential === "green" ? "border-emerald-400/40 text-emerald-300" : potential === "red" ? "border-red-400/40 text-red-300" : "border-amber-400/40 text-amber-300"}`}>{potential}</span></div><strong className="mt-2 block truncate text-lg">{relationName(item.lead)}</strong><p className="mt-1 text-sm text-muted-foreground">{item.kind === "withdrawal" ? labels.withdrawal : labels.change} · {item.reasonCode}</p></div>
        <div className="grid gap-2 text-sm"><span className="inline-flex items-center gap-2"><ShieldAlert className="size-4 text-accent" />{item.status}</span><span className="inline-flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4" />{labels.received}: {new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.receivedAt))}</span><span className="text-muted-foreground">{item.followUpConsent ? labels.consent : labels.noConsent}{item.followUpAt ? ` · ${labels.follow}: ${new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(new Date(item.followUpAt))}` : ""}</span></div>
        <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-bold text-black" href={`/admin-v2/cases/${leadId}#contract-request-section`}>{labels.open}<ArrowRight className="size-4" /></Link>
      </article>;
    })}</div> : <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-muted-foreground">{labels.empty}</div>}
  </div>;
}
