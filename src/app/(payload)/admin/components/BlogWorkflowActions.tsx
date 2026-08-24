"use client";

import { useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields, useTranslation } from "@payloadcms/ui";
import { getAdminBlogCopy } from "@/lib/admin-blog-i18n";

export const BlogWorkflowActions: UIFieldClientComponent = () => {
  const { i18n } = useTranslation();
  const copy = getAdminBlogCopy(i18n.language);
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.editorialStatus?.value);
  const [reviewerName, setReviewerName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(
    action:
      | "approve"
      | "reject"
      | "schedule"
      | "publish"
      | "regenerate"
      | "stock-image",
  ) {
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
          ...(action === "stock-image" && stockQuery.trim()
            ? { query: stockQuery.trim() }
            : {}),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        photographer?: string;
      };
      if (!response.ok) throw new Error(body.error || copy.actionFailed);
      setMessage(
        action === "stock-image"
          ? copy.stockDone(body.photographer)
          : copy.actionDone,
      );
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!id) {
    return (
      <p>{copy.saveFirst}</p>
    );
  }

  return (
    <section
      className="blog-workflow-actions"
      aria-labelledby="blog-workflow-title"
    >
      <h3 id="blog-workflow-title">{copy.editorialActions}</h3>
      <p>
        {copy.currentStatus}: <strong>{String(status || "draft")}</strong>. {copy.aiNeverPublishes}
      </p>
      <p>{copy.reviewHelp}</p>
      <div className="blog-workflow-actions__inputs">
        <label>
          {copy.reviewer}
          <input
            value={reviewerName}
            onChange={(event) => setReviewerName(event.target.value)}
          />
        </label>
        <label>
          {copy.scheduled}
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </label>
        <label>
          {copy.stockSearch}
          <input
            value={stockQuery}
            onChange={(event) => setStockQuery(event.target.value)}
            placeholder={copy.stockPlaceholder}
          />
        </label>
      </div>
      <div className="blog-workflow-actions__buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => act("stock-image")}
        >
          {copy.stockImage}
        </button>
        <button type="button" disabled={busy} onClick={() => act("approve")}>
          {copy.approve}
        </button>
        <button type="button" disabled={busy} onClick={() => act("schedule")}>
          {copy.schedule}
        </button>
        <button type="button" disabled={busy} onClick={() => act("publish")}>
          {copy.publish}
        </button>
        <button type="button" disabled={busy} onClick={() => act("regenerate")}>
          {copy.regenerate}
        </button>
        <button
          type="button"
          disabled={busy}
          className="is-danger"
          onClick={() => act("reject")}
        >
          {copy.reject}
        </button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
};

export default BlogWorkflowActions;
