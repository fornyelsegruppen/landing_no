"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CaseChangeAgreement } from "@/lib/admin-v2/case-read-model";
import type { PanelLocale } from "@/lib/panel-i18n";

type Props = {
  actualAreaTenths?: number;
  actualTotalIncVatOre?: number;
  blockingReasons: string[];
  changes: CaseChangeAgreement[];
  locale: PanelLocale;
  priceOutcome?: string;
  scopeChangeDetails?: string;
  workOrderId: number;
};

const labels = {
  nb: {
    title: "Skriftlig endringsavtale", blocked: "Arbeidet er satt på pause", reason: "Årsak og forklaring til kunden",
    amount: "Ny totalpris inkl. mva.", create: "Opprett utkast", approve: "Godkjenn utkast", issue: "Send til kunden",
    revoke: "Tilbakekall", preview: "Forhåndsvis PDF", before: "Før", after: "Etter kontroll", area: "Takareal",
    total: "Totalpris", valid: "Gyldig til", processing: "Behandler …", done: "Utført.", failed: "Handlingen kunne ikke utføres.",
    noChange: "Kontrollen krever ingen skriftlig prisendring.", waiting: "Venter på kundens svar.", accepted: "Kunden har akseptert. Arbeidet kan fortsette.",
    declined: "Kunden har avslått. Administrator må følge opp før saken avsluttes.", expired: "Avtalen er ikke lenger gyldig.",
  },
  lt: {
    title: "Rašytinis pakeitimo susitarimas", blocked: "Darbas sustabdytas", reason: "Priežastis ir paaiškinimas klientui",
    amount: "Nauja visa kaina su PVM", create: "Sukurti juodraštį", approve: "Patvirtinti juodraštį", issue: "Siųsti klientui",
    revoke: "Atšaukti", preview: "Peržiūrėti PDF", before: "Prieš", after: "Po patikros", area: "Stogo plotas",
    total: "Visa kaina", valid: "Galioja iki", processing: "Vykdoma …", done: "Atlikta.", failed: "Veiksmo atlikti nepavyko.",
    noChange: "Patikra nereikalauja rašytinio kainos pakeitimo.", waiting: "Laukiama kliento atsakymo.", accepted: "Klientas sutiko. Darbą galima tęsti.",
    declined: "Klientas atmetė. Administratorius turi susisiekti prieš uždarydamas bylą.", expired: "Susitarimas nebegalioja.",
  },
  en: {
    title: "Written change agreement", blocked: "Work is paused", reason: "Reason and customer explanation",
    amount: "New total including VAT", create: "Create draft", approve: "Approve draft", issue: "Send to customer",
    revoke: "Revoke", preview: "Preview PDF", before: "Before", after: "After inspection", area: "Roof area",
    total: "Total price", valid: "Valid until", processing: "Processing …", done: "Done.", failed: "The action could not be completed.",
    noChange: "The inspection does not require a written price change.", waiting: "Waiting for the customer.", accepted: "Customer accepted. Work may continue.",
    declined: "Customer declined. An administrator must follow up before closing the case.", expired: "The agreement has expired.",
  },
} as const;

const money = (ore: number | undefined, locale: PanelLocale) => typeof ore === "number"
  ? new Intl.NumberFormat(locale === "lt" ? "lt-LT" : locale === "en" ? "en-GB" : "nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(ore / 100)
  : "—";
const area = (tenths: number | undefined, locale: PanelLocale) => typeof tenths === "number"
  ? `${(tenths / 10).toLocaleString(locale === "lt" ? "lt-LT" : locale === "en" ? "en-GB" : "nb-NO")} m²`
  : "—";

export function ChangeAgreementPanel(props: Props) {
  const copy = labels[props.locale];
  const router = useRouter();
  const active = useMemo(() => props.changes.find((item) => !["superseded", "revoked"].includes(item.status || "")) || props.changes[0], [props.changes]);
  const [reason, setReason] = useState(props.scopeChangeDetails || props.blockingReasons.join(" "));
  const [total, setTotal] = useState(props.actualTotalIncVatOre ? String(props.actualTotalIncVatOre / 100) : "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const eligible = ["over_tolerance", "over_maximum", "scope_change"].includes(props.priceOutcome || "");

  async function perform(endpoint: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.failed);
      setNotice(copy.done); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); }
    finally { setBusy(false); }
  }

  const statusCopy = active?.status === "accepted" ? copy.accepted
    : active?.status === "declined" ? copy.declined
      : active?.status === "expired" ? copy.expired
        : ["sent", "viewed"].includes(active?.status || "") ? copy.waiting : null;

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4" id="change-agreement-workbench">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-accent">{copy.blocked}</p><h3 className="mt-1 font-bold">{copy.title}</h3></div>
        {active ? <span className="rounded-full border border-accent/30 px-2.5 py-1 text-xs font-bold uppercase text-accent">{active.status}</span> : null}
      </div>
      {props.blockingReasons.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/80">{props.blockingReasons.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {active ? <>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-muted-foreground">{copy.before}</dt><dd className="mt-1 font-bold">{copy.area}: {area(active.beforeAreaTenths, props.locale)}</dd><dd className="text-sm">{copy.total}: {money(active.beforeTotalIncVatOre, props.locale)}</dd></div>
          <div className="rounded-xl border border-accent/30 p-3"><dt className="text-xs text-muted-foreground">{copy.after}</dt><dd className="mt-1 font-bold">{copy.area}: {area(active.afterAreaTenths, props.locale)}</dd><dd className="text-sm">{copy.total}: {money(active.afterTotalIncVatOre, props.locale)}</dd></div>
        </dl>
        {active.validUntil ? <p className="mt-3 text-xs text-muted-foreground">{copy.valid}: {new Date(active.validUntil).toLocaleString()}</p> : null}
        {statusCopy ? <p className="mt-4 rounded-xl border border-white/10 p-3 text-sm font-semibold">{statusCopy}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold hover:border-accent/50" href={`/api/admin/change-agreements/${active.id}/pdf`} target="_blank">{copy.preview}<ExternalLink className="size-4" /></a>
          {active.status === "draft" ? <button className="min-h-11 rounded-xl bg-accent px-4 font-bold text-accent-foreground disabled:opacity-50" disabled={busy} onClick={() => perform(`/api/admin/change-agreements/${active.id}`, { action: "approve" })}>{copy.approve}</button> : null}
          {active.status === "approved" ? <button className="min-h-11 rounded-xl bg-accent px-4 font-bold text-accent-foreground disabled:opacity-50" disabled={busy} onClick={() => perform(`/api/admin/change-agreements/${active.id}`, { action: "issue" })}>{copy.issue}</button> : null}
          {["draft", "approved", "sent", "viewed"].includes(active.status || "") ? <button className="min-h-11 rounded-xl border border-red-400/40 px-4 font-bold text-red-300 disabled:opacity-50" disabled={busy} onClick={() => perform(`/api/admin/change-agreements/${active.id}`, { action: "revoke" })}>{copy.revoke}</button> : null}
        </div>
      </> : eligible ? <div className="mt-4 grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold">{copy.reason}<textarea className="min-h-24 rounded-xl border border-white/15 bg-[#0d1118] p-3" maxLength={2000} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
        {props.priceOutcome === "scope_change" ? <label className="grid gap-1.5 text-sm font-semibold">{copy.amount}<input className="min-h-12 rounded-xl border border-white/15 bg-[#0d1118] px-3" inputMode="decimal" min="1" onChange={(event) => setTotal(event.target.value)} type="number" value={total} /></label> : null}
        <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-50" disabled={busy || reason.trim().length < 5} onClick={() => perform("/api/admin/change-agreements", { workOrderId: props.workOrderId, reasonDescription: reason.trim(), ...(props.priceOutcome === "scope_change" ? { proposedTotalIncVatOre: Math.round(Number(total.replace(",", ".")) * 100) } : {}) })}>{busy ? copy.processing : copy.create}</button>
      </div> : <p className="mt-3 text-sm text-muted-foreground">{copy.noChange}</p>}
      {notice ? <p className="mt-3 text-sm" role="status">{notice}</p> : null}
    </div>
  );
}
