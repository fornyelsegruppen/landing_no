"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";
import { interpretAdminActionResult, type AdminActionFeedback, type AdminActionResponse } from "@/lib/admin-v2/action-result";
import {
  arrivalWindowFromTimes,
  defaultArrivalEndTime,
  normalizeArrivalStartTime,
  parseArrivalWindow,
} from "@/lib/work-orders/scheduling";

type Worker = { id: number; name: string; phone?: string };

const timeOptions = Array.from({ length: 35 }, (_, index) => {
  const minutes = 6 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export function WorkOrderPlanningPanel(props: {
  adminNote?: string;
  arrivalWindow?: string;
  assignedWorkerId?: number;
  contractId: number;
  contractDocumentHash?: string;
  contractReference?: string;
  contractVersion?: number;
  locale: PanelLocale;
  scheduledLocal?: string;
  status?: string;
  workOrderId?: number;
  workers: Worker[];
}) {
  const copy = getAdminCaseCopy(props.locale);
  const router = useRouter();
  const initialWindow = parseArrivalWindow(props.arrivalWindow);
  const initialScheduledDate = props.scheduledLocal?.slice(0, 10) || "";
  const initialScheduledTime = props.scheduledLocal?.slice(11, 16) || "";
  const initialArrivalStart = initialWindow?.start || normalizeArrivalStartTime(initialScheduledTime);
  const initialArrivalEnd = initialWindow?.end || defaultArrivalEndTime(initialArrivalStart);
  const [workerId, setWorkerId] = useState(props.assignedWorkerId ? String(props.assignedWorkerId) : "");
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [arrivalStart, setArrivalStart] = useState(initialArrivalStart);
  const [arrivalEnd, setArrivalEnd] = useState(initialArrivalEnd);
  const [adminNote, setAdminNote] = useState(props.adminNote || "");
  const [planningReason, setPlanningReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AdminActionFeedback | null>(null);
  const creating = !props.workOrderId;

  async function save() {
    if (busy) return;
    if (!workerId || !scheduledDate || !arrivalStart || !arrivalEnd) {
      setFeedback({ kind: "error", message: copy.completePlanningRequired, refresh: false });
      return;
    }
    let arrivalWindow: string;
    try {
      arrivalWindow = arrivalWindowFromTimes(arrivalStart, arrivalEnd);
    } catch {
      setFeedback({ kind: "error", message: copy.arrivalEndAfterStart, refresh: false });
      return;
    }
    const scheduledLocal = `${scheduledDate}T${arrivalStart}`;
    if (creating && !window.confirm(`${copy.confirmEconomicAction}\n\n${copy.createAndPlan}${props.contractReference ? ` ${props.contractReference}` : ""}`)) return;
    setBusy(true);
    setFeedback(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(creating ? "/api/admin/work-orders" : `/api/admin/work-orders/${props.workOrderId}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          adminNote,
          planningReason,
          arrivalWindow,
          ...(workerId ? { assignedWorkerId: Number(workerId) } : {}),
          contractId: props.contractId,
          expectedDocumentHash: props.contractDocumentHash,
          expectedVersion: props.contractVersion,
          ...(creating ? scheduledLocal ? { scheduledLocal } : {} : { scheduledLocal }),
        }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({})) as AdminActionResponse;
      const nextFeedback = interpretAdminActionResult({ fallbackError: copy.actionFailed, ok: response.ok, queuedMessage: copy.planningSavedNotificationQueued, reference: props.contractReference, result, staleMessage: copy.staleAction, successMessage: result.notification === "sent" ? copy.planningSavedAndNotified : copy.actionDone });
      setFeedback(nextFeedback);
      if (nextFeedback.refresh) router.refresh();
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof DOMException && error.name === "AbortError" ? copy.networkTimeout : error instanceof Error ? error.message : copy.actionFailed, refresh: false });
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  async function cancel() {
    if (!props.workOrderId || busy || !window.confirm(copy.cancelWorkConfirm)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/work-orders/${props.workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setFeedback({ kind: "success", message: copy.actionDone, refresh: true });
      router.refresh();
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : copy.actionFailed, refresh: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4" id="work-planning">
      <h3 className="font-bold">{copy.workPlanning}</h3>
      {props.contractReference ? <p className="text-accent mt-1 text-sm font-bold">{props.contractReference}</p> : null}
      <div className="mt-4 grid min-w-0 gap-4">
        <label className="grid min-w-0 gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.chooseEmployee}</span><select className="min-h-12 min-w-0 w-full rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} onChange={(event) => setWorkerId(event.target.value)} required value={workerId}><option value="">{copy.noEmployee}</option>{props.workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}{worker.phone ? ` · ${worker.phone}` : ""}</option>)}</select></label>
        <label className="grid min-w-0 gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.workDate}</span><input className="min-h-12 min-w-0 w-full rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setScheduledDate(event.target.value)} required type="date" value={scheduledDate} /></label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.arrivalFrom}</span><select className="min-h-12 min-w-0 w-full rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} onChange={(event) => { const nextStart = event.target.value; setArrivalStart(nextStart); if (arrivalEnd <= nextStart) setArrivalEnd(defaultArrivalEndTime(nextStart)); }} required value={arrivalStart}>{timeOptions.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
          <label className="grid min-w-0 gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.arrivalTo}</span><select className="min-h-12 min-w-0 w-full rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} onChange={(event) => setArrivalEnd(event.target.value)} required value={arrivalEnd}>{timeOptions.slice(1).map((time) => <option disabled={time <= arrivalStart} key={time} value={time}>{time}</option>)}</select></label>
        </div>
        {workerId && !props.workers.find((worker) => String(worker.id) === workerId)?.phone ? <p className="text-xs text-red-300">{copy.workerPhoneFallback}</p> : null}
        {!creating ? <label className="grid min-w-0 gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{props.locale === "lt" ? "Perplanavimo arba perskyrimo priežastis" : props.locale === "en" ? "Reason for rescheduling or reassignment" : "Årsak til omplanlegging eller ny medarbeider"}</span><textarea className="min-h-20 min-w-0 w-full rounded-xl border border-white/10 bg-[#0d1118] p-3" disabled={busy} maxLength={500} onChange={(event) => setPlanningReason(event.target.value)} value={planningReason} /><span className="text-xs text-muted-foreground">{props.locale === "lt" ? "Privaloma, jei keičiate darbuotoją, datą arba laiką." : props.locale === "en" ? "Required when changing employee, date or time." : "Påkrevd når medarbeider, dato eller tid endres."}</span></label> : null}
        <label className="grid min-w-0 gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.adminNote}</span><textarea className="min-h-24 min-w-0 w-full rounded-xl border border-white/10 bg-[#0d1118] p-3" disabled={busy} maxLength={1000} onChange={(event) => setAdminNote(event.target.value)} value={adminNote} /><span className="text-xs text-muted-foreground">{copy.adminNoteHelp}</span></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60" disabled={busy} onClick={() => void save()} type="button">{busy ? copy.processing : creating ? copy.createAndPlan : copy.savePlanning}</button>
        {!creating && ["unassigned", "assigned", "scheduled"].includes(props.status || "") ? <button className="min-h-12 rounded-xl border border-danger/40 px-5 font-bold text-danger hover:bg-danger/10 disabled:opacity-60" disabled={busy} onClick={() => void cancel()} type="button">{copy.cancelWork}</button> : null}
      </div>
      {feedback ? <p aria-live="polite" className={`mt-3 rounded-xl border px-3 py-2 text-sm ${feedback.kind === "error" ? "border-danger/35 bg-danger/10 text-red-100" : feedback.kind === "stale" ? "border-warning/35 bg-warning/10 text-amber-100" : feedback.kind === "queued" ? "border-accent/35 bg-accent/10 text-white/85" : "border-success/35 bg-success/10 text-green-100"}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
    </div>
  );
}
