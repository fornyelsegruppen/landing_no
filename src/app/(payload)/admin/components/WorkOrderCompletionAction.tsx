"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

export const WorkOrderCompletionAction: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  if (!id || status !== "documented") return null;

  async function send() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/work-orders/${id}/completion-communication`,
        { method: "POST" },
      );
      const result = (await response.json()) as {
        delivered?: boolean;
        queued?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Kunne ikke sende ferdigmeldingen");
      }
      setNotice(
        result.delivered
          ? "Ferdigmeldingen er sendt."
          : "Ferdigmeldingen er lagt i kø for nytt forsøk.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Handlingen feilet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="measurement-actions">
      <h3>Ferdigmelding til kunden</h3>
      <p>
        Sender signert kontrakt og registrerte etterbilder. Gjentatt handling er
        idempotent og sender ikke samme melding to ganger.
      </p>
      <button disabled={busy} onClick={send} type="button">
        {busy ? "Sender …" : "Send eller kontroller ferdigmelding"}
      </button>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
};

export default WorkOrderCompletionAction;
