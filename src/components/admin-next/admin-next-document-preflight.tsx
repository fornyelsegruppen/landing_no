import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  FileCheck2,
  FileSignature,
  FileText,
  Fingerprint,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  Ruler,
  Send,
  ShieldAlert,
  UserCheck,
  X,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type { AdminNextCaseWorkspaceView } from "@/lib/admin-next/case-workspace-contract";

type Preflight = NonNullable<AdminNextCaseWorkspaceView["documentPreflight"]>;
type Artifact = Preflight["artifacts"][number];

const copy = {
  nb: {
    close: "Lukk preflight", eyebrow: "Dokumentpakke · preflight", synthetic: "Syntetiske Preview-data", title: "Pakken kan ikke sendes ennå", intro: "Exact artefaktidentitet og action-time owner gate", blocker: "Blokkering", recipient: "Mottaker", readiness: "Readiness og exact identitet", verified: "Bekreftet", review_required: "Må kontrolleres", locked: "Låst", revision: "Revisjon", hash: "Hash", sequence: "PS-SEND-007 sikker rekkefølge", current: "Nå", next: "Neste handling", openMeasurement: "Åpne exact R4-r07", send: "Send pakke", sendDisabled: "Send er fail-closed til measurement review, reload, exact artifact verification og ny owner gate er fullført.", artifacts: { measurement: "Measurement", price: "Pris", quote: "Tilbud", contract: "Kontrakt", recipient: "Mottaker", pdf: "PDF-pakke" }, steps: { measurement_review: "Exact measurement review", reload: "Reload", verify_artifacts: "Exact revision/hash", owner_gate: "Ny owner gate", send: "Send" },
  },
  lt: {
    close: "Uždaryti preflight", eyebrow: "Dokumentų paketas · preflight", synthetic: "Sintetiniai Preview duomenys", title: "Paketo dar negalima siųsti", intro: "Exact artefaktų tapatybė ir action-time owner gate", blocker: "Blokavimas", recipient: "Gavėjas", readiness: "Parengtis ir exact tapatybė", verified: "Patvirtinta", review_required: "Reikia peržiūros", locked: "Užrakinta", revision: "Revizija", hash: "Hash", sequence: "PS-SEND-007 saugi seka", current: "Dabar", next: "Kitas veiksmas", openMeasurement: "Atidaryti exact R4-r07", send: "Siųsti paketą", sendDisabled: "Send yra fail-closed, kol nebaigta matavimo peržiūra, reload, exact artefaktų patikra ir naujas owner gate.", artifacts: { measurement: "Matavimas", price: "Kaina", quote: "Pasiūlymas", contract: "Sutartis", recipient: "Gavėjas", pdf: "PDF paketas" }, steps: { measurement_review: "Exact matavimo peržiūra", reload: "Reload", verify_artifacts: "Exact revision/hash", owner_gate: "Naujas owner gate", send: "Send" },
  },
  en: {
    close: "Close preflight", eyebrow: "Document package · preflight", synthetic: "Synthetic Preview data", title: "The package cannot be sent yet", intro: "Exact artifact identity and action-time owner gate", blocker: "Blocker", recipient: "Recipient", readiness: "Readiness and exact identity", verified: "Verified", review_required: "Needs review", locked: "Locked", revision: "Revision", hash: "Hash", sequence: "PS-SEND-007 safe sequence", current: "Now", next: "Next action", openMeasurement: "Open exact R4-r07", send: "Send package", sendDisabled: "Send is fail-closed until measurement review, reload, exact artifact verification and a new owner gate complete.", artifacts: { measurement: "Measurement", price: "Price", quote: "Quote", contract: "Contract", recipient: "Recipient", pdf: "PDF package" }, steps: { measurement_review: "Exact measurement review", reload: "Reload", verify_artifacts: "Exact revision/hash", owner_gate: "New owner gate", send: "Send" },
  },
} as const;

const icons: Record<Artifact["id"], typeof Ruler> = { measurement: Ruler, price: BadgeDollarSign, quote: FileText, contract: FileSignature, recipient: MailCheck, pdf: FileCheck2 };
const sequenceIcons = { measurement_review: Ruler, reload: RefreshCw, verify_artifacts: Fingerprint, owner_gate: UserCheck, send: Send } as const;
const tones: Record<Artifact["state"], string> = { verified: "an-success", review_required: "an-danger", locked: "an-disabled" };

export function AdminNextDocumentPreflight({ caseReference, customer, locale, measurementFallbackHref, preflight }: { caseReference: string; customer: string; locale: PanelLocale; measurementFallbackHref: string; preflight: Preflight }) {
  const t = copy[locale];
  const caseHref = `/admin-next-preview/cases/${encodeURIComponent(caseReference)}`;

  return (
    <div className="relative min-h-[calc(100dvh-8rem)]" data-admin-next-section="cases">
      <div aria-hidden="true" className="an-surface min-h-[900px] rounded-3xl border p-6 opacity-50 lg:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--an-amber)]">{caseReference}</p><h2 className="mt-3 text-3xl font-bold">{customer}</h2><p className="mt-2 text-[var(--an-muted)]">Case Workspace · Dokumentai · {preflight.packageReference}</p><div className="mt-8 grid max-w-4xl grid-cols-3 gap-3">{["R4 review required", "Quote R12", "Contract draft R03"].map((x) => <div className="an-elevated rounded-2xl border p-5 text-sm text-[var(--an-muted)]" key={x}>{x}</div>)}</div></div>
      <div aria-hidden="true" className="fixed inset-x-0 bottom-[4.5rem] top-16 z-40 bg-black/70 backdrop-blur-[3px] lg:bottom-0 lg:left-64" />

      <section aria-labelledby="preflight-modal-title" aria-modal="true" className="fixed bottom-[4.5rem] left-0 right-0 top-16 z-50 flex flex-col overflow-hidden border border-[var(--an-border-strong)] bg-[var(--an-surface)] shadow-[0_30px_100px_rgba(0,0,0,.6)] lg:bottom-8 lg:left-[calc(50%+8rem)] lg:right-auto lg:top-24 lg:w-[980px] lg:-translate-x-1/2 lg:rounded-3xl" role="dialog">
        <header className="shrink-0 border-b border-[var(--an-border)] bg-[var(--an-sidebar)] px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <Link aria-label={t.close} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-muted)] hover:text-[var(--an-amber)]" href={caseHref}><X aria-hidden="true" className="size-5" /></Link>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--an-amber)]">{t.eyebrow}</p><span className="rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-2 py-1 text-[10px] font-bold text-[var(--an-amber)]">{t.synthetic}</span></div><h1 className="mt-2 text-xl font-bold sm:text-2xl" id="preflight-modal-title">{t.title}</h1><p className="mt-1 text-sm text-[var(--an-muted)]">{preflight.packageReference} · {t.intro}</p></div>
            <div className="hidden text-right sm:block"><span className="text-[10px] font-bold uppercase text-[var(--an-muted)]">{t.recipient}</span><strong className="mt-1 block text-xs">{preflight.recipient.name}</strong><span className="mt-1 block text-[10px] text-[var(--an-subtle)]">{preflight.recipient.email}</span></div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <section className="an-danger rounded-2xl border p-4" aria-labelledby="preflight-blocker-dark"><div className="flex items-start gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0"/><div><p className="text-[10px] font-black uppercase tracking-[.16em]">{preflight.policyCode} · {t.blocker}</p><h2 className="mt-2 text-sm font-bold" id="preflight-blocker-dark">{preflight.blocker}</h2></div></div></section>

          <section className="mt-4" aria-labelledby="preflight-readiness-dark"><div className="flex items-center justify-between"><h2 className="font-bold" id="preflight-readiness-dark">{t.readiness}</h2><span className="text-[10px] font-bold text-[var(--an-muted)]">1 / 6 {t.verified.toLowerCase()}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{preflight.artifacts.map((artifact) => { const Icon = icons[artifact.id]; return <article className="an-elevated rounded-2xl border p-3" key={artifact.id}><div className="flex items-start justify-between"><span className="grid size-8 place-items-center rounded-lg bg-[var(--an-soft)] text-[var(--an-amber)]"><Icon aria-hidden="true" className="size-4"/></span><span className={`${tones[artifact.state]} rounded-full border px-2 py-1 text-[9px] font-bold`}>{t[artifact.state]}</span></div><h3 className="mt-3 text-sm font-bold">{t.artifacts[artifact.id]}</h3><p className="mt-1 text-[10px] font-bold text-[var(--an-amber)]">{artifact.reference}</p><p className="mt-2 line-clamp-2 min-h-8 text-[10px] leading-4 text-[var(--an-muted)]">{artifact.summary}</p><dl className="mt-3 grid gap-1 border-t border-[var(--an-border)] pt-2 text-[9px]"><div className="flex justify-between gap-2"><dt className="text-[var(--an-subtle)]">{t.revision}</dt><dd>{artifact.revision}</dd></div><div className="flex justify-between gap-2"><dt className="text-[var(--an-subtle)]">{t.hash}</dt><dd className="truncate">{artifact.hash}</dd></div></dl></article>; })}</div></section>

          <section className="an-elevated mt-4 rounded-2xl border p-4" aria-labelledby="preflight-sequence-dark"><h2 className="font-bold" id="preflight-sequence-dark">{t.sequence}</h2><ol className="mt-3 grid gap-2 sm:grid-cols-5">{preflight.sequence.map((step,index) => { const Icon = sequenceIcons[step.id]; return <li className={`rounded-xl border p-3 ${step.state === "current" ? "border-[color:rgba(244,182,63,.45)] bg-[var(--an-amber-soft)]" : "border-[var(--an-border)] bg-[var(--an-soft)]"}`} key={step.id}><div className="flex items-center justify-between"><Icon aria-hidden="true" className={`size-4 ${step.state === "current" ? "text-[var(--an-amber)]" : "text-[var(--an-subtle)]"}`}/><span className="text-[9px] font-black text-[var(--an-subtle)]">0{index+1}</span></div><strong className="mt-2 block text-[10px]">{t.steps[step.id]}</strong><span className={`mt-1 block text-[9px] ${step.state === "current" ? "text-[var(--an-amber)]" : "text-[var(--an-subtle)]"}`}>{step.state === "current" ? t.current : t.locked}</span></li>; })}</ol></section>
        </div>

        <footer className="shrink-0 border-t border-[var(--an-border)] bg-[var(--an-sidebar)] p-3 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--an-amber)]">{t.next}</p><p className="mt-1 truncate text-xs text-[var(--an-muted)]">{preflight.nextAction}</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-elevated)] px-3 text-xs font-bold hover:border-[var(--an-amber)]" href={measurementFallbackHref}>{t.openMeasurement}<ArrowRight aria-hidden="true" className="size-4"/></Link><button aria-describedby="preflight-send-dark-disabled" className="an-cta inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl px-4 text-xs font-black opacity-55" disabled type="button"><LockKeyhole aria-hidden="true" className="size-4"/>{t.send}</button></div></div><p className="mt-2 text-right text-[9px] text-[var(--an-subtle)]" id="preflight-send-dark-disabled">{t.sendDisabled}</p></footer>
      </section>
    </div>
  );
}
