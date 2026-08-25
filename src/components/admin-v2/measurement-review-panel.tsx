"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

export function MeasurementReviewPanel(props: {
  canApprovePackage: boolean;
  currentAreaTenths: number;
  leadId: number;
  locale: PanelLocale;
  manualOverrideReason?: string;
  measurementId: number;
}) {
  const copy = getAdminCaseCopy(props.locale);
  const router = useRouter();
  const [busy, setBusy] = useState<"override" | "approve" | null>(null);
  const [notice, setNotice] = useState("");

  async function overrideArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const areaSquareMeters = Number(form.get("areaSquareMeters"));
    const reason = String(form.get("reason") || "").trim();
    if (!Number.isFinite(areaSquareMeters) || areaSquareMeters < 10 || areaSquareMeters > 5000 || reason.length < 5) {
      setNotice(copy.actionFailed);
      return;
    }
    if (!window.confirm(copy.recalculateConfirm)) return;
    setBusy("override");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/measurements/${props.measurementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "override_area", areaSquareMeters, reason }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setNotice(copy.manualOverrideSaved);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend() {
    if (busy || !window.confirm(copy.confirmEconomicAction)) return;
    setBusy("approve");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/leads/${props.leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_package" }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setNotice(copy.actionDone);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
      <h3 className="font-bold">{copy.manualArea}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.manualAreaHelp}</p>
      <form className="mt-4 grid gap-4" onSubmit={overrideArea}>
        <div className="grid gap-4 sm:grid-cols-[minmax(10rem,.4fr)_minmax(0,1fr)]">
          <label className="grid gap-2 text-sm font-semibold">
            {copy.manualArea}
            <input
              className="min-h-12 rounded-xl border border-white/15 bg-background px-4 text-base"
              defaultValue={(props.currentAreaTenths / 10).toFixed(1)}
              inputMode="decimal"
              max="5000"
              min="10"
              name="areaSquareMeters"
              required
              step="0.1"
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            {copy.overrideReason}
            <input
              className="min-h-12 rounded-xl border border-white/15 bg-background px-4 text-base"
              defaultValue={props.manualOverrideReason || ""}
              maxLength={500}
              minLength={5}
              name="reason"
              placeholder={copy.overrideReasonPlaceholder}
              required
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="min-h-12 rounded-xl border border-accent/50 px-5 font-bold text-accent transition hover:bg-accent/10 disabled:opacity-50" disabled={Boolean(busy)} type="submit">
            {busy === "override" ? copy.processing : copy.recalculatePackage}
          </button>
          {props.canApprovePackage ? (
            <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground shadow-lg shadow-accent/10 transition hover:bg-accent-hover disabled:opacity-50" disabled={Boolean(busy)} onClick={() => void approveAndSend()} type="button">
              {busy === "approve" ? copy.processing : copy.reviewAndSend}
            </button>
          ) : null}
        </div>
      </form>
      {notice ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
    </div>
  );
}
