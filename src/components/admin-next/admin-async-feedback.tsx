"use client";

import { AlertTriangle, CheckCircle2, CloudOff, LoaderCircle } from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";

export const ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS = 150;

export type AdminAsyncState = "idle" | "pending" | "success" | "error" | "offline";

export function shouldShowAdminPendingFeedback(elapsedMs: number) {
  return elapsedMs >= ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS;
}

export function AdminAsyncFeedback({
  action,
  correlationId,
  delayMs = 0,
  locale = "lt",
  message,
  onRetry,
  retryIsSafe = false,
  state,
}: {
  action: string;
  correlationId?: string;
  delayMs?: number;
  locale?: PanelLocale;
  message?: string;
  onRetry?: () => void;
  retryIsSafe?: boolean;
  state: Exclude<AdminAsyncState, "idle">;
}) {
  const copy = {
    nb: { success: "fullført", error: "mislyktes", offline: "venter på nettverk", correlation: "Korrelasjon", retry: "Prøv igjen" },
    lt: { success: "baigta", error: "nepavyko", offline: "laukia ryšio", correlation: "Koreliacija", retry: "Bandyti dar kartą" },
    en: { success: "completed", error: "failed", offline: "waiting for a connection", correlation: "Correlation", retry: "Try again" },
  }[locale];
  const details = {
    pending: { icon: LoaderCircle, label: action, className: "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]", spin: true },
    success: { icon: CheckCircle2, label: message || `${action} ${copy.success}`, className: "border-[var(--an-success)] bg-[var(--an-success-soft)] text-[var(--an-success)]", spin: false },
    error: { icon: AlertTriangle, label: message || `${action} ${copy.error}`, className: "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]", spin: false },
    offline: { icon: CloudOff, label: message || `${action} ${copy.offline}`, className: "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]", spin: false },
  }[state];
  const Icon = details.icon;

  return (
    <div aria-live={state === "error" ? "assertive" : "polite"} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${delayMs ? "opacity-0 [animation:admin-feedback-reveal_1ms_linear_forwards]" : ""} ${details.className}`} role={state === "error" ? "alert" : "status"} style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}>
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${details.spin ? "animate-spin motion-reduce:animate-none" : ""}`} />
      <div className="min-w-0 flex-1">
        <strong className="block">{details.label}</strong>
        {correlationId ? <small className="mt-1 block opacity-80">{copy.correlation}: {correlationId}</small> : null}
      </div>
      {state === "error" && onRetry && retryIsSafe ? (
        <button className="min-h-11 rounded-lg border border-current px-3 font-bold" onClick={onRetry} type="button">
          {copy.retry}
        </button>
      ) : null}
    </div>
  );
}
