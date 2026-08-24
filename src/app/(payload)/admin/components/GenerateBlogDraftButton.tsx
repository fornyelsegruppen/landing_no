"use client";

import { useState } from "react";
import { useTranslation } from "@payloadcms/ui";
import { getAdminBlogCopy } from "@/lib/admin-blog-i18n";

export function GenerateBlogDraftButton() {
  const { i18n } = useTranslation();
  const copy = getAdminBlogCopy(i18n.language);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function generate() {
    setState("busy");
    setMessage("");
    try {
      const response = await fetch("/api/admin/blog/generate", { method: "POST" });
      const body = (await response.json()) as { error?: string; postId?: number | string };
      if (!response.ok) throw new Error(body.error || copy.draftFailed);
      setState("done");
      setMessage(`${copy.draftCreated}${body.postId ? ` (#${body.postId})` : ""}.`);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : copy.draftFailed,
      );
    }
  }

  return (
    <div className="blog-generate-action">
      <button type="button" disabled={state === "busy"} onClick={generate}>
        {state === "busy" ? copy.creatingDraft : copy.createDraft}
      </button>
      {message ? <p className={state === "error" ? "is-error" : ""} role="status">{message}</p> : null}
    </div>
  );
}
