"use client";

import { useState } from "react";

export function GenerateBlogDraftButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function generate() {
    setState("busy");
    setMessage("");
    try {
      const response = await fetch("/api/admin/blog/generate", { method: "POST" });
      const body = (await response.json()) as { error?: string; postId?: number | string };
      if (!response.ok) throw new Error(body.error || "Utkastet kunne ikke opprettes");
      setState("done");
      setMessage(`Nytt utkast er opprettet${body.postId ? ` (#${body.postId})` : ""}.`);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Utkastet kunne ikke opprettes",
      );
    }
  }

  return (
    <div className="blog-generate-action">
      <button type="button" disabled={state === "busy"} onClick={generate}>
        {state === "busy" ? "Oppretter utkast …" : "Opprett AI-utkast"}
      </button>
      {message ? <p className={state === "error" ? "is-error" : ""} role="status">{message}</p> : null}
    </div>
  );
}
