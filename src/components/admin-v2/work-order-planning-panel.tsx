"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  interpretAdminActionResult,
  type AdminActionFeedback,
  type AdminActionResponse,
} from "@/lib/admin-v2/action-result";
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
  caseId: number;
  contractId: number;
  contractDocumentHash?: string;
  contractReference?: string;
  contractVersion?: number;
  locale: PanelLocale;
  scheduledLocal?: string;
  status?: string;
  incompleteWorkerCount?: number;
  workOrderId?: number;
  workers: Worker[];
}) {
  const copy = getAdminCaseCopy(props.locale);
  const router = useRouter();
  const initialWindow = parseArrivalWindow(props.arrivalWindow);
  const initialScheduledDate = props.scheduledLocal?.slice(0, 10) || "";
  const initialScheduledTime = props.scheduledLocal?.slice(11, 16) || "";
  const initialArrivalStart =
    initialWindow?.start || normalizeArrivalStartTime(initialScheduledTime);
  const initialArrivalEnd =
    initialWindow?.end || defaultArrivalEndTime(initialArrivalStart);
  const [workerId, setWorkerId] = useState(
    props.assignedWorkerId ? String(props.assignedWorkerId) : "",
  );
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [arrivalStart, setArrivalStart] = useState(initialArrivalStart);
  const [arrivalEnd, setArrivalEnd] = useState(initialArrivalEnd);
  const [adminNote, setAdminNote] = useState(props.adminNote || "");
  const [planningReason, setPlanningReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AdminActionFeedback | null>(null);
  const creating = !props.workOrderId;
  const employeeManagementHref = `/admin-v2/employees?returnTo=${encodeURIComponent(`/admin-v2/cases/${props.caseId}`)}#add-employee`;

  async function save() {
    if (busy) return;
    if (!workerId || !scheduledDate || !arrivalStart || !arrivalEnd) {
      setFeedback({
        kind: "error",
        message: copy.completePlanningRequired,
        refresh: false,
      });
      return;
    }
    let arrivalWindow: string;
    try {
      arrivalWindow = arrivalWindowFromTimes(arrivalStart, arrivalEnd);
    } catch {
      setFeedback({
        kind: "error",
        message: copy.arrivalEndAfterStart,
        refresh: false,
      });
      return;
    }
    const scheduledLocal = `${scheduledDate}T${arrivalStart}`;
    if (
      creating &&
      !window.confirm(
        `${copy.confirmEconomicAction}\n\n${copy.createAndPlan}${props.contractReference ? ` ${props.contractReference}` : ""}`,
      )
    )
      return;
    setBusy(true);
    setFeedback(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(
        creating
          ? "/api/admin/work-orders"
          : `/api/admin/work-orders/${props.workOrderId}`,
        {
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
            ...(creating
              ? scheduledLocal
                ? { scheduledLocal }
                : {}
              : { scheduledLocal }),
          }),
          signal: controller.signal,
        },
      );
      const result = (await response
        .json()
        .catch(() => ({}))) as AdminActionResponse;
      const nextFeedback = interpretAdminActionResult({
        fallbackError: copy.actionFailed,
        ok: response.ok,
        queuedMessage: copy.planningSavedNotificationQueued,
        reference: props.contractReference,
        result,
        staleMessage: copy.staleAction,
        successMessage:
          result.notification === "sent"
            ? copy.planningSavedAndNotified
            : copy.actionDone,
      });
      setFeedback(nextFeedback);
      if (nextFeedback.refresh) router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof DOMException && error.name === "AbortError"
            ? copy.networkTimeout
            : error instanceof Error
              ? error.message
              : copy.actionFailed,
        refresh: false,
      });
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  async function cancel() {
    if (!props.workOrderId || busy || !window.confirm(copy.cancelWorkConfirm))
      return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/admin/work-orders/${props.workOrderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setFeedback({ kind: "success", message: copy.actionDone, refresh: true });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : copy.actionFailed,
        refresh: false,
      });
    } finally {
      setBusy(false);
    }
  }

  async function notify() {
    if (
      !props.workOrderId ||
      busy ||
      !window.confirm(copy.resendAssignmentNotificationsConfirm)
    )
      return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/admin/work-orders/${props.workOrderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "notify" }),
        },
      );
      const result = (await response
        .json()
        .catch(() => ({}))) as AdminActionResponse;
      const nextFeedback = interpretAdminActionResult({
        fallbackError: copy.actionFailed,
        ok: response.ok,
        queuedMessage: copy.assignmentNotificationsQueued,
        result,
        staleMessage: copy.staleAction,
        successMessage: copy.assignmentNotificationsSent,
      });
      setFeedback(nextFeedback);
      if (nextFeedback.refresh) router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : copy.actionFailed,
        refresh: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="border-accent/30 bg-accent/5 mt-5 rounded-2xl border p-4"
      id="work-planning"
    >
      <h3 className="font-bold">{copy.workPlanning}</h3>
      {props.contractReference ? (
        <p className="text-accent mt-1 text-sm font-bold">
          {props.contractReference}
        </p>
      ) : null}
      <div className="mt-4 grid min-w-0 gap-4">
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.chooseEmployee}
            </span>
            <Link
              className="border-accent/40 text-accent hover:bg-accent/10 inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition"
              href={employeeManagementHref}
            >
              <Plus aria-hidden="true" className="size-4" />
              {copy.addEmployee}
            </Link>
          </div>
          <Select.Root
            disabled={busy || props.workers.length === 0}
            onValueChange={setWorkerId}
            value={workerId || undefined}
          >
            <Select.Trigger
              aria-label={copy.chooseEmployee}
              className="hover:border-accent/45 focus-visible:ring-accent flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#0d1118] px-4 text-left font-semibold transition outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Select.Value placeholder={copy.noEmployee} />
              <Select.Icon>
                <ChevronDown
                  aria-hidden="true"
                  className="text-accent size-5"
                />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="z-[100] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-white/15 bg-[#11151d] p-1 text-white shadow-2xl shadow-black/60"
                position="popper"
                sideOffset={6}
              >
                <Select.Viewport>
                  {props.workers.map((worker) => (
                    <Select.Item
                      className="data-[highlighted]:bg-accent relative flex min-h-12 cursor-pointer items-center rounded-lg py-2 pr-4 pl-10 outline-none select-none data-[highlighted]:text-black"
                      key={worker.id}
                      value={String(worker.id)}
                    >
                      <Select.ItemIndicator className="absolute left-3">
                        <Check aria-hidden="true" className="size-4" />
                      </Select.ItemIndicator>
                      <Select.ItemText>
                        {worker.name}
                        {worker.phone ? ` · ${worker.phone}` : ""}
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          {props.workers.length === 0 ? (
            <p className="border-warning/35 bg-warning/10 rounded-xl border px-3 py-2 text-sm text-amber-100">
              {copy.noAssignableEmployees}
            </p>
          ) : null}
          {(props.incompleteWorkerCount || 0) > 0 ? (
            <p className="text-muted-foreground text-xs">
              {copy.incompleteEmployees}{" "}
              <strong className="text-amber-200">
                {props.incompleteWorkerCount}
              </strong>
              .
            </p>
          ) : null}
        </div>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {copy.workDate}
          </span>
          <input
            className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1118] px-3"
            disabled={busy}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setScheduledDate(event.target.value)}
            required
            type="date"
            value={scheduledDate}
          />
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.arrivalFrom}
            </span>
            <select
              className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1118] px-3"
              disabled={busy}
              onChange={(event) => {
                const nextStart = event.target.value;
                setArrivalStart(nextStart);
                if (arrivalEnd <= nextStart)
                  setArrivalEnd(defaultArrivalEndTime(nextStart));
              }}
              required
              value={arrivalStart}
            >
              {timeOptions.slice(0, -1).map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.arrivalTo}
            </span>
            <select
              className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1118] px-3"
              disabled={busy}
              onChange={(event) => setArrivalEnd(event.target.value)}
              required
              value={arrivalEnd}
            >
              {timeOptions.slice(1).map((time) => (
                <option disabled={time <= arrivalStart} key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
        </div>
        {workerId &&
        !props.workers.find((worker) => String(worker.id) === workerId)
          ?.phone ? (
          <p className="text-xs text-red-300">{copy.workerPhoneFallback}</p>
        ) : null}
        {!creating ? (
          <label className="grid min-w-0 gap-1.5">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {props.locale === "lt"
                ? "Perplanavimo arba perskyrimo priežastis"
                : props.locale === "en"
                  ? "Reason for rescheduling or reassignment"
                  : "Årsak til omplanlegging eller ny medarbeider"}
            </span>
            <textarea
              className="min-h-20 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1118] p-3"
              disabled={busy}
              maxLength={500}
              onChange={(event) => setPlanningReason(event.target.value)}
              value={planningReason}
            />
            <span className="text-muted-foreground text-xs">
              {props.locale === "lt"
                ? "Privaloma, jei keičiate darbuotoją, datą arba laiką."
                : props.locale === "en"
                  ? "Required when changing employee, date or time."
                  : "Påkrevd når medarbeider, dato eller tid endres."}
            </span>
          </label>
        ) : null}
        <label className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {copy.adminNote}
          </span>
          <textarea
            className="min-h-24 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1118] p-3"
            disabled={busy}
            maxLength={1000}
            onChange={(event) => setAdminNote(event.target.value)}
            value={adminNote}
          />
          <span className="text-muted-foreground text-xs">
            {copy.adminNoteHelp}
          </span>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-12 rounded-xl px-5 font-bold disabled:opacity-60"
          disabled={busy}
          onClick={() => void save()}
          type="button"
        >
          {busy
            ? copy.processing
            : creating
              ? copy.createAndPlan
              : copy.savePlanning}
        </button>
        {!creating &&
        ["unassigned", "assigned", "scheduled"].includes(props.status || "") ? (
          <button
            className="border-danger/40 text-danger hover:bg-danger/10 min-h-12 rounded-xl border px-5 font-bold disabled:opacity-60"
            disabled={busy}
            onClick={() => void cancel()}
            type="button"
          >
            {copy.cancelWork}
          </button>
        ) : null}
        {!creating && props.status === "scheduled" ? (
          <button
            className="border-accent/40 text-accent hover:bg-accent/10 min-h-12 rounded-xl border px-5 font-bold disabled:opacity-60"
            disabled={busy}
            onClick={() => void notify()}
            type="button"
          >
            {copy.resendAssignmentNotifications}
          </button>
        ) : null}
      </div>
      {feedback ? (
        <p
          aria-live="polite"
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${feedback.kind === "error" ? "border-danger/35 bg-danger/10 text-red-100" : feedback.kind === "stale" ? "border-warning/35 bg-warning/10 text-amber-100" : feedback.kind === "queued" ? "border-accent/35 bg-accent/10 text-white/85" : "border-success/35 bg-success/10 text-green-100"}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
