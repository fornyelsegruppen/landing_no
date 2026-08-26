"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

type Props = {
  actualAreaTenths?: number;
  actualTotalIncVatOre?: number;
  afterPhotoCount: number;
  beforePhotoCount: number;
  completionNotes?: string;
  locale: PanelLocale;
  workOrderId: number;
  workSummary: string;
};

export function CompletionReviewPanel(props: Props) {
  const copy = getAdminCaseCopy(props.locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const numberLocale = props.locale === "lt" ? "lt-LT" : props.locale === "en" ? "en-GB" : "nb-NO";
  const money = typeof props.actualTotalIncVatOre === "number"
    ? new Intl.NumberFormat(numberLocale, { style: "currency", currency: "NOK" }).format(props.actualTotalIncVatOre / 100)
    : "—";

  async function submit(formData: FormData) {
    if (busy || !window.confirm(copy.completionConfirm)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/work-orders/${props.workOrderId}/complete-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmDocumentation: formData.get("confirmDocumentation") === "on",
          confirmPrice: formData.get("confirmPrice") === "on",
          invoiceDueDays: Number(formData.get("invoiceDueDays")),
          reviewNote: formData.get("reviewNote"),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setNotice(copy.completionDone);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={(data) => void submit(data)} className="mt-5 grid gap-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div>
        <h3 className="font-bold text-accent">{copy.completionReview}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{copy.completionReviewHelp}</p>
      </div>
      <dl className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">{copy.beforePhotos}</dt><dd className="font-bold">{props.beforePhotoCount}</dd></div>
        <div><dt className="text-muted-foreground">{copy.afterPhotos}</dt><dd className="font-bold">{props.afterPhotoCount}</dd></div>
        <div><dt className="text-muted-foreground">{copy.finalArea}</dt><dd className="font-bold">{typeof props.actualAreaTenths === "number" ? `${(props.actualAreaTenths / 10).toLocaleString(numberLocale)} m²` : "—"}</dd></div>
        <div><dt className="text-muted-foreground">{copy.finalTotal}</dt><dd className="font-bold text-accent">{money}</dd></div>
      </dl>
      {props.completionNotes ? <div className="rounded-xl border border-white/10 p-3"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.workerCompletionNote}</p><p className="mt-2 whitespace-pre-wrap text-sm">{props.completionNotes}</p></div> : null}
      <label className="grid gap-1.5 text-sm font-semibold">{copy.reviewNote}<textarea className="min-h-24 rounded-xl border border-white/10 bg-background p-3" minLength={10} name="reviewNote" required /></label>
      <label className="grid gap-1.5 text-sm font-semibold">{copy.invoiceDueDays}<select className="min-h-12 rounded-xl border border-white/10 bg-background px-3" defaultValue="14" name="invoiceDueDays"><option value="7">7</option><option value="10">10</option><option value="14">14</option><option value="30">30</option></select></label>
      <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-muted-foreground">{copy.completionCertificateNotice}</p>
      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm"><input className="mt-1 size-4 accent-[var(--color-accent)]" name="confirmDocumentation" required type="checkbox" /><span>{copy.confirmDocumentation}</span></label>
      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm"><input className="mt-1 size-4 accent-[var(--color-accent)]" name="confirmPrice" required type="checkbox" /><span>{copy.confirmFinalPrice}</span></label>
      <p className="text-xs text-muted-foreground">{copy.invoiceDraftNotice}</p>
      <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60" disabled={busy} type="submit">{busy ? copy.processing : copy.completeReview}</button>
      {notice ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{notice}</p> : null}
    </form>
  );
}
