"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

const copy = {
  nb: { title: "Kanselleringsforespørsel krever avgjørelse", help: "Arbeidsstart er frosset. Forespørselen kansellerer ikke avtalen automatisk.", customer: "Kundens melding", reason: "Administrators skriftlige vurdering", cancel: "Godkjenn kansellering", continue: "Avklar og fortsett avtalen", confirmCancel: "Bekreft at du har vurdert avtalegrunnlaget og vil avslutte bestillingen.", confirmContinue: "Bekreft at saken er avklart og avtalen skal fortsette.", processing: "Behandler …", done: "Avgjørelsen er lagret. Kontroller og send kundemeldingen.", failed: "Avgjørelsen kunne ikke lagres." },
  lt: { title: "Reikia priimti sprendimą dėl atšaukimo", help: "Darbų pradžia sustabdyta. Kliento prašymas sutarties automatiškai neatšaukia.", customer: "Kliento žinutė", reason: "Administratoriaus rašytinis sprendimo pagrindas", cancel: "Patvirtinti atšaukimą", continue: "Išspręsta – tęsti sutartį", confirmCancel: "Patvirtinkite, kad įvertinote sutartį ir nusprendėte užsakymą nutraukti.", confirmContinue: "Patvirtinkite, kad situacija išspręsta ir sutartis tęsiama.", processing: "Vykdoma …", done: "Sprendimas išsaugotas. Patikrinkite ir išsiųskite žinutę klientui.", failed: "Sprendimo išsaugoti nepavyko." },
  en: { title: "Cancellation request requires a decision", help: "Work start is frozen. The request does not automatically cancel the agreement.", customer: "Customer message", reason: "Administrator's written decision basis", cancel: "Approve cancellation", continue: "Resolved – continue agreement", confirmCancel: "Confirm that you reviewed the agreement and decided to close the order.", confirmContinue: "Confirm that the matter is resolved and the agreement should continue.", processing: "Processing …", done: "The decision was saved. Review and send the customer message.", failed: "The decision could not be saved." },
} as const;

export function CancellationReviewPanel({ customerMessage, leadId, locale }: { customerMessage?: string; leadId: number; locale: PanelLocale }) {
  const labels = copy[locale];
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"cancel" | "continue" | null>(null);
  const [notice, setNotice] = useState("");

  async function resolve(decision: "cancel" | "continue") {
    if (busy || reason.trim().length < 10) return;
    const confirmed = window.confirm(decision === "cancel" ? labels.confirmCancel : labels.confirmContinue);
    if (!confirmed) return;
    setBusy(decision);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve_cancellation", decision, reason }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || labels.failed);
      setNotice(labels.done);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : labels.failed);
    } finally {
      setBusy(null);
    }
  }

  return <section className="scroll-mt-24 rounded-3xl border border-danger/40 bg-danger/5 p-5 sm:p-6" id="cancellation-review">
    <h2 className="text-xl font-bold">{labels.title}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{labels.help}</p>
    {customerMessage ? <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{labels.customer}</p><p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{customerMessage}</p></div> : null}
    <label className="mt-4 grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{labels.reason}</span><textarea className="min-h-28 rounded-xl border border-white/10 bg-[#0d1118] p-3" maxLength={1_000} minLength={10} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
    <div className="mt-4 flex flex-wrap gap-3"><button className="min-h-12 rounded-xl border border-danger/50 px-5 font-bold text-danger hover:bg-danger/10 disabled:opacity-50" disabled={Boolean(busy) || reason.trim().length < 10} onClick={() => void resolve("cancel")} type="button">{busy === "cancel" ? labels.processing : labels.cancel}</button><button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-50" disabled={Boolean(busy) || reason.trim().length < 10} onClick={() => void resolve("continue")} type="button">{busy === "continue" ? labels.processing : labels.continue}</button></div>
    {notice ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </section>;
}
