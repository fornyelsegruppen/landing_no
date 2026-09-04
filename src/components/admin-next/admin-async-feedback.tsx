"use client";

import { AlertTriangle, CheckCircle2, CloudOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

export const ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS = 150;

export type AdminAsyncState = "idle" | "pending" | "success" | "error" | "offline";
export type AdminRecoveryAction = {
  kind: "back" | "correct" | "retry";
  label?: string;
  onAction: () => void;
  safe?: boolean;
};

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
  recoveryActions = [],
  retryIsSafe = false,
  state,
}: {
  action: string;
  correlationId?: string;
  delayMs?: number;
  locale?: PanelLocale;
  message?: string;
  onRetry?: () => void;
  recoveryActions?: readonly AdminRecoveryAction[];
  retryIsSafe?: boolean;
  state: Exclude<AdminAsyncState, "idle">;
}) {
  if (delayMs > 0) {
    return (
      <DelayedAdminFeedback delayMs={delayMs}>
        <AdminAsyncFeedback
          action={action}
          correlationId={correlationId}
          locale={locale}
          message={message}
          onRetry={onRetry}
          recoveryActions={recoveryActions}
          retryIsSafe={retryIsSafe}
          state={state}
        />
      </DelayedAdminFeedback>
    );
  }

  const copy = {
    nb: { success: "fullført", error: "mislyktes", offline: "venter på nettverk", correlation: "Korrelasjon", retry: "Prøv igjen", back: "Gå tilbake", correct: "Rett opp" },
    lt: { success: "baigta", error: "nepavyko", offline: "laukia ryšio", correlation: "Koreliacija", retry: "Bandyti dar kartą", back: "Grįžti", correct: "Koreguoti" },
    en: { success: "completed", error: "failed", offline: "waiting for a connection", correlation: "Correlation", retry: "Try again", back: "Go back", correct: "Correct" },
  }[locale];
  const details = {
    pending: { icon: LoaderCircle, label: action, className: "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]", spin: true },
    success: { icon: CheckCircle2, label: message || `${action} ${copy.success}`, className: "border-[var(--an-success)] bg-[var(--an-success-soft)] text-[var(--an-success)]", spin: false },
    error: { icon: AlertTriangle, label: message || `${action} ${copy.error}`, className: "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]", spin: false },
    offline: { icon: CloudOff, label: message || `${action} ${copy.offline}`, className: "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]", spin: false },
  }[state];
  const Icon = details.icon;

  return (
    <div aria-live={state === "error" ? "assertive" : "polite"} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${details.className}`} role={state === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${details.spin ? "animate-spin motion-reduce:animate-none" : ""}`} />
      <div className="min-w-0 flex-1">
        <strong className="block">{details.label}</strong>
        {correlationId ? <small className="mt-1 block opacity-80">{copy.correlation}: {correlationId}</small> : null}
      </div>
      {state === "error" ? (
        <div className="flex flex-wrap gap-2">
          {recoveryActions.filter((item) => item.kind !== "retry" || item.safe).map((item) => (
            <button className="min-h-11 rounded-lg border border-current px-3 font-bold" key={`${item.kind}-${item.label || "default"}`} onClick={item.onAction} type="button">
              {item.label || copy[item.kind]}
            </button>
          ))}
          {onRetry && retryIsSafe ? <button className="min-h-11 rounded-lg border border-current px-3 font-bold" onClick={onRetry} type="button">{copy.retry}</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function DelayedAdminFeedback({ children, delayMs }: { children: React.ReactNode; delayMs: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return visible ? children : null;
}
