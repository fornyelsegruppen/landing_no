"use client";

import { useCallback, useEffect, useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

type Message = {
  id: number;
  category: string;
  channel: string;
  subject: string;
  bodyText: string;
  status: string;
  aiAssisted?: boolean;
  createdAt: string;
  sentAt?: string | null;
  failureMessage?: string | null;
};

export const LeadWorkflowActions: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const response = await fetch(`/api/admin/leads/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const result = (await response.json()) as { messages: Message[] };
    setMessages(result.messages);
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(action: "generate_reply" | "approve_send" | "retry_send" | "request_information" | "start_measurement" | "close", messageId?: number) {
    if (!id || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(messageId ? { messageId } : {}) }),
      });
      const result = (await response.json()) as { error?: string; sent?: boolean; configurationRequired?: boolean };
      if (!response.ok) throw new Error(result.error || "Handlingen feilet");
      setNotice(result.configurationRequired ? "Godkjent og lagt i kø. E-postleverandøren må konfigureres." : result.sent ? "Meldingen er sendt." : "Handlingen er fullført.");
      await load();
      if (["start_measurement", "close"].includes(action)) window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Handlingen feilet");
    } finally {
      setBusy(false);
    }
  }

  if (!id) return <p>Lagre henvendelsen før arbeidsflyten blir tilgjengelig.</p>;

  return (
    <section className="lead-workflow-actions" aria-labelledby="lead-workflow-title">
      <div className="lead-workflow-actions__header">
        <div>
          <h3 id="lead-workflow-title">Henvendelsesflyt</h3>
          <p>Status: <strong>{String(status || "new")}</strong>. AI lager bare utkast.</p>
        </div>
        <div className="lead-workflow-actions__buttons">
          <button disabled={busy} onClick={() => act("generate_reply")} type="button">Lag AI-svarutkast</button>
          <button disabled={busy} onClick={() => act("request_information")} type="button">Be om informasjon</button>
          <button disabled={busy} onClick={() => act("start_measurement")} type="button">Start måling</button>
          <button className="is-danger" disabled={busy} onClick={() => act("close")} type="button">Lukk</button>
        </div>
      </div>
      <div className="lead-workflow-actions__timeline">
        {messages.length ? messages.map((message) => (
          <article key={message.id}>
            <div><strong>{message.subject}</strong><span>{message.category} · {message.channel} · {message.status}</span></div>
            <p>{message.bodyText}</p>
            {message.failureMessage ? <p className="is-danger">{message.failureMessage}</p> : null}
            {message.status === "draft" ? (
              <div className="lead-workflow-actions__message-actions">
                <a href={`/admin/collections/messages/${message.id}`}>Rediger utkast</a>
                <button disabled={busy} onClick={() => act("approve_send", message.id)} type="button">Godkjenn og send</button>
              </div>
            ) : null}
            {["attention", "failed"].includes(message.status) ? (
              <div className="lead-workflow-actions__message-actions">
                <a href={`/admin/collections/messages/${message.id}`}>Se leveringsfeil</a>
                <button disabled={busy} onClick={() => act("retry_send", message.id)} type="button">Prøv sending igjen</button>
              </div>
            ) : null}
          </article>
        )) : <p>Ingen meldinger er opprettet ennå.</p>}
      </div>
      {notice ? <p aria-live="polite" role="status">{notice}</p> : null}
    </section>
  );
};

export default LeadWorkflowActions;
