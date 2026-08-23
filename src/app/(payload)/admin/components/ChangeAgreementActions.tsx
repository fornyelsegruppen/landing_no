"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

export const ChangeAgreementActions: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo(); const status = useFormFields(([fields]) => fields.status?.value); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  async function action(name: "approve" | "issue" | "revoke") { if (!id || busy) return; setBusy(true); setNotice(""); try { const response = await fetch(`/api/admin/change-agreements/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name }) }); const result = await response.json() as { error?: string; previewUrl?: string }; if (!response.ok) throw new Error(result.error || "Handlingen feilet"); setNotice(result.previewUrl ? `Lenken er lagt i meldingskøen: ${result.previewUrl}` : "Handlingen er fullført."); window.setTimeout(() => window.location.reload(), 700); } catch (error) { setNotice(error instanceof Error ? error.message : "Handlingen feilet"); } finally { setBusy(false); } }
  return <section className="measurement-actions"><h3>Godkjenning og kundelenke</h3><p>Status: <strong>{String(status)}</strong></p><div className="measurement-actions__buttons"><button disabled={busy || status !== "draft"} onClick={() => action("approve")} type="button">Godkjenn endring</button><button disabled={busy || status !== "approved"} onClick={() => action("issue")} type="button">Send til kunden</button><button disabled={busy || !["draft", "approved", "sent", "viewed"].includes(String(status))} onClick={() => action("revoke")} type="button">Tilbakekall</button></div>{notice ? <p role="status">{notice}</p> : null}</section>;
};
export default ChangeAgreementActions;
