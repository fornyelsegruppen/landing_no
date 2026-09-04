"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileCheck2,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  Send,
} from "lucide-react";
import { useState } from "react";
import type {
  AdminNextCaseCommunication,
  AdminNextCaseCommunicationPage,
} from "@/lib/admin-next/case-workspace-contract";
import type { PanelLocale } from "@/lib/panel-i18n";

type CommunicationCopy = {
  allLoaded: string;
  attachments: string;
  deliveredAt: string;
  empty: string;
  inbound: string;
  loadFailed: string;
  loadingOlder: string;
  of: string;
  openThread: string;
  outbound: string;
  replyTo: string;
  sentAt: string;
  showOlder: string;
  title: string;
};

function timestamp(locale: PanelLocale, value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    locale === "nb" ? "nb-NO" : locale === "lt" ? "lt-LT" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    },
  ).format(date);
}

function isCommunicationPage(
  value: unknown,
): value is AdminNextCaseCommunicationPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.items)) return false;
  if (
    !page.pageInfo ||
    typeof page.pageInfo !== "object" ||
    Array.isArray(page.pageInfo)
  ) {
    return false;
  }
  const info = page.pageInfo as Record<string, unknown>;
  const loadMoreHref = info.loadMoreHref;
  return (
    typeof info.remainingCount === "number" &&
    typeof info.totalCount === "number" &&
    (typeof info.nextCursor === "string" || info.nextCursor === null) &&
    (loadMoreHref === null ||
      (typeof loadMoreHref === "string" &&
        /^\/api\/admin-next\/cases\/\d+\/communications$/u.test(loadMoreHref)))
  );
}

export function AdminNextCaseCommunications({
  copy,
  initialItems,
  initialPageInfo,
  locale,
}: {
  copy: CommunicationCopy;
  initialItems: readonly AdminNextCaseCommunication[];
  initialPageInfo?: AdminNextCaseCommunicationPage["pageInfo"];
  locale: PanelLocale;
}) {
  const [items, setItems] = useState([...initialItems]);
  const [pageInfo, setPageInfo] = useState(
    initialPageInfo || {
      totalCount: initialItems.length,
      remainingCount: 0,
      nextCursor: null,
      loadMoreHref: null,
    },
  );
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function loadOlder() {
    if (state === "loading" || !pageInfo.loadMoreHref || !pageInfo.nextCursor) {
      return;
    }
    setState("loading");
    try {
      const response = await fetch(
        `${pageInfo.loadMoreHref}?cursor=${encodeURIComponent(pageInfo.nextCursor)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const body: unknown = await response.json();
      if (!response.ok || !isCommunicationPage(body)) {
        throw new Error("COMMUNICATION_PAGE_UNAVAILABLE");
      }
      setItems((current) => {
        const known = new Set(current.map(({ id }) => id));
        return [
          ...current,
          ...body.items.filter((item) => !known.has(item.id)),
        ];
      });
      setPageInfo(body.pageInfo);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="min-w-0" aria-labelledby="case-communications-title">
      <h3
        className="flex items-center gap-2 text-sm font-bold text-[var(--an-text)]"
        id="case-communications-title"
      >
        <MessageSquareText
          aria-hidden="true"
          className="size-4 text-[var(--an-amber)]"
        />
        {copy.title} · {items.length} {copy.of} {pageInfo.totalCount}
      </h3>
      {items.length ? (
        <ol
          className="mt-3 max-h-[42rem] space-y-3 overflow-auto pr-1"
          data-customer-communications
        >
          {items.map((message) => {
            const DirectionIcon =
              message.direction === "inbound" ? Inbox : Send;
            return (
              <li key={message.id}>
                <article className="an-elevated rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-bold text-[var(--an-amber)]">
                        <DirectionIcon
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                        {message.direction === "inbound"
                          ? copy.inbound
                          : copy.outbound}
                      </p>
                      <h4 className="mt-2 text-sm font-bold break-words text-[var(--an-text)]">
                        {message.subject}
                      </h4>
                    </div>
                    <span className="shrink-0 rounded-full border border-[var(--an-border)] bg-[var(--an-surface)] px-2 py-1 text-[10px] font-bold text-[var(--an-muted)]">
                      {message.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--an-subtle)]">
                    {message.channel} · {message.category} ·{" "}
                    {timestamp(locale, message.at)}
                  </p>
                  <p className="mt-3 max-h-40 overflow-auto rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-3 text-sm leading-6 break-words whitespace-pre-wrap text-[var(--an-muted)]">
                    {message.bodyText || "—"}
                  </p>
                  {message.attachments.length ? (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold tracking-wider text-[var(--an-subtle)] uppercase">
                        {copy.attachments} · {message.attachments.length}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((item) => (
                          <li key={item.id}>
                            <Link
                              className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-[var(--an-border)] bg-[var(--an-surface)] px-2 text-xs font-bold text-[var(--an-text)] hover:border-[var(--an-amber)] hover:text-[var(--an-amber)]"
                              href={item.href}
                              target="_blank"
                            >
                              <FileCheck2
                                aria-hidden="true"
                                className="size-3.5 shrink-0"
                              />
                              <span className="truncate">{item.filename}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--an-subtle)]">
                      {message.sentAt ? (
                        <div>
                          <dt className="inline font-bold">{copy.sentAt}: </dt>
                          <dd className="inline">
                            {timestamp(locale, message.sentAt)}
                          </dd>
                        </div>
                      ) : null}
                      {message.deliveredAt ? (
                        <div>
                          <dt className="inline font-bold">
                            {copy.deliveredAt}:{" "}
                          </dt>
                          <dd className="inline">
                            {timestamp(locale, message.deliveredAt)}
                          </dd>
                        </div>
                      ) : null}
                      {message.replyToMessageId ? (
                        <div>
                          <dt className="inline font-bold">{copy.replyTo}: </dt>
                          <dd className="inline">
                            #{message.replyToMessageId}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    <Link
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[var(--an-amber)] hover:bg-[var(--an-amber-soft)]"
                      href={message.fallbackHref}
                    >
                      {copy.openThread}
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4 text-sm text-[var(--an-muted)]">
          {copy.empty}
        </p>
      )}

      {pageInfo.remainingCount > 0 &&
      pageInfo.loadMoreHref &&
      pageInfo.nextCursor ? (
        <div className="mt-3">
          <button
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-elevated)] px-4 text-sm font-bold text-[var(--an-text)] hover:border-[var(--an-amber)] hover:text-[var(--an-amber)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)] disabled:cursor-wait disabled:opacity-65"
            data-load-older-communications
            disabled={state === "loading"}
            onClick={loadOlder}
            type="button"
          >
            {state === "loading" ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {state === "loading" ? copy.loadingOlder : copy.showOlder} (
            {pageInfo.remainingCount})
          </button>
          <p
            aria-live="polite"
            className={`mt-2 text-center text-xs ${state === "error" ? "text-[var(--an-danger)]" : "text-[var(--an-subtle)]"}`}
          >
            {state === "error"
              ? copy.loadFailed
              : `${items.length} ${copy.of} ${pageInfo.totalCount}`}
          </p>
        </div>
      ) : items.length ? (
        <p
          className="mt-3 text-center text-xs text-[var(--an-subtle)]"
          data-communication-history-complete
        >
          {copy.allLoaded} · {items.length} {copy.of} {pageInfo.totalCount}
        </p>
      ) : null}
    </section>
  );
}
