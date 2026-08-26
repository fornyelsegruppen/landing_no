"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import { archiveClassifications, type ArchiveClassification, type CaseRecordState } from "@/lib/leads/case-lifecycle";
import type { PanelLocale } from "@/lib/panel-i18n";

export function CaseLifecyclePanel({ classification, leadId, locale, purgeAfter, recordState }: { classification?: string; leadId: number; locale: PanelLocale; purgeAfter?: string; recordState: CaseRecordState }) {
  const copy = getAdminCaseCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [selectedClassification, setSelectedClassification] = useState<ArchiveClassification>((archiveClassifications.includes(classification as ArchiveClassification) ? classification : "other") as ArchiveClassification);
  const [confirmation, setConfirmation] = useState("");

  async function run(action: "archive" | "purge" | "restore" | "trash") {
    if (busy) return;
    if (!window.confirm(action === "purge" ? copy.purgeConfirm : copy.lifecycleConfirm)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, classification: selectedClassification, confirmation, reason }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setNotice(copy.lifecycleSaved);
      if (action === "purge") router.replace("/admin-v2/archive?state=trashed");
      else router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  const stateLabel = recordState === "archived" ? copy.lifecycleArchived : recordState === "trashed" ? copy.lifecycleTrashed : copy.lifecycleActive;
  return (
    <section aria-labelledby="case-lifecycle-title" className="rounded-3xl border border-white/10 bg-background-elevated/75 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold" id="case-lifecycle-title">{copy.lifecycle}</h2>
        <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">{stateLabel}</span>
      </div>
      {purgeAfter ? <p className="mt-3 text-sm text-muted-foreground">{copy.purgeAfter}: {new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : locale === "en" ? "en-GB" : "nb-NO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Oslo" }).format(new Date(purgeAfter))}</p> : null}
      <div className="mt-5 grid gap-3">
        {recordState === "active" ? <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.archiveClassification}</span><select className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3" onChange={(event) => setSelectedClassification(event.target.value as ArchiveClassification)} value={selectedClassification}>{archiveClassifications.map((value) => <option key={value} value={value}>{copy.archiveClasses[value]}</option>)}</select></label> : null}
        <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.lifecycleReason}</span><textarea className="min-h-24 rounded-xl border border-white/10 bg-black/15 p-3" maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={copy.lifecycleReasonPlaceholder} value={reason} /></label>
        <div className="flex flex-wrap gap-3">
          {recordState === "active" ? <button className="min-h-11 rounded-xl border border-accent/45 px-4 font-bold text-accent hover:bg-accent/10 disabled:opacity-50" disabled={busy || reason.trim().length < 5} onClick={() => void run("archive")} type="button">{copy.archiveCase}</button> : null}
          {recordState !== "trashed" ? <button className="min-h-11 rounded-xl border border-danger/40 px-4 font-bold text-danger hover:bg-danger/10 disabled:opacity-50" disabled={busy || reason.trim().length < 5} onClick={() => void run("trash")} type="button">{copy.trashCase}</button> : null}
          {recordState !== "active" ? <button className="min-h-11 rounded-xl border border-white/15 px-4 font-bold hover:border-accent/50 disabled:opacity-50" disabled={busy || reason.trim().length < 5} onClick={() => void run("restore")} type="button">{copy.restoreCase}</button> : null}
        </div>
        {recordState === "trashed" ? <details className="mt-2 rounded-2xl border border-danger/25 p-4"><summary className="cursor-pointer font-bold text-danger">{copy.purgeCase}</summary><label className="mt-4 grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.purgeConfirmation}</span><input className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3" inputMode="numeric" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></label><button className="mt-3 min-h-11 rounded-xl bg-danger px-4 font-bold text-white disabled:opacity-50" disabled={busy || confirmation !== String(leadId) || reason.trim().length < 5} onClick={() => void run("purge")} type="button">{copy.purgeCase}</button></details> : null}
        {notice ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{notice}</p> : null}
      </div>
    </section>
  );
}
