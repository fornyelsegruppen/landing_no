"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";
import { useRouter } from "next/navigation";

export const ContractWorkOrderAction: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const router = useRouter();
  const status = useFormFields(([fields]) => fields.status?.value);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function create() {
    if (!id || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/work-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId: Number(id) }) });
      const result = await response.json() as { workOrderId?: number; error?: string };
      if (!response.ok || !result.workOrderId) throw new Error(result.error ?? "Kunne ikke opprette oppdrag");
      router.push(`/admin/collections/work-orders/${result.workOrderId}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Handlingen feilet"); setBusy(false); }
  }
  return <section className="measurement-actions">
    <h3>Arbeidsordre</h3>
    <p>Opprett et oppdrag fra denne signerte kontrakten. Ansatt og dato settes på oppdraget.</p>
    <button type="button" disabled={busy || status !== "signed"} onClick={create}>Opprett eller åpne arbeidsordre</button>
    {notice ? <p role="alert">{notice}</p> : null}
  </section>;
};

export default ContractWorkOrderAction;
