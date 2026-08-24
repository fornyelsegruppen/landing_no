"use client";

import { useState, type FormEvent } from "react";
import { useTranslation } from "@payloadcms/ui";
import { getAdminBlogCopy } from "@/lib/admin-blog-i18n";

export function BlogTopicTools() {
  const { i18n } = useTranslation();
  const copy = getAdminBlogCopy(i18n.language);
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
      if (!response.ok) throw new Error(result.error || copy.refreshFailed);
      setMessage(copy.topicsDone(result.created ?? result.accepted ?? 0));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.refreshFailed);
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
      if (!response.ok) throw new Error(result.error || copy.importFailed);
      setMessage(copy.imported(result.accepted || 0, result.filtered || 0));
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.importFailed);
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
      if (!response.ok) throw new Error(result.error || copy.reportFailed);
      setMessage(copy.reportDone(result.updated || 0));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.reportFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blog-topic-tools">
      <div className="blog-topic-tools__actions">
        <button disabled={busy} onClick={() => refresh("manual")} type="button">{copy.plan}</button>
        <button disabled={busy} onClick={() => refresh("search-console")} type="button">{copy.searchConsole}</button>
        <button disabled={busy} onClick={refreshPerformance} type="button">{copy.report}</button>
      </div>
      <form onSubmit={upload}>
        <label>
          {copy.source}
          <select defaultValue="ads" name="source">
            <option value="ads">Google Ads CSV</option>
            <option value="trends">Google Trends CSV</option>
            <option value="search-console">Search Console CSV</option>
          </select>
        </label>
        <label>
          {copy.csvFile}
          <input accept=".csv,text/csv" name="file" required type="file" />
        </label>
        <button disabled={busy} type="submit">{copy.importSignals}</button>
      </form>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
