"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CaseContractRequest } from "@/lib/admin-v2/case-read-model";
import { formatNorwayDateTime } from "@/lib/norway-time";
import type { PanelLocale } from "@/lib/panel-i18n";

const copy = {
  nb: {
    title: "Angre- eller endringsmelding krever vurdering", withdrawal: "Bruk av angrerett", change: "Endring eller kansellering",
    received: "Mottatt", reason: "Kundens valgte årsak", comment: "Kundens kommentar", consent: "Tillater én løsningsorientert oppfølging", noConsent: "Ingen samtykke til salgsoppfølging", deadline: "Nominell 14-dagersfrist", inside: "Mottatt innen nominell frist", outside: "Mottatt etter nominell frist – må vurderes, ikke avvis automatisk", unknown: "Kan ikke beregnes automatisk", work: "Arbeidsstatus ved mottak", suggestion: "Systemets forslag", basis: "Administrators skriftlige beslutningsgrunnlag", followDate: "Planlagt oppfølging", close: "Bekreft avslutning", continue: "Avklar og fortsett", alternative: "Forbered alternativt tilbud", schedule: "Planlegg oppfølging", doNotContact: "Avslutt – ikke kontakt", processing: "Behandler …", success: "Avgjørelsen er lagret. Kontroller og send kundemeldingen dersom et utkast ble opprettet.", failed: "Avgjørelsen kunne ikke lagres.", confirm: "Bekreft at opplysningene, arbeidet og eventuell betaling er kontrollert før beslutningen lagres.", green: "Grønn", yellow: "Gul", red: "Rød",
  },
  lt: {
    title: "Reikia įvertinti sutarties atsisakymo arba pakeitimo pranešimą", withdrawal: "Naudojamasi atsisakymo teise", change: "Pakeitimas arba atšaukimas",
    received: "Gauta", reason: "Kliento pasirinkta priežastis", comment: "Kliento komentaras", consent: "Leidžia vieną kontaktą sprendimui pasiūlyti", noConsent: "Nėra sutikimo pardavimo kontaktui", deadline: "Nominalus 14 dienų terminas", inside: "Gauta per nominalų terminą", outside: "Gauta po nominalaus termino – būtina įvertinti, neatmesti automatiškai", unknown: "Automatiškai apskaičiuoti negalima", work: "Darbo būsena gavimo metu", suggestion: "Sistemos pasiūlymas", basis: "Administratoriaus rašytinis sprendimo pagrindas", followDate: "Planuojamo kontakto data", close: "Patvirtinti užbaigimą", continue: "Išspręsta – tęsti", alternative: "Paruošti alternatyvų pasiūlymą", schedule: "Suplanuoti kontaktą", doNotContact: "Užbaigti – nebekontaktuoti", processing: "Vykdoma …", success: "Sprendimas išsaugotas. Jei sukurta žinutė, ją patikrinkite ir išsiųskite klientui.", failed: "Sprendimo išsaugoti nepavyko.", confirm: "Patvirtinkite, kad prieš išsaugant sprendimą patikrinote sutartį, darbus ir galimą mokėjimą.", green: "Žalia", yellow: "Geltona", red: "Raudona",
  },
  en: {
    title: "Withdrawal or change notice requires review", withdrawal: "Exercise of withdrawal right", change: "Change or cancellation",
    received: "Received", reason: "Customer-selected reason", comment: "Customer comment", consent: "Allows one solution-oriented follow-up", noConsent: "No consent for sales follow-up", deadline: "Nominal 14-day deadline", inside: "Received within the nominal period", outside: "Received after the nominal period – review, do not reject automatically", unknown: "Cannot be calculated automatically", work: "Work status at receipt", suggestion: "System suggestion", basis: "Administrator's written decision basis", followDate: "Planned follow-up", close: "Confirm closure", continue: "Resolve and continue", alternative: "Prepare alternative quote", schedule: "Schedule follow-up", doNotContact: "Close – do not contact", processing: "Processing …", success: "Decision saved. Review and send the customer message if a draft was created.", failed: "The decision could not be saved.", confirm: "Confirm that the contract, work and any payment have been checked before saving the decision.", green: "Green", yellow: "Yellow", red: "Red",
  },
} as const;

const reasonLabels: Record<string, { nb: string; lt: string; en: string }> = {
  price: { nb: "Prisen passer ikke", lt: "Netinka kaina", en: "Price does not fit" },
  wait: { nb: "Vil vente / ikke nå", lt: "Nori palaukti / ne dabar", en: "Wants to wait / not now" },
  timing: { nb: "Tidspunktet passer ikke", lt: "Netinka laikas", en: "Timing does not fit" },
  other_supplier: { nb: "Valgte annen leverandør", lt: "Pasirinko kitą tiekėją", en: "Chose another supplier" },
  scope: { nb: "Omfanget passer ikke", lt: "Netinka darbų apimtis", en: "Scope does not fit" },
  need_information: { nb: "Trenger mer informasjon", lt: "Reikia daugiau informacijos", en: "Needs more information" },
  personal_financial: { nb: "Personlige / økonomiske årsaker", lt: "Asmeninės / finansinės priežastys", en: "Personal / financial reasons" },
  communication: { nb: "Kommunikasjonen fungerte ikke", lt: "Netenkino komunikacija", en: "Communication did not work" },
  not_needed: { nb: "Ikke lenger nødvendig", lt: "Paslauga nebereikalinga", en: "No longer needed" },
  other: { nb: "Annen årsak", lt: "Kita priežastis", en: "Other reason" },
  prefer_not_to_say: { nb: "Ønsker ikke å oppgi årsak", lt: "Nenori nurodyti priežasties", en: "Prefers not to say" },
};

export function ContractRequestReviewPanel({ locale, request }: { locale: PanelLocale; request: CaseContractRequest }) {
  const labels = copy[locale];
  const router = useRouter();
  const [basis, setBasis] = useState("");
  const [followUpAt, setFollowUpAt] = useState((request.followUpAt || request.preferredFollowUpAt || "").slice(0, 16));
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function decide(decision: "close" | "continue" | "alternative" | "schedule_follow_up" | "do_not_contact") {
    if (busy || basis.trim().length < 10 || (decision === "schedule_follow_up" && !followUpAt)) return;
    if (!window.confirm(labels.confirm)) return;
    setBusy(decision); setNotice("");
    try {
      const response = await fetch(`/api/admin/customer-contract-requests/${request.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: basis, ...(followUpAt ? { followUpAt: new Date(followUpAt).toISOString() } : {}) }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || labels.failed);
      setNotice(labels.success); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : labels.failed); }
    finally { setBusy(null); }
  }

  const potentialLabel = request.recoveryPotential === "green" ? labels.green : request.recoveryPotential === "red" ? labels.red : labels.yellow;
  const dateLocale = locale === "lt" ? "lt-LT" : locale === "en" ? "en-GB" : "nb-NO";
  return <section className="scroll-mt-24 rounded-3xl border border-danger/40 bg-danger/5 p-5 sm:p-6" id="contract-request-section">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{request.kind === "withdrawal" ? labels.withdrawal : labels.change} · {request.reference}</p></div>
      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${request.recoveryPotential === "green" ? "border-emerald-400/40 text-emerald-300" : request.recoveryPotential === "red" ? "border-red-400/40 text-red-300" : "border-amber-400/40 text-amber-300"}`}>{potentialLabel}</span>
    </div>
    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-black/15 p-3"><dt className="text-muted-foreground">{labels.received}</dt><dd className="mt-1 font-semibold">{formatNorwayDateTime(request.receivedAt, dateLocale)}</dd></div>
      <div className="rounded-xl border border-white/10 bg-black/15 p-3"><dt className="text-muted-foreground">{labels.reason}</dt><dd className="mt-1 font-semibold">{reasonLabels[request.reasonCode]?.[locale] || request.reasonCode}</dd></div>
      <div className="rounded-xl border border-white/10 bg-black/15 p-3"><dt className="text-muted-foreground">{labels.deadline}</dt><dd className="mt-1 font-semibold">{request.withinNominalWithdrawalPeriod === true ? labels.inside : request.withinNominalWithdrawalPeriod === false ? labels.outside : labels.unknown}</dd>{request.nominalWithdrawalDeadline ? <p className="mt-1 text-xs text-muted-foreground">{formatNorwayDateTime(request.nominalWithdrawalDeadline, dateLocale)}</p> : null}</div>
      <div className="rounded-xl border border-white/10 bg-black/15 p-3"><dt className="text-muted-foreground">{labels.work}</dt><dd className="mt-1 font-semibold">{request.workStatusAtReceipt || "—"}</dd></div>
    </dl>
    {request.reasonText ? <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-xs font-bold uppercase text-muted-foreground">{labels.comment}</p><p className="mt-2 whitespace-pre-wrap text-sm">{request.reasonText}</p></div> : null}
    <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm"><strong>{request.followUpConsent ? labels.consent : labels.noConsent}</strong>{request.preferredFollowUp ? <p className="mt-1 text-muted-foreground">{request.preferredFollowUp}</p> : null}</div>
    {request.aiSuggestedAction ? <div className="mt-3 rounded-xl border border-accent/25 bg-accent/5 p-3"><p className="text-xs font-bold uppercase text-accent">{labels.suggestion}</p><p className="mt-2 text-sm">{request.aiSuggestedAction}</p></div> : null}
    <label className="mt-5 grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{labels.basis}</span><textarea className="min-h-28 rounded-xl border border-white/10 bg-[#0d1118] p-3" maxLength={2_000} minLength={10} onChange={(event) => setBasis(event.target.value)} value={basis} /></label>
    <label className="mt-4 grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{labels.followDate}</span><input className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" min={new Date().toISOString().slice(0, 16)} onChange={(event) => setFollowUpAt(event.target.value)} type="datetime-local" value={followUpAt} /></label>
    <div className="mt-5 flex flex-wrap gap-3">
      <button className="min-h-12 rounded-xl border border-danger/50 px-4 font-bold text-danger disabled:opacity-50" disabled={Boolean(busy) || basis.trim().length < 10} onClick={() => void decide("close")} type="button">{busy === "close" ? labels.processing : labels.close}</button>
      <button className="min-h-12 rounded-xl bg-accent px-4 font-bold text-accent-foreground disabled:opacity-50" disabled={Boolean(busy) || basis.trim().length < 10} onClick={() => void decide("continue")} type="button">{busy === "continue" ? labels.processing : labels.continue}</button>
      <button className="min-h-12 rounded-xl border border-white/20 px-4 font-bold disabled:opacity-50" disabled={Boolean(busy) || basis.trim().length < 10 || !request.followUpConsent} onClick={() => void decide("alternative")} type="button">{busy === "alternative" ? labels.processing : labels.alternative}</button>
      <button className="min-h-12 rounded-xl border border-white/20 px-4 font-bold disabled:opacity-50" disabled={Boolean(busy) || basis.trim().length < 10 || !followUpAt || !request.followUpConsent} onClick={() => void decide("schedule_follow_up")} type="button">{busy === "schedule_follow_up" ? labels.processing : labels.schedule}</button>
      <button className="min-h-12 rounded-xl border border-white/20 px-4 text-sm font-semibold text-muted-foreground disabled:opacity-50" disabled={Boolean(busy) || basis.trim().length < 10} onClick={() => void decide("do_not_contact")} type="button">{busy === "do_not_contact" ? labels.processing : labels.doNotContact}</button>
    </div>
    {notice ? <p aria-live="polite" className="mt-4 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </section>;
}
