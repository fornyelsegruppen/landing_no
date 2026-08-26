"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { caseActionRequiresConfirmation, type CaseNextAction } from "@/lib/admin-v2/case-read-model";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";
import { CompanySignaturePanel } from "./company-signature-panel";
import { interpretAdminActionResult, type AdminActionFeedback, type AdminActionResponse } from "@/lib/admin-v2/action-result";

type ActionVersionContext = {
  contractReference?: string;
  contractVersion?: number;
  leadRevision: number;
  quoteDocumentHash?: string;
  quoteReference?: string;
  quoteVersion?: number;
};

function requestFor(action: CaseNextAction, leadId: number, version: ActionVersionContext) {
  const leadContext = { expectedRevision: version.leadRevision };
  const quoteContext = {
    expectedDocumentHash: version.quoteDocumentHash,
    expectedVersion: version.quoteVersion,
  };
  switch (action.kind) {
    case "generate_reply": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "generate_reply", ...leadContext } };
    case "prepare_package": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "prepare_package", ...leadContext } };
    case "approve_package": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "approve_package", ...leadContext } };
    case "approve_message": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "approve_send", messageId: action.targetId, ...leadContext } };
    case "send_closure_confirmation": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "approve_send", messageId: action.targetId, ...leadContext } };
    case "retry_message": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "retry_send", messageId: action.targetId, ...leadContext } };
    case "approve_measurement": return { endpoint: `/api/admin/measurements/${action.targetId}`, body: { action: "approve" } };
    case "calculate_price": return { endpoint: `/api/admin/measurements/${action.targetId}`, body: { action: "calculate_price" } };
    case "create_quote": return { endpoint: "/api/admin/quotes", body: { calculationId: action.targetId } };
    case "approve_quote": return { endpoint: `/api/admin/quotes/${action.targetId}`, body: { action: "approve", ...quoteContext } };
    case "issue_quote": return { endpoint: `/api/admin/quotes/${action.targetId}`, body: { action: "issue", ...quoteContext } };
    default: return null;
  }
}

export function CaseActionPanel({ action, actionLabel, actionReference, contractDocumentHash, defaultSigner, leadId, locale, versionContext }: { action: CaseNextAction; actionLabel: string; actionReference?: string; contractDocumentHash?: string; defaultSigner: string; leadId: number; locale: PanelLocale; versionContext: ActionVersionContext }) {
  const copy = getAdminCaseCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AdminActionFeedback | null>(null);
  const request = requestFor(action, leadId, versionContext);

  if (action.kind === "company_sign_contract" && action.targetId && contractDocumentHash) {
    return <CompanySignaturePanel actionLabel={actionLabel} contractId={action.targetId} contractReference={versionContext.contractReference} contractVersion={versionContext.contractVersion} defaultSigner={defaultSigner} documentHash={contractDocumentHash} locale={locale} />;
  }

  async function run() {
    if (!request || busy) return;
    if (["approve_package", "approve_quote", "issue_quote"].includes(action.kind)) {
      const unsavedCommercialEditor = document.querySelector<HTMLElement>('#commercial-editor[data-commercial-dirty="true"]');
      if (unsavedCommercialEditor) {
        unsavedCommercialEditor.scrollIntoView({ behavior: "smooth", block: "center" });
        window.alert(copy.unsavedCommercialChanges);
        return;
      }
    }
    if (action.kind === "send_closure_confirmation" && !window.confirm(`${copy.confirmClosureSend}\n\n${actionLabel}`)) return;
    if (action.kind !== "send_closure_confirmation" && caseActionRequiresConfirmation(action.kind) && !window.confirm(`${copy.confirmEconomicAction}\n\n${actionLabel}`)) return;
    setBusy(true);
    setFeedback(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(request.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({})) as AdminActionResponse;
      const nextFeedback = interpretAdminActionResult({
        fallbackError: copy.actionFailed,
        ok: response.ok,
        queuedMessage: copy.actionSavedQueued,
        reference: actionReference,
        result,
        staleMessage: copy.staleAction,
        successMessage: copy.actionDone,
      });
      setFeedback(nextFeedback);
      if (nextFeedback.refresh) router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof DOMException && error.name === "AbortError" ? copy.networkTimeout : error instanceof Error ? error.message : copy.actionFailed,
        refresh: false,
      });
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  const technicalTarget = action.kind === "measurement_required"
    ? "#measurement-section"
    : action.kind === "review_cancellation"
      ? "#cancellation-review"
    : ["create_work_order", "assign_worker", "schedule_work"].includes(action.kind)
      ? "#work-planning"
    : action.kind === "review_completion" && action.targetId
      ? "#completion-review"
    : action.kind === "resolve_work_block" && action.targetId
      ? "#change-agreement-workbench"
      : null;

  return (
    <div>
      {request ? (
        <button className={`min-h-12 rounded-xl px-5 font-bold shadow-lg transition disabled:opacity-60 ${action.kind === "send_closure_confirmation" ? "bg-danger text-white shadow-danger/20 hover:brightness-110" : "bg-accent text-accent-foreground shadow-accent/10 hover:bg-accent-hover"}`} disabled={busy} onClick={() => void run()} type="button">
          {busy ? copy.processing : actionLabel}
        </button>
      ) : technicalTarget ? (
        <Link className="inline-flex min-h-12 items-center rounded-xl border border-accent/50 px-5 font-bold text-accent hover:bg-accent/10" href={technicalTarget}>{actionLabel}</Link>
      ) : (
        <p className="font-semibold text-white/80">{actionLabel}</p>
      )}
      {feedback ? <p aria-live="polite" className={`mt-3 rounded-xl border px-3 py-2 text-sm ${feedback.kind === "error" ? "border-danger/35 bg-danger/10 text-red-100" : feedback.kind === "stale" ? "border-warning/35 bg-warning/10 text-amber-100" : feedback.kind === "queued" ? "border-accent/35 bg-accent/10 text-white/85" : "border-success/35 bg-success/10 text-green-100"}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
    </div>
  );
}

export function CloseCaseButton({ leadId, locale }: { leadId: number; locale: PanelLocale }) {
  const copy = getAdminCaseCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function closeCase() {
    if (!window.confirm(copy.closeConfirm)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/leads/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) router.refresh();
  }

  return <button className="text-sm font-semibold text-danger hover:underline disabled:opacity-60" disabled={busy} onClick={() => void closeCase()} type="button">{copy.close}</button>;
}
