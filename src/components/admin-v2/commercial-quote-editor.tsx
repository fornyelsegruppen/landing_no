"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

type Rule = { serviceKey: string; serviceName: string; unitPriceExVatOre: number };

export function CommercialQuoteEditor(props: {
  currentService?: string;
  leadId: number;
  locale: PanelLocale;
  rules: Rule[];
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
  const defaultRecommendation = props.currentService === "takvask" && props.rules.some((rule) => rule.serviceKey === "takvask_impregnering") ? "takvask_impregnering" : "";
  const [recommendedService, setRecommendedService] = useState(defaultRecommendation);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const recommendation = useMemo(() => props.rules.find((rule) => rule.serviceKey === recommendedService), [props.rules, recommendedService]);

  async function submit() {
    if (busy || !window.confirm(copy.commercialConfirm)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/leads/${props.leadId}/commercial-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUnitPriceExVatOre: Math.round(Number(unitPrice.replace(",", ".")) * 100),
          discountKind,
          discountValue: Number(discountValue.replace(",", ".")),
          depositPercent: Number(depositPercent.replace(",", ".")),
          reason,
          ...(recommendedService ? { recommendedServiceKey: recommendedService } : {}),
        }),
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

  return <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4" id="commercial-editor">
    <h3 className="font-bold">{copy.commercialEditor}</h3>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.unitPrice}</span><input className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" inputMode="decimal" min="0.01" onChange={(event) => setUnitPrice(event.target.value)} required step="0.01" value={unitPrice} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.discountType}</span><select className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" onChange={(event) => setDiscountKind(event.target.value as typeof discountKind)} value={discountKind}><option value="none">{copy.noDiscount}</option><option value="percent">{copy.percentDiscount}</option><option value="fixed">{copy.fixedDiscount}</option></select></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.discountValue}</span><input className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" disabled={discountKind === "none"} inputMode="decimal" min="0" onChange={(event) => setDiscountValue(event.target.value)} step="0.01" value={discountValue} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avansas / forskudd (%)</span><input className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" inputMode="decimal" max="100" min="0" onChange={(event) => setDepositPercent(event.target.value)} step="0.01" value={depositPercent} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.recommendedOption}</span><select className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3" onChange={(event) => setRecommendedService(event.target.value)} value={recommendedService}><option value="">{copy.noRecommendedOption}</option>{props.rules.filter((rule) => rule.serviceKey !== props.currentService).map((rule) => <option key={rule.serviceKey} value={rule.serviceKey}>{rule.serviceName}</option>)}</select></label>
      <label className="grid gap-1.5 sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.commercialReason}</span><textarea className="min-h-24 rounded-xl border border-white/10 bg-[#0d1118] p-3" maxLength={500} minLength={10} onChange={(event) => setReason(event.target.value)} placeholder={copy.commercialReasonPlaceholder} required value={reason} /></label>
    </div>
    {recommendation ? <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4 text-sm"><strong>{recommendation.serviceName}</strong><p className="mt-2 text-muted-foreground">{copy.recommendationCopy}</p></div> : null}
    <p className="mt-3 text-xs text-muted-foreground">{copy.recommendationHelp} {copy.discountSafety}</p>
    <button className="mt-4 min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60" disabled={busy || reason.trim().length < 10} onClick={() => void submit()} type="button">{busy ? copy.processing : copy.rebuildCommercialPackage}</button>
    {notice ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </div>;
}
