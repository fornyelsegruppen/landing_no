"use client";

import { useState, type FormEvent } from "react";

export function BlogTopicTools() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(source: "manual" | "search-console") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/blog/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const result = (await response.json()) as { error?: string; created?: number; accepted?: number };
      if (!response.ok) throw new Error(result.error || "Oppdatering feilet");
      setMessage(`Ferdig. ${result.created ?? result.accepted ?? 0} nye temaforslag.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Oppdatering feilet");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/blog/topics", { method: "POST", body: form });
      const result = (await response.json()) as { error?: string; accepted?: number; filtered?: number };
      if (!response.ok) throw new Error(result.error || "Import feilet");
      setMessage(`Importert: ${result.accepted || 0}. Filtrert: ${result.filtered || 0}.`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import feilet");
    } finally {
      setBusy(false);
    }
  }

  async function refreshPerformance() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/blog/performance", { method: "POST" });
      const result = (await response.json()) as { error?: string; updated?: number };
      if (!response.ok) throw new Error(result.error || "Rapportoppdatering feilet");
      setMessage(`Resultatdata oppdatert for ${result.updated || 0} artikler.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rapportoppdatering feilet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blog-topic-tools">
      <div className="blog-topic-tools__actions">
        <button disabled={busy} onClick={() => refresh("manual")} type="button">Opprett godkjent fagplan</button>
        <button disabled={busy} onClick={() => refresh("search-console")} type="button">Hent Search Console</button>
        <button disabled={busy} onClick={refreshPerformance} type="button">Oppdater innholdsrapport</button>
      </div>
      <form onSubmit={upload}>
        <label>
          Datakilde
          <select defaultValue="ads" name="source">
            <option value="ads">Google Ads CSV</option>
            <option value="trends">Google Trends CSV</option>
            <option value="search-console">Search Console CSV</option>
          </select>
        </label>
        <label>
          CSV-fil
          <input accept=".csv,text/csv" name="file" required type="file" />
        </label>
        <button disabled={busy} type="submit">Importer sikre signaler</button>
      </form>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
