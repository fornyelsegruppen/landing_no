"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { caseActionRequiresConfirmation, type CaseNextAction } from "@/lib/admin-v2/case-read-model";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";
import { CompanySignaturePanel } from "./company-signature-panel";

function requestFor(action: CaseNextAction, leadId: number) {
  switch (action.kind) {
    case "generate_reply": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "generate_reply" } };
    case "prepare_package": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "prepare_package" } };
    case "approve_package": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "approve_package" } };
    case "approve_message": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "approve_send", messageId: action.targetId } };
    case "retry_message": return { endpoint: `/api/admin/leads/${leadId}`, body: { action: "retry_send", messageId: action.targetId } };
    case "approve_measurement": return { endpoint: `/api/admin/measurements/${action.targetId}`, body: { action: "approve" } };
    case "calculate_price": return { endpoint: `/api/admin/measurements/${action.targetId}`, body: { action: "calculate_price" } };
    case "create_quote": return { endpoint: "/api/admin/quotes", body: { calculationId: action.targetId } };
    case "approve_quote": return { endpoint: `/api/admin/quotes/${action.targetId}`, body: { action: "approve" } };
    case "issue_quote": return { endpoint: `/api/admin/quotes/${action.targetId}`, body: { action: "issue" } };
    case "create_work_order": return { endpoint: "/api/admin/work-orders", body: { contractId: action.targetId } };
    default: return null;
  }
}

export function CaseActionPanel({ action, contractDocumentHash, defaultSigner, leadId, locale }: { action: CaseNextAction; contractDocumentHash?: string; defaultSigner: string; leadId: number; locale: PanelLocale }) {
  const copy = getAdminCaseCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = requestFor(action, leadId);

  if (action.kind === "company_sign_contract" && action.targetId && contractDocumentHash) {
    return <CompanySignaturePanel contractId={action.targetId} defaultSigner={defaultSigner} documentHash={contractDocumentHash} locale={locale} />;
  }

  async function run() {
    if (!request || busy) return;
    if (caseActionRequiresConfirmation(action.kind) && !window.confirm(copy.confirmEconomicAction)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(request.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setNotice(copy.actionDone);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  const technicalTarget = action.kind === "measurement_required"
    ? `/admin/collections/leads/${leadId}`
    : ["assign_worker", "schedule_work", "resolve_work_block", "review_completion"].includes(action.kind) && action.targetId
      ? `/admin/collections/work-orders/${action.targetId}`
      : null;

  return (
    <div>
      {request ? (
        <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground shadow-lg shadow-accent/10 transition hover:bg-accent-hover disabled:opacity-60" disabled={busy} onClick={() => void run()} type="button">
          {busy ? copy.processing : copy.actionLabels[action.kind]}
        </button>
      ) : technicalTarget ? (
        <Link className="inline-flex min-h-12 items-center rounded-xl border border-accent/50 px-5 font-bold text-accent hover:bg-accent/10" href={technicalTarget}>{copy.actionLabels[action.kind]}</Link>
      ) : (
        <p className="font-semibold text-white/80">{copy.actionLabels[action.kind]}</p>
      )}
      {notice ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
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
