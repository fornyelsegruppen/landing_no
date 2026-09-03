"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import {
  blogEditorActionRequest,
  type BlogEditorAction,
} from "@/lib/admin-v2/blog-action-request";
import type { PanelLocale } from "@/lib/panel-i18n";

type Props = {
  contentNo: string;
  excerptNo?: string;
  id: number;
  locale: PanelLocale;
  primaryKeyword?: string;
  publishEligible?: boolean;
  qualityPassed?: boolean;
  qualityScore?: number | null;
  reviewerName: string;
  seoDescriptionNo?: string;
  seoTitleNo?: string;
  status?: string;
  titleNo: string;
};
export function BlogEditor(props: Props) {
  const copy = getAdminV2Copy(props.locale).blogAdmin;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const publishDisabled = busy || !props.publishEligible;
  const [form, setForm] = useState({
    titleNo: props.titleNo,
    excerptNo: props.excerptNo || "",
    contentNo: props.contentNo,
    seoTitleNo: props.seoTitleNo || "",
    seoDescriptionNo: props.seoDescriptionNo || "",
    primaryKeyword: props.primaryKeyword || "",
    reviewerName: props.reviewerName,
    scheduledAt: "",
    query: "",
  });
  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setForm((current) => ({ ...current, [key]: event.target.value })),
    };
  }
  async function act(action: BlogEditorAction) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const body = blogEditorActionRequest(action, form);
      const response = await fetch(`/api/admin/blog/posts/${props.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed");
      setNotice(copy.actionDone);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <section className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-6">
        <h2 className="text-xl font-bold">{copy.edit}</h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.titleNo}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              {...field("titleNo")}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.excerptNo}
            </span>
            <textarea
              className="min-h-24 rounded-xl border border-white/10 bg-black/15 p-3"
              {...field("excerptNo")}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.contentNo}
            </span>
            <textarea
              className="min-h-[32rem] rounded-xl border border-white/10 bg-black/15 p-3 font-mono text-sm leading-relaxed"
              {...field("contentNo")}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs font-bold uppercase">
                {copy.seoTitleNo}
              </span>
              <input
                className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
                {...field("seoTitleNo")}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs font-bold uppercase">
                {copy.keyword}
              </span>
              <input
                className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
                {...field("primaryKeyword")}
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.seoDescriptionNo}
            </span>
            <textarea
              className="min-h-24 rounded-xl border border-white/10 bg-black/15 p-3"
              {...field("seoDescriptionNo")}
            />
          </label>
          <button
            className="bg-accent text-accent-foreground min-h-12 w-fit rounded-xl px-5 font-bold disabled:opacity-60"
            disabled={busy}
            onClick={() => void act("save")}
            type="button"
          >
            {copy.save}
          </button>
        </div>
      </section>
      <section className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.reviewer}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              {...field("reviewerName")}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.scheduleAt}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              type="datetime-local"
              {...field("scheduledAt")}
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              Pexels
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              {...field("query")}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="min-h-11 rounded-xl border border-white/15 px-4 font-bold"
            disabled={busy}
            onClick={() => void act("stock-image")}
            type="button"
          >
            {copy.stock}
          </button>
          <button
            className="min-h-11 rounded-xl border border-white/15 px-4 font-bold"
            disabled={busy}
            onClick={() => void act("regenerate")}
            type="button"
          >
            {copy.regenerate}
          </button>
          <button
            className="border-accent/50 text-accent min-h-11 rounded-xl border px-4 font-bold"
            disabled={busy}
            onClick={() => void act("approve")}
            type="button"
          >
            {copy.approve}
          </button>
          <button
            className="border-accent/50 text-accent min-h-11 rounded-xl border px-4 font-bold"
            disabled={busy || !form.scheduledAt}
            onClick={() => void act("schedule")}
            type="button"
          >
            {copy.schedule}
          </button>
          <button
            className="bg-accent text-accent-foreground min-h-11 rounded-xl px-4 font-bold"
            disabled={publishDisabled}
            onClick={() => void act("publish")}
            type="button"
          >
            {copy.publish}
          </button>
          <button
            className="border-danger/40 text-danger min-h-11 rounded-xl border px-4 font-bold"
            disabled={busy}
            onClick={() => void act("reject")}
            type="button"
          >
            {copy.reject}
          </button>
        </div>
        {notice ? (
          <p className="text-muted-foreground mt-4 text-sm" role="status">
            {notice}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-3 text-sm">
          {props.publishEligible
            ? copy.publishHintReady
            : copy.publishHintBlocked}
          {typeof props.qualityScore === "number"
            ? ` ${copy.quality}: ${props.qualityScore}.`
            : ""}
          {props.qualityPassed === false ? ` ${copy.qualityFailed}.` : ""}
        </p>
      </section>
    </div>
  );
}
