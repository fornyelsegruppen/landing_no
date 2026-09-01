"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

type Rule = { serviceKey: string; serviceName: string; unitPriceExVatOre: number };

export function CommercialQuoteEditor(props: {
  currentService?: string;
  expectedRevision: number;
  leadId: number;
  locale: PanelLocale;
  rules: Rule[];
  sourceQuoteId: number;
  unitPriceExVatOre?: number;
}) {
  const copy = getAdminCaseCopy(props.locale);
  const router = useRouter();
  const defaultRule = props.rules.find((rule) => rule.serviceKey === props.currentService);
  const [unitPrice, setUnitPrice] = useState(((props.unitPriceExVatOre || defaultRule?.unitPriceExVatOre || 0) / 100).toFixed(2));
  const [discountKind, setDiscountKind] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [depositPercent, setDepositPercent] = useState("0");
  const [reason, setReason] = useState("");
  const suggestedRecommendation = props.currentService === "takvask"
    ? props.rules.find((rule) => rule.serviceKey === "takvask_impregnering")
    : undefined;
  const [recommendedService, setRecommendedService] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const confirmationRef = useRef<HTMLDivElement>(null);
  const requestKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const recommendation = useMemo(() => props.rules.find((rule) => rule.serviceKey === recommendedService), [props.rules, recommendedService]);
  const dirty = unitPrice !== ((props.unitPriceExVatOre || defaultRule?.unitPriceExVatOre || 0) / 100).toFixed(2)
    || discountKind !== "none"
    || Number(discountValue.replace(",", ".")) !== 0
    || Number(depositPercent.replace(",", ".")) !== 0
    || Boolean(recommendedService)
    || Boolean(reason.trim());

  useEffect(() => {
    if (confirmOpen) confirmationRef.current?.focus();
  }, [confirmOpen]);

  function invalidateConfirmation() {
    setConfirmOpen(false);
    requestKeyRef.current = null;
    setNotice("");
  }

  function prepareConfirmation() {
    if (busy || reason.trim().length < 10) return;
    requestKeyRef.current ??= crypto.randomUUID();
    setNotice("");
    setConfirmOpen(true);
  }

  async function submit() {
    if (submittingRef.current || busy || !confirmOpen) return;
    submittingRef.current = true;
    setBusy(true);
    setConfirmOpen(false);
    setNotice("");
    try {
      const idempotencyKey = requestKeyRef.current;
      if (!idempotencyKey) throw new Error(copy.actionFailed);
      const response = await fetch(`/api/admin/leads/${props.leadId}/commercial-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          baseUnitPriceExVatOre: Math.round(Number(unitPrice.replace(",", ".")) * 100),
          discountKind,
          discountValue: Number(discountValue.replace(",", ".")),
          depositPercent: Number(depositPercent.replace(",", ".")),
          expectedRevision: props.expectedRevision,
          reason,
          sourceQuoteId: props.sourceQuoteId,
          ...(recommendedService ? { recommendedServiceKey: recommendedService } : {}),
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        baseQuoteReference?: string;
        error?: string;
        recommendedQuoteReference?: string | null;
        status?: "completed" | "processing";
      };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      if (result.status === "processing") {
        setNotice(copy.commercialProcessingNotice);
      } else {
        const references = [result.baseQuoteReference, result.recommendedQuoteReference].filter(Boolean).join(" + ");
        setNotice(`${copy.commercialCreatedNotice}${references ? ` ${references}.` : ""}`);
        requestKeyRef.current = null;
        router.refresh();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4" data-commercial-dirty={dirty ? "true" : "false"} id="commercial-editor">
    <h3 className="font-bold">{copy.commercialEditor}</h3>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.unitPrice}</span><input className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} inputMode="decimal" min="0.01" onChange={(event) => { invalidateConfirmation(); setUnitPrice(event.target.value); }} required step="0.01" value={unitPrice} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.discountType}</span><select className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} onChange={(event) => { invalidateConfirmation(); setDiscountKind(event.target.value as typeof discountKind); }} value={discountKind}><option value="none">{copy.noDiscount}</option><option value="percent">{copy.percentDiscount}</option><option value="fixed">{copy.fixedDiscount}</option></select></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.discountValue}</span><input className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy || discountKind === "none"} inputMode="decimal" min="0" onChange={(event) => { invalidateConfirmation(); setDiscountValue(event.target.value); }} step="0.01" value={discountValue} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avansas / forskudd (%)</span><input className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} inputMode="decimal" max="100" min="0" onChange={(event) => { invalidateConfirmation(); setDepositPercent(event.target.value); }} step="0.01" value={depositPercent} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.recommendedOption}</span><select className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={busy} onChange={(event) => { invalidateConfirmation(); setRecommendedService(event.target.value); }} value={recommendedService}><option value="">{copy.noRecommendedOption}</option>{props.rules.filter((rule) => rule.serviceKey !== props.currentService).map((rule) => <option key={rule.serviceKey} value={rule.serviceKey}>{rule.serviceName}</option>)}</select></label>
      <label className="grid gap-1.5 sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.commercialReason}</span><textarea className="min-h-24 rounded-xl border border-white/10 bg-[#0d1118] p-3" disabled={busy} maxLength={500} minLength={10} onChange={(event) => { invalidateConfirmation(); setReason(event.target.value); }} placeholder={copy.commercialReasonPlaceholder} required value={reason} /></label>
    </div>
    {recommendation || suggestedRecommendation ? <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4 text-sm"><strong>{recommendation ? recommendation.serviceName : `${copy.suggestedRecommendation}: ${suggestedRecommendation?.serviceName}`}</strong><p className="mt-2 text-muted-foreground">{copy.recommendationCopy}</p>{!recommendation ? <p className="mt-2 font-semibold text-accent">{copy.recommendationNotIncluded}</p> : null}</div> : null}
    <p className="mt-3 text-xs text-muted-foreground">{copy.recommendationHelp} {copy.discountSafety}</p>
    {dirty ? <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">{copy.unsavedCommercialChanges}</p> : null}
    <button className="mt-4 min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60" disabled={busy || reason.trim().length < 10} onClick={prepareConfirmation} type="button">{busy ? copy.processing : copy.reviewCommercialPackage}</button>
    {confirmOpen ? <div aria-labelledby="commercial-confirm-title" className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4" ref={confirmationRef} role="alertdialog" tabIndex={-1}>
      <strong id="commercial-confirm-title">{copy.commercialConfirmTitle}</strong>
      <p className="mt-2 text-sm text-muted-foreground">{copy.commercialConfirm}</p>
      <dl className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3 text-sm">
        <div><dt className="text-muted-foreground">{copy.originalOption}</dt><dd className="font-bold">{defaultRule?.serviceName || props.currentService}</dd></div>
        {recommendation ? <div><dt className="text-muted-foreground">{copy.recommendedOption}</dt><dd className="font-bold">{recommendation.serviceName}</dd></div> : null}
        <div><dt className="text-muted-foreground">{copy.commercialReason}</dt><dd>{reason}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="min-h-12 rounded-xl border border-white/15 px-5 font-bold" onClick={() => setConfirmOpen(false)} type="button">{copy.commercialCancel}</button>
        <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover" onClick={() => void submit()} type="button">{copy.commercialConfirmAction}</button>
      </div>
    </div> : null}
    {notice ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </div>;
}
