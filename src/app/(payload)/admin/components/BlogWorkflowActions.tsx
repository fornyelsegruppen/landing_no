"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

export const BlogWorkflowActions: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.editorialStatus?.value);
  const [reviewerName, setReviewerName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject" | "schedule" | "publish" | "regenerate") {
    if (!id || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/blog/posts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(reviewerName ? { reviewerName } : {}),
          ...(scheduledAt
            ? { scheduledAt: new Date(scheduledAt).toISOString() }
            : {}),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Handlingen feilet");
      setMessage("Handlingen er fullført. Siden oppdateres …");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Handlingen feilet");
    } finally {
      setBusy(false);
    }
  }

  if (!id) {
    return <p>Lagre utkastet før redaksjonelle handlinger blir tilgjengelige.</p>;
  }

  return (
    <section className="blog-workflow-actions" aria-labelledby="blog-workflow-title">
      <h3 id="blog-workflow-title">Redaksjonelle handlinger</h3>
      <p>
        Nåværende status: <strong>{String(status || "draft")}</strong>. AI kan aldri publisere uten godkjenning her.
      </p>
      <div className="blog-workflow-actions__inputs">
        <label>
          Faglig kontrollør
          <input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} />
        </label>
        <label>
          Planlagt publisering
          <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
        </label>
      </div>
      <div className="blog-workflow-actions__buttons">
        <button type="button" disabled={busy} onClick={() => act("approve")}>Godkjenn</button>
        <button type="button" disabled={busy} onClick={() => act("schedule")}>Planlegg</button>
        <button type="button" disabled={busy} onClick={() => act("publish")}>Publiser nå</button>
        <button type="button" disabled={busy} onClick={() => act("regenerate")}>Regenerer utkast</button>
        <button type="button" disabled={busy} className="is-danger" onClick={() => act("reject")}>Avvis</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
};

export default BlogWorkflowActions;
