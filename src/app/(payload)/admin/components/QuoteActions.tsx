"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

export const QuoteActions: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function action(name: "approve" | "issue" | "regenerate_link" | "revoke") {
    if (!id || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name }) });
      const result = await response.json() as { error?: string; previewUrl?: string };
      if (!response.ok) throw new Error(result.error ?? "Handlingen feilet");
      setNotice(result.previewUrl ? `Kundelenken er opprettet og ligger i et meldingsutkast: ${result.previewUrl}` : "Handlingen er fullført.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Handlingen feilet"); }
    finally { setBusy(false); }
  }

  if (!id) return <p>Tilbud opprettes fra en godkjent prisberegning.</p>;
  return <section className="measurement-actions">
    <h3>Tilbud og kundelenke</h3>
    <p>Status: <strong>{String(status)}</strong>. Kunden kan ikke se tilbudet før administrator har godkjent og utstedt lenken.</p>
    <div className="measurement-actions__buttons">
      <button type="button" disabled={busy || status !== "draft"} onClick={() => action("approve")}>Godkjenn tilbud</button>
      <button type="button" disabled={busy || status !== "approved"} onClick={() => action("issue")}>Lag kundelenke og meldingsutkast</button>
      <button type="button" disabled={busy || !["sent", "viewed"].includes(String(status))} onClick={() => action("regenerate_link")}>Erstatt kundelenke</button>
      <button type="button" disabled={busy || ["accepted", "declined", "revoked"].includes(String(status))} onClick={() => action("revoke")}>Tilbakekall</button>
    </div>
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
};

export default QuoteActions;
