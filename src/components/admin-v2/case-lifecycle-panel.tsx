"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import {
  archiveClassifications,
  type ArchiveClassification,
  type CaseRecordState,
} from "@/lib/leads/case-lifecycle";
import type { PanelLocale } from "@/lib/panel-i18n";

export function CaseLifecyclePanel({
  classification,
  leadId,
  locale,
  purgeAfter,
  recordState,
}: {
  classification?: string;
  leadId: number;
  locale: PanelLocale;
  purgeAfter?: string;
  recordState: CaseRecordState;
}) {
  const copy = getAdminCaseCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [selectedClassification, setSelectedClassification] =
    useState<ArchiveClassification>(
      (archiveClassifications.includes(classification as ArchiveClassification)
        ? classification
        : "other") as ArchiveClassification,
    );
  const [confirmation, setConfirmation] = useState("");

  async function run(action: "archive" | "purge" | "restore" | "trash") {
    if (busy) return;
    if (
      !window.confirm(
        action === "purge" ? copy.purgeConfirm : copy.lifecycleConfirm,
      )
    )
      return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          classification: selectedClassification,
          confirmation,
          reason,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
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

  const stateLabel =
    recordState === "archived"
      ? copy.lifecycleArchived
      : recordState === "trashed"
        ? copy.lifecycleTrashed
        : copy.lifecycleActive;
  const stateTone =
    recordState === "trashed"
      ? "border-danger/35 bg-danger/10 text-danger"
      : recordState === "archived"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : "border-accent/25 bg-accent/10 text-accent";
  const shellTone =
    recordState === "trashed" ? "border-danger/30" : "border-white/10";
  const formattedPurgeAfter = purgeAfter
    ? new Intl.DateTimeFormat(
        locale === "lt" ? "lt-LT" : locale === "en" ? "en-GB" : "nb-NO",
        {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Oslo",
        },
      ).format(new Date(purgeAfter))
    : null;

  return (
    <details
      className={`group bg-background-elevated/75 overflow-hidden rounded-2xl border ${shellTone}`}
      id="case-lifecycle-title"
    >
      <summary className="focus-visible:ring-accent/70 flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-bold sm:text-lg">
            {copy.lifecycle}
          </span>
          {formattedPurgeAfter ? (
            <span className="text-muted-foreground mt-0.5 block text-xs sm:text-sm">
              {copy.purgeAfter}: {formattedPurgeAfter}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase sm:px-3 sm:text-xs ${stateTone}`}
          >
            {stateLabel}
          </span>
          <span
            aria-hidden="true"
            className="text-muted-foreground text-lg transition-transform group-open:rotate-180"
          >
            ⌄
          </span>
        </span>
      </summary>

      <div
        aria-busy={busy}
        className="border-t border-white/10 px-4 py-4 sm:px-5 sm:py-5"
      >
        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            {copy.lifecycleReason}
          </span>
          <textarea
            className="min-h-20 rounded-xl border border-white/10 bg-black/15 p-3"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy.lifecycleReasonPlaceholder}
            value={reason}
          />
        </label>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {recordState === "active" ? (
            <section className="border-accent/20 bg-accent/[0.04] rounded-2xl border p-4">
              <h3 className="text-accent font-bold">{copy.archiveCase}</h3>
              <label className="mt-3 grid gap-1.5">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {copy.archiveClassification}
                </span>
                <select
                  className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3"
                  onChange={(event) =>
                    setSelectedClassification(
                      event.target.value as ArchiveClassification,
                    )
                  }
                  value={selectedClassification}
                >
                  {archiveClassifications.map((value) => (
                    <option key={value} value={value}>
                      {copy.archiveClasses[value]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="border-accent/45 text-accent hover:bg-accent/10 mt-3 min-h-12 w-full rounded-xl border px-4 font-bold disabled:opacity-50 sm:w-auto"
                disabled={busy || reason.trim().length < 5}
                onClick={() => void run("archive")}
                type="button"
              >
                {copy.archiveCase}
              </button>
            </section>
          ) : (
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <h3 className="font-bold">{copy.restoreCase}</h3>
              <button
                className="hover:border-accent/50 mt-3 min-h-12 w-full rounded-xl border border-white/15 px-4 font-bold disabled:opacity-50 sm:w-auto"
                disabled={busy || reason.trim().length < 5}
                onClick={() => void run("restore")}
                type="button"
              >
                {copy.restoreCase}
              </button>
            </section>
          )}

          {recordState !== "trashed" ? (
            <section className="border-danger/30 bg-danger/[0.06] rounded-2xl border p-4">
              <h3 className="text-danger font-bold">{copy.trashCase}</h3>
              <button
                className="border-danger/40 text-danger hover:bg-danger/10 mt-3 min-h-12 w-full rounded-xl border px-4 font-bold disabled:opacity-50 sm:w-auto"
                disabled={busy || reason.trim().length < 5}
                onClick={() => void run("trash")}
                type="button"
              >
                {copy.trashCase}
              </button>
            </section>
          ) : (
            <details className="border-danger/35 bg-danger/[0.06] rounded-2xl border p-4">
              <summary className="text-danger focus-visible:ring-danger/70 min-h-12 cursor-pointer list-none font-bold outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                <span className="flex min-h-12 items-center justify-between gap-3">
                  {copy.purgeCase}
                  <span aria-hidden="true">⌄</span>
                </span>
              </summary>
              <label className="mt-3 grid gap-1.5">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {copy.purgeConfirmation}
                </span>
                <input
                  className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
                  inputMode="numeric"
                  onChange={(event) => setConfirmation(event.target.value)}
                  value={confirmation}
                />
              </label>
              <button
                className="bg-danger mt-3 min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50 sm:w-auto"
                disabled={
                  busy ||
                  confirmation !== String(leadId) ||
                  reason.trim().length < 5
                }
                onClick={() => void run("purge")}
                type="button"
              >
                {copy.purgeCase}
              </button>
            </details>
          )}
        </div>

        {notice ? (
          <p
            aria-live="polite"
            className="text-muted-foreground mt-4 text-sm"
            role="status"
          >
            {notice}
          </p>
        ) : null}
      </div>
    </details>
  );
}
