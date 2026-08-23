"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

export const WorkOrderChangeAction: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo(); const status = useFormFields(([fields]) => fields.status?.value); const outcome = useFormFields(([fields]) => fields.priceOutcome?.value);
  const [total, setTotal] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  async function create() {
    if (!id || busy) return; setBusy(true); setNotice("");
    try {
      const nok = total.trim() ? Number(total.replace(",", ".")) : undefined;
      const response = await fetch("/api/admin/change-agreements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId: Number(id), ...(nok !== undefined ? { proposedTotalIncVatOre: Math.round(nok * 100) } : {}), ...(reason.trim() ? { reasonDescription: reason.trim() } : {}) }) });
      const result = await response.json() as { agreementId?: number; error?: string }; if (!response.ok || !result.agreementId) throw new Error(result.error || "Kunne ikke opprette endringsavtale");
      window.location.href = `/admin/collections/change-agreements/${result.agreementId}`;
    } catch (error) { setNotice(error instanceof Error ? error.message : "Handlingen feilet"); setBusy(false); }
  }
  if (!id) return null;
  return <section className="measurement-actions"><h3>Endringsavtale</h3><p>Kun pris-/omfangsavvik. HMS-risiko kan ikke godkjennes her.</p>{outcome === "scope_change" ? <><label>Ny total inkl. mva. (NOK)<input inputMode="decimal" min="1" onChange={(event) => setTotal(event.target.value)} step="0.01" type="number" value={total} /></label><label>Årsak<textarea maxLength={2000} onChange={(event) => setReason(event.target.value)} value={reason} /></label></> : null}<button disabled={busy || status !== "blocked" || outcome === "hms_blocked"} onClick={create} type="button">Opprett endringsutkast</button>{notice ? <p role="alert">{notice}</p> : null}</section>;
};
export default WorkOrderChangeAction;
