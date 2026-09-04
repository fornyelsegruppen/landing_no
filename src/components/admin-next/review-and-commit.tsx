"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  AdminAsyncFeedback,
  type AdminAsyncState,
} from "./admin-async-feedback";
import { AdminOverlay } from "./admin-overlay";

export type ReviewRisk = "routine" | "material" | "destructive";

export function reviewRequiresAcknowledgement(risk: ReviewRisk) {
  return risk !== "routine";
}

export function claimReviewCommitAttempt(
  attempt: { current: string | null },
  idempotencyKey: string,
) {
  if (attempt.current === idempotencyKey) return false;
  attempt.current = idempotencyKey;
  return true;
}

export type ReviewPreflightItem = {
  id: string;
  label: string;
  detail: string;
  state: "pass" | "warning" | "blocked";
};

export function ReviewAndCommit({
  acknowledgement,
  changes,
  commitLabel,
  description,
  idempotencyKey,
  locale = "lt",
  onCommit,
  onOpenChange,
  open,
  postCommitState,
  preflight,
  risk = "routine",
  state = "idle",
  title,
  untouched,
}: {
  acknowledgement?: string;
  changes: readonly string[];
  commitLabel: string;
  description: string;
  idempotencyKey: string;
  locale?: PanelLocale;
  onCommit: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  postCommitState: string;
  preflight: readonly ReviewPreflightItem[];
  risk?: ReviewRisk;
  state?: AdminAsyncState;
  title: string;
  untouched: readonly string[];
}) {
  const copy = {
    nb: {
      back: "Gå tilbake og rediger",
      preflight: "Automatisk kontroll",
      changes: "Dette endres",
      untouched: "Dette gjøres ikke",
      postState: "Status etter handlingen",
      idempotency: "Idempotens",
      acknowledgement:
        "Jeg forstår den beskrevne konsekvensen og godkjenner denne konkrete handlingen.",
    },
    lt: {
      back: "Grįžti ir koreguoti",
      preflight: "Automatinė patikra",
      changes: "Kas pasikeis",
      untouched: "Kas nebus padaryta",
      postState: "Būsena po veiksmo",
      idempotency: "Idempotency",
      acknowledgement:
        "Suprantu nurodytą pasekmę ir patvirtinu šį konkretų veiksmą.",
    },
    en: {
      back: "Go back and edit",
      preflight: "Automatic checks",
      changes: "What will change",
      untouched: "What will not happen",
      postState: "State after the action",
      idempotency: "Idempotency",
      acknowledgement:
        "I understand the described consequence and approve this specific action.",
    },
  }[locale];
  const [acknowledged, setAcknowledged] = useState(false);
  const commitAttempt = useRef<string | null>(null);
  const requiresAck = reviewRequiresAcknowledgement(risk);
  const blocked = preflight.some((item) => item.state === "blocked");
  const pending = state === "pending";
  const commitDisabled = blocked || pending || (requiresAck && !acknowledged);
  const commit = () => {
    if (
      commitDisabled ||
      !claimReviewCommitAttempt(commitAttempt, idempotencyKey)
    ) {
      return;
    }
    let result: void | Promise<void>;
    try {
      result = onCommit();
    } catch (error) {
      commitAttempt.current = null;
      throw error;
    }
    void Promise.resolve(result).catch(() => {
      commitAttempt.current = null;
    });
  };

  return (
    <AdminOverlay
      description={description}
      locale={locale}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setAcknowledged(false);
          commitAttempt.current = null;
        }
        onOpenChange(nextOpen);
      }}
      open={open}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            className="min-h-11 rounded-xl border border-[var(--an-border)] px-4 text-sm font-bold text-[var(--an-text-muted)] hover:bg-[var(--an-surface-soft)]"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            {copy.back}
          </button>
          <button
            className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45 ${risk === "destructive" ? "bg-[var(--an-danger)] text-black" : "bg-[var(--an-action)] text-[var(--an-action-ink)] hover:bg-[var(--an-action-hover)]"}`}
            disabled={commitDisabled}
            onClick={commit}
            type="button"
          >
            {commitLabel}
          </button>
        </div>
      }
    >
      <section aria-labelledby="review-preflight-title">
        <h3
          className="text-xs font-bold tracking-[.16em] text-[var(--an-text-subtle)] uppercase"
          id="review-preflight-title"
        >
          {copy.preflight}
        </h3>
        <ul className="mt-3 grid gap-2">
          {preflight.map((item) => {
            const Icon = item.state === "pass" ? CheckCircle2 : AlertTriangle;
            const tone =
              item.state === "pass"
                ? "text-[var(--an-success)]"
                : item.state === "blocked"
                  ? "text-[var(--an-danger)]"
                  : "text-[var(--an-info)]";
            return (
              <li
                className="flex items-start gap-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3"
                key={item.id}
              >
                <Icon
                  aria-hidden="true"
                  className={`mt-0.5 size-5 shrink-0 ${tone}`}
                />
                <span>
                  <strong className="block text-sm">{item.label}</strong>
                  <small className="mt-0.5 block text-[var(--an-text-muted)]">
                    {item.detail}
                  </small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <section
          className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-4"
          aria-labelledby="review-changes-title"
        >
          <h3
            className="flex items-center gap-2 text-sm font-bold"
            id="review-changes-title"
          >
            <ArrowRight
              aria-hidden="true"
              className="size-4 text-[var(--an-action)]"
            />
            {copy.changes}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--an-text-muted)]">
            {changes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section
          className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-4"
          aria-labelledby="review-untouched-title"
        >
          <h3
            className="flex items-center gap-2 text-sm font-bold"
            id="review-untouched-title"
          >
            <ShieldCheck
              aria-hidden="true"
              className="size-4 text-[var(--an-info)]"
            />
            {copy.untouched}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--an-text-muted)]">
            {untouched.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-4 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-3 text-sm text-[var(--an-text-muted)]">
        <strong className="text-[var(--an-text-primary)]">
          {copy.postState}:
        </strong>{" "}
        {postCommitState}
        <br />
        <small>
          {copy.idempotency}: {idempotencyKey}
        </small>
      </p>

      {requiresAck ? (
        <label
          className={`mt-4 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm ${risk === "destructive" ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)]" : "border-[var(--an-info)] bg-[var(--an-info-soft)]"}`}
        >
          <input
            className="mt-1 size-4 shrink-0 accent-[var(--an-action)]"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            type="checkbox"
          />
          <span>{acknowledgement || copy.acknowledgement}</span>
        </label>
      ) : null}

      {state !== "idle" ? (
        <div className="mt-4">
          <AdminAsyncFeedback
            action={commitLabel}
            locale={locale}
            retryIsSafe={Boolean(idempotencyKey)}
            state={state}
          />
        </div>
      ) : null}
    </AdminOverlay>
  );
}
