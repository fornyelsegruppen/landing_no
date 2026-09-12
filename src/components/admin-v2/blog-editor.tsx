"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { blogEditorCopies } from "@/lib/admin-v2/blog-editor-copy";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import {
  blogEditorActionRequest,
  type BlogEditorAction,
} from "@/lib/admin-v2/blog-action-request";
import {
  blogEditorActionIsBlocked,
  blogEditorIsDirty,
  initialBlogEditorForm,
  reconcileCleanBlogEditorForm,
  savedBlogEditorFields,
  type BlogEditorForm,
} from "@/lib/admin-v2/blog-editor-state";
import {
  blogEditorRefreshState,
  BLOG_EDITOR_REFRESH_RECOVERY_MS,
} from "@/lib/admin-v2/blog-editor-refresh-state";
import type { PanelLocale } from "@/lib/panel-i18n";

type QualityIssue = {
  code?: string;
  severity?: "blocker" | "warning" | "info" | string;
  message?: string;
};
type BlogActionResponse = {
  action?: BlogEditorAction;
  code?: string;
  correlationId?: string;
  error?: string;
  ok?: boolean;
  outcome?: string;
  photographer?: string;
  qualityIssues?: QualityIssue[];
  runId?: number | string;
};
type Feedback = {
  kind: "error" | "info" | "success" | "warning";
  message: string;
  result?: BlogActionResponse;
};

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
  updatedAt?: string;
};

function safeResponse(value: unknown): BlogActionResponse {
  return value && typeof value === "object"
    ? (value as BlogActionResponse)
    : {};
}

function runHref(value: BlogActionResponse["runId"]) {
  const runId = String(value || "");
  return /^\d+$/.test(runId) ? `/admin/collections/seo-runs/${runId}` : null;
}

export function BlogEditor(props: Props) {
  const copy = blogEditorCopies[props.locale];
  const core = getAdminV2Copy(props.locale).blogAdmin;
  const router = useRouter();
  const incoming = useMemo(
    () =>
      initialBlogEditorForm({
        titleNo: props.titleNo,
        excerptNo: props.excerptNo || "",
        contentNo: props.contentNo,
        seoTitleNo: props.seoTitleNo || "",
        seoDescriptionNo: props.seoDescriptionNo || "",
        primaryKeyword: props.primaryKeyword || "",
        reviewerName: props.reviewerName,
      }),
    [
      props.contentNo,
      props.excerptNo,
      props.primaryKeyword,
      props.reviewerName,
      props.seoDescriptionNo,
      props.seoTitleNo,
      props.titleNo,
    ],
  );
  const incomingVersion = `${props.id}:${props.updatedAt || ""}`;
  const [form, setForm] = useState<BlogEditorForm>(incoming);
  const [saved, setSaved] = useState(() => savedBlogEditorFields(incoming));
  const [busyAction, setBusyAction] = useState<BlogEditorAction | null>(null);
  const [awaitingRefresh, setAwaitingRefresh] = useState(false);
  const [refreshRecoveryVisible, setRefreshRecoveryVisible] = useState(false);
  const [serverUpdatedWhileDirty, setServerUpdatedWhileDirty] = useState(false);
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(props.updatedAt);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const sourceVersion = useRef(incomingVersion);
  const dirty = blogEditorIsDirty(form, saved);
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  /* eslint-disable react-hooks/set-state-in-effect -- Server props must replace clean state only after router.refresh. */
  useEffect(() => {
    if (sourceVersion.current === incomingVersion) return;
    if (dirty) {
      setServerUpdatedWhileDirty(true);
      setFeedback({ kind: "warning", message: copy.serverUpdated });
      return;
    }
    const next = reconcileCleanBlogEditorForm(form, incoming);
    setForm(next);
    setSaved(savedBlogEditorFields(next));
    setSavedUpdatedAt(props.updatedAt);
    setServerUpdatedWhileDirty(false);
    setAwaitingRefresh(false);
    setRefreshRecoveryVisible(false);
    sourceVersion.current = incomingVersion;
  }, [
    copy.serverUpdated,
    dirty,
    form,
    incoming,
    incomingVersion,
    props.updatedAt,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const warnBeforeLinkNavigation = (event: MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target || link.href === window.location.href) return;
      if (!window.confirm(copy.discardConfirm)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeLinkNavigation, true);
    };
  }, [copy.discardConfirm]);

  useEffect(() => {
    if (!awaitingRefresh) return;
    const timeout = window.setTimeout(
      () => setRefreshRecoveryVisible(true),
      BLOG_EDITOR_REFRESH_RECOVERY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [awaitingRefresh]);

  const refreshState = blogEditorRefreshState({
    awaitingRefresh,
    refreshRecoveryVisible,
  });
  const busy = busyAction !== null || refreshState.freezeEditor;
  const needsQualityRecheck =
    props.qualityPassed !== true || typeof props.qualityScore !== "number";
  const scheduleDateIsFuture =
    Boolean(form.scheduledAt) &&
    new Date(form.scheduledAt).getTime() > currentTime;
  const scheduleDisabled =
    busy || props.status !== "approved" || !scheduleDateIsFuture;
  const publishDisabled = busy || !props.publishEligible;
  const mutedActionClass =
    "disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35 disabled:opacity-100";

  function field(key: keyof BlogEditorForm) {
    return {
      value: form[key],
      disabled: busy,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => {
        if (key === "scheduledAt") setCurrentTime(Date.now());
        setForm((current) => ({ ...current, [key]: event.target.value }));
      },
    };
  }

  function actionProgress(action: BlogEditorAction) {
    if (action === "save") return copy.saving;
    if (action === "stock-image") return copy.findingStock;
    if (action === "regenerate") return copy.regenerating;
    if (action === "approve") return copy.approving;
    if (action === "schedule") return copy.scheduling;
    if (action === "publish") return copy.publishing;
    return copy.rejecting;
  }

  function actionSuccess(action: BlogEditorAction, result: BlogActionResponse) {
    if (
      result.outcome === "NO_ALTERNATIVE" ||
      result.outcome === "no_alternative"
    )
      return copy.noAlternative;
    if (action === "save") return copy.saved;
    if (action === "stock-image") return copy.stockUpdated;
    if (action === "regenerate") return copy.regenerated;
    if (action === "approve") return copy.approved;
    if (action === "schedule") return copy.scheduled;
    if (action === "publish") return copy.published;
    return copy.rejected;
  }

  function actionError(result: BlogActionResponse) {
    if (result.code === "NO_ALTERNATIVE") return copy.noAlternative;
    if (result.code === "QUALITY_BLOCKED") return copy.qualityBlocked;
    if (result.code === "PROVIDER_UNAVAILABLE") return copy.providerUnavailable;
    if (result.code === "CONFLICT") return copy.conflict;
    return result.error || copy.actionFailed;
  }

  async function act(action: BlogEditorAction) {
    if (busy) return;
    if (blogEditorActionIsBlocked({ action, dirty, serverUpdatedWhileDirty })) {
      setFeedback({
        kind: "warning",
        message: serverUpdatedWhileDirty ? copy.serverUpdated : copy.saveFirst,
      });
      return;
    }
    if (action === "regenerate" && !window.confirm(copy.regenerationConfirm))
      return;
    setBusyAction(action);
    setFeedback({ kind: "info", message: actionProgress(action) });
    try {
      const response = await fetch(`/api/admin/blog/posts/${props.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          blogEditorActionRequest(action, form, {
            expectedUpdatedAt: savedUpdatedAt,
          }),
        ),
      });
      const result = safeResponse(await response.json().catch(() => undefined));
      if (!response.ok || result.ok !== true) {
        setFeedback({ kind: "error", message: actionError(result), result });
        return;
      }
      if (action === "save") setSaved(savedBlogEditorFields(form));
      setFeedback({
        kind: "success",
        message:
          action === "save" && !dirty
            ? copy.recheckedQuality
            : actionSuccess(action, result),
        result,
      });
      setRefreshRecoveryVisible(false);
      setAwaitingRefresh(true);
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: copy.actionFailed });
    } finally {
      setBusyAction(null);
    }
  }

  function discardChanges() {
    if (!dirty || busy || !window.confirm(copy.discardConfirm)) return;
    setForm((current) => ({ ...current, ...saved }));
    setFeedback({ kind: "info", message: copy.discarded });
  }

  function reloadLatestArticle() {
    // This only navigates to a fresh server render; it never repeats a mutation.
    window.location.reload();
  }

  const feedbackRunHref = feedback?.result
    ? runHref(feedback.result.runId)
    : null;
  const qualityIssues = feedback?.result?.qualityIssues || [];
  const actionLabel = (action: BlogEditorAction, label: string) =>
    busyAction === action ? actionProgress(action) : label;

  return (
    <div
      className="space-y-5"
      data-blog-editor-dirty={dirty ? "true" : "false"}
    >
      <section className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{core.edit}</h2>
          {dirty ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">
              {copy.unsaved}
            </span>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {core.titleNo}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              {...field("titleNo")}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {core.excerptNo}
            </span>
            <textarea
              className="min-h-24 rounded-xl border border-white/10 bg-black/15 p-3"
              {...field("excerptNo")}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {core.contentNo}
            </span>
            <textarea
              className="min-h-[32rem] rounded-xl border border-white/10 bg-black/15 p-3 font-mono text-sm leading-relaxed"
              {...field("contentNo")}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void act("save");
                }
              }}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs font-bold uppercase">
                {core.seoTitleNo}
              </span>
              <input
                className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
                {...field("seoTitleNo")}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs font-bold uppercase">
                {core.keyword}
              </span>
              <input
                className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
                {...field("primaryKeyword")}
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {core.seoDescriptionNo}
            </span>
            <textarea
              className="min-h-24 rounded-xl border border-white/10 bg-black/15 p-3"
              {...field("seoDescriptionNo")}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              className={`bg-accent text-accent-foreground min-h-12 rounded-xl px-5 font-bold ${mutedActionClass}`}
              disabled={busy || (!dirty && !needsQualityRecheck)}
              onClick={() => void act("save")}
              type="button"
            >
              {actionLabel(
                "save",
                !dirty && needsQualityRecheck ? copy.recheckQuality : core.save,
              )}
            </button>
            {dirty ? (
              <button
                className="min-h-12 rounded-xl border border-white/15 px-5 font-bold disabled:opacity-60"
                disabled={busy}
                onClick={discardChanges}
                type="button"
              >
                {copy.discard}
              </button>
            ) : null}
          </div>
        </div>
      </section>
      <section className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {core.reviewer}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              {...field("reviewerName")}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {core.scheduleAt}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              type="datetime-local"
              {...field("scheduledAt")}
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              Pexels {core.searchQuery}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              {...field("query")}
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.regenerationInstructions}
            </span>
            <textarea
              className="min-h-24 rounded-xl border border-white/10 bg-black/15 p-3"
              maxLength={2000}
              {...field("regenerationInstructions")}
            />
            <span className="text-muted-foreground text-xs">
              {copy.regenerationInstructionsHint}
            </span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-60"
            disabled={busy}
            onClick={() => void act("stock-image")}
            type="button"
          >
            {actionLabel("stock-image", core.stock)}
          </button>
          <button
            className="min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-60"
            disabled={busy}
            onClick={() => void act("regenerate")}
            type="button"
          >
            {actionLabel("regenerate", core.regenerate)}
          </button>
          <button
            className="border-accent/50 text-accent min-h-11 rounded-xl border px-4 font-bold disabled:opacity-60"
            disabled={busy}
            onClick={() => void act("approve")}
            type="button"
          >
            {actionLabel("approve", core.approve)}
          </button>
          <button
            className={`border-accent/50 text-accent min-h-11 rounded-xl border px-4 font-bold ${mutedActionClass}`}
            disabled={scheduleDisabled}
            onClick={() => void act("schedule")}
            type="button"
          >
            {actionLabel("schedule", core.schedule)}
          </button>
          <button
            className={`bg-accent text-accent-foreground min-h-11 rounded-xl px-4 font-bold ${mutedActionClass}`}
            disabled={publishDisabled}
            onClick={() => void act("publish")}
            type="button"
          >
            {actionLabel("publish", core.publish)}
          </button>
          <button
            className="border-danger/40 text-danger min-h-11 rounded-xl border px-4 font-bold disabled:opacity-60"
            disabled={busy}
            onClick={() => void act("reject")}
            type="button"
          >
            {actionLabel("reject", core.reject)}
          </button>
        </div>
        {props.status !== "approved" ? (
          <p className="text-muted-foreground mt-3 text-sm">
            {copy.scheduleNeedsApproval}
          </p>
        ) : !scheduleDateIsFuture ? (
          <p className="text-muted-foreground mt-3 text-sm">
            {copy.scheduleNeedsFutureDate}
          </p>
        ) : null}
        {!props.publishEligible ? (
          <p className="text-muted-foreground mt-3 text-sm">
            {copy.publishLocked}
          </p>
        ) : null}
        {refreshState.freezeEditor ? (
          <div
            className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-sm"
            role="status"
            aria-live="polite"
          >
            <p>
              {refreshState.showSafeReload
                ? copy.refreshDelayed
                : copy.refreshPending}
            </p>
            {refreshState.showSafeReload ? (
              <button
                className="mt-3 min-h-10 rounded-xl border border-white/15 px-4 font-bold"
                onClick={reloadLatestArticle}
                type="button"
              >
                {copy.reloadLatest}
              </button>
            ) : null}
          </div>
        ) : null}
        {feedback ? (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm ${feedback.kind === "error" ? "border-danger/40 bg-danger/10" : feedback.kind === "success" ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-black/15"}`}
            role="status"
            aria-live="polite"
          >
            <p>{feedback.message}</p>
            {qualityIssues.length ? (
              <div className="mt-3">
                <p className="font-bold">{copy.qualityFindings}</p>
                <ul className="mt-1 list-disc pl-5">
                  {qualityIssues.map((issue, index) => (
                    <li key={`${issue.code || "issue"}-${index}`}>
                      {issue.message || issue.code}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {feedbackRunHref ? (
              <a
                className="text-accent mt-3 inline-block font-bold"
                href={feedbackRunHref}
              >
                {copy.runReference}
              </a>
            ) : null}
            {feedback.result?.correlationId ? (
              <p className="text-muted-foreground mt-3 text-xs">
                {copy.correlationReference}:{" "}
                <code>{feedback.result.correlationId}</code>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
