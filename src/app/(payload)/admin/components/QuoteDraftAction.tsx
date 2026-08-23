"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

export const QuoteDraftAction: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!id || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calculationId: Number(id) }) });
      const result = await response.json() as { quoteId?: number; error?: string };
      if (!response.ok || !result.quoteId) throw new Error(result.error ?? "Kunne ikke opprette tilbud");
      window.location.href = `/admin/collections/quotes/${result.quoteId}`;
    } catch (error) { setNotice(error instanceof Error ? error.message : "Handlingen feilet"); setBusy(false); }
  }
  return <section className="measurement-actions">
    <h3>Tilbudsutkast</h3>
    <p>Oppretter et låst tilbud og kontraktsutkast fra denne beregningen og gjeldende godkjente vilkår.</p>
    <button type="button" disabled={busy || status !== "ready"} onClick={create}>Opprett tilbud og kontrakt</button>
    {notice ? <p role="alert">{notice}</p> : null}
  </section>;
};
export default QuoteDraftAction;
