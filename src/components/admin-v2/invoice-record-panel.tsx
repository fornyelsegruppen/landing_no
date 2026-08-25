"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import { statusLabel } from "@/lib/admin-v2/labels";
import type { PanelLocale } from "@/lib/panel-i18n";

const transitions: Record<string, string[]> = { draft: ["draft", "approved", "cancelled"], approved: ["approved", "exported", "cancelled"], exported: ["exported", "sent", "paid", "cancelled"], sent: ["sent", "paid", "overdue", "cancelled"], overdue: ["overdue", "paid", "cancelled"], paid: ["paid"], cancelled: ["cancelled"] };

export function InvoiceRecordPanel({ adminNote, externalReference, id, locale, status }: { adminNote?: string; externalReference?: string; id: number; locale: PanelLocale; status: string }) {
  const copy = getAdminCaseCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save(form: FormData) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/invoice-records/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: form.get("status"), externalReference: form.get("externalReference"), adminNote: form.get("adminNote") }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setNotice(copy.invoiceSaved);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  return <details className="mt-3 border-t border-white/10 pt-3"><summary className="cursor-pointer text-sm font-semibold text-accent">{copy.invoiceControl}</summary><form action={(data) => void save(data)} className="mt-3 grid gap-3">
    <label className="grid gap-1 text-xs font-semibold">{copy.status}<select className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={status} name="status">{(transitions[status] || [status]).map((value) => <option key={value} value={value}>{statusLabel(locale, value)}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-semibold">{copy.accountingReference}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={externalReference} name="externalReference" /></label>
    <label className="grid gap-1 text-xs font-semibold">{copy.adminNote}<textarea className="min-h-20 rounded-xl border border-white/10 bg-background p-3 text-sm" defaultValue={adminNote} name="adminNote" /></label>
    <button className="min-h-11 rounded-xl border border-accent/50 px-3 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-60" disabled={busy} type="submit">{busy ? copy.processing : copy.saveInvoice}</button>
    {notice ? <p className="text-xs text-muted-foreground" role="status">{notice}</p> : null}
  </form></details>;
}
