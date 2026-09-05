"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  FileCheck2,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  Send,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  AdminNextCaseCommunication,
  AdminNextCaseCommunicationPage,
} from "@/lib/admin-next/case-workspace-contract";
import type { PanelLocale } from "@/lib/panel-i18n";

type CommunicationCopy = {
  allLoaded: string;
  attachments: string;
  categoryLabels: Readonly<Record<string, string>>;
  channelLabels: Readonly<Record<string, string>>;
  customerPortal: string;
  deliveredAt: string;
  empty: string;
  inbound: string;
  loadFailed: string;
  loadingOlder: string;
  of: string;
  openThread: string;
  otherCategory: string;
  otherChannel: string;
  otherStatus: string;
  outbound: string;
  rawCategory: string;
  rawChannel: string;
  rawDirection: string;
  rawStatus: string;
  recordId: string;
  replyTo: string;
  sentAt: string;
  showOlder: string;
  statusLabels: Readonly<Record<string, string>>;
  technicalDetails: string;
  title: string;
};

const deliveryCopy = {
  nb: {
    approved: "Godkjent",
    cancelled: "Forkastet",
    contactedAt: "Kunden kontaktet",
    delivered: "Levert",
    deliveryJourney: "Leveringsforløp",
    draft: "Utkast",
    failure: "Leveringsfeil",
    hide: "Skjul detaljer",
    manualRecovery: "Manuell oppfølging",
    notRecorded: "Ikke registrert i denne historiske meldingen",
    preparedAt: "Oppfølging forberedt",
    provider: "Leverandør",
    queued: "I kø",
    recipient: "Historisk mottaker",
    resentAt: "Sendt på nytt",
    sent: "Sendt",
    show: "Vis detaljer",
  },
  lt: {
    approved: "Patvirtinta",
    cancelled: "Atšaukta",
    contactedAt: "Su klientu susisiekta",
    delivered: "Pristatyta",
    deliveryJourney: "Pristatymo eiga",
    draft: "Juodraštis",
    failure: "Pristatymo klaida",
    hide: "Slėpti informaciją",
    manualRecovery: "Rankinis susisiekimas",
    notRecorded: "Šioje istorinėje žinutėje neužregistruota",
    preparedAt: "Susisiekimas parengtas",
    provider: "Teikėjas",
    queued: "Eilėje",
    recipient: "Istorinis gavėjas",
    resentAt: "Išsiųsta dar kartą",
    sent: "Išsiųsta",
    show: "Rodyti informaciją",
  },
  en: {
    approved: "Approved",
    cancelled: "Discarded",
    contactedAt: "Customer contacted",
    delivered: "Delivered",
    deliveryJourney: "Delivery journey",
    draft: "Draft",
    failure: "Delivery failure",
    hide: "Hide details",
    manualRecovery: "Manual follow-up",
    notRecorded: "Not recorded on this historical message",
    preparedAt: "Follow-up prepared",
    provider: "Provider",
    queued: "Queued",
    recipient: "Historical recipient",
    resentAt: "Sent again",
    sent: "Sent",
    show: "Show details",
  },
} as const;

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

function deliveryStatusLabel(
  locale: PanelLocale,
  status: string,
  fallback: string,
) {
  const labels = deliveryCopy[locale];
  if (status === "draft") return labels.draft;
  if (status === "approved") return labels.approved;
  if (status === "queued") return labels.queued;
  if (status === "sent") return labels.sent;
  if (status === "delivered") return labels.delivered;
  if (status === "cancelled") return labels.cancelled;
  return fallback;
}

function communicationStatusLabel(copy: CommunicationCopy, status: string) {
  return copy.statusLabels[status] || copy.otherStatus;
}

function communicationCategoryLabel(copy: CommunicationCopy, category: string) {
  return copy.categoryLabels[category] || copy.otherCategory;
}

function communicationChannelLabel(
  copy: CommunicationCopy,
  message: AdminNextCaseCommunication,
) {
  if (
    message.direction === "inbound" &&
    message.category === "customer_question"
  ) {
    return copy.customerPortal;
  }
  return copy.channelLabels[message.channel] || copy.otherChannel;
}

function DeliveryJourney({
  copy,
  locale,
  message,
}: {
  copy: CommunicationCopy;
  locale: PanelLocale;
  message: AdminNextCaseCommunication;
}) {
  if (message.direction !== "outbound") return null;
  const labels = deliveryCopy[locale];
  const delivery = message.delivery;
  const rank = ["draft", "approved", "queued", "sent", "delivered"].indexOf(
    message.status,
  );
  const stages = [
    {
      id: "approved",
      label: labels.approved,
      at: delivery?.approvedAt,
      rank: 1,
    },
    { id: "queued", label: labels.queued, at: delivery?.queuedAt, rank: 2 },
    { id: "sent", label: labels.sent, at: message.sentAt, rank: 3 },
    {
      id: "delivered",
      label: labels.delivered,
      at: message.deliveredAt,
      rank: 4,
    },
  ] as const;
  const failed = ["failed", "attention"].includes(message.status);
  const recovery = delivery?.manualRecovery;

  return (
    <details className="group mt-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-bold text-[var(--an-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]">
        <span>{labels.deliveryJourney}</span>
        <span
          className={
            failed ? "text-[var(--an-danger)]" : "text-[var(--an-amber)]"
          }
        >
          <span className="group-open:hidden">{labels.show} · </span>
          <span className="hidden group-open:inline">{labels.hide} · </span>
          {deliveryStatusLabel(
            locale,
            message.status,
            communicationStatusLabel(copy, message.status),
          )}
        </span>
      </summary>
      <div className="border-t border-[var(--an-border)] p-3">
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-elevated)] p-2.5">
            <dt className="font-bold text-[var(--an-subtle)]">
              {labels.recipient}
            </dt>
            <dd className="mt-1 break-all text-[var(--an-text)]">
              {delivery?.recipient || labels.notRecorded}
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-elevated)] p-2.5">
            <dt className="font-bold text-[var(--an-subtle)]">
              {labels.provider}
            </dt>
            <dd className="mt-1 break-words text-[var(--an-text)]">
              {delivery?.provider || labels.notRecorded}
            </dd>
          </div>
        </dl>
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stages.map((stage) => {
            const complete = Boolean(stage.at) || rank > stage.rank;
            const current = !complete && rank === stage.rank;
            return (
              <li
                className={`rounded-lg border p-2 text-[10px] ${
                  complete
                    ? "border-[var(--an-success)] bg-[var(--an-success-soft)] text-[var(--an-success)]"
                    : current
                      ? "border-[var(--an-amber)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]"
                      : "border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-subtle)]"
                }`}
                data-delivery-stage={stage.id}
                key={stage.id}
              >
                <strong className="block">{stage.label}</strong>
                <span className="mt-1 block">
                  {stage.at ? timestamp(locale, stage.at) : "—"}
                </span>
              </li>
            );
          })}
        </ol>
        {failed ? (
          <div className="mt-3 rounded-lg border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-3 text-xs text-[var(--an-danger)]">
            <strong>{labels.failure}</strong>
            <p className="mt-1 break-words">
              {[delivery?.failureCode, delivery?.failureMessage]
                .filter(Boolean)
                .join(" · ") || labels.notRecorded}
            </p>
          </div>
        ) : null}
        {recovery ? (
          <div className="mt-3 rounded-lg border border-[var(--an-border)] bg-[var(--an-elevated)] p-3 text-xs text-[var(--an-muted)]">
            <strong className="text-[var(--an-text)]">
              {labels.manualRecovery}
              {recovery.status
                ? ` · ${communicationStatusLabel(copy, recovery.status)}`
                : ""}
              {recovery.channel
                ? ` · ${copy.channelLabels[recovery.channel] || copy.otherChannel}`
                : ""}
            </strong>
            <ul className="mt-2 space-y-1">
              {recovery.preparedAt ? (
                <li>
                  {labels.preparedAt}: {timestamp(locale, recovery.preparedAt)}
                </li>
              ) : null}
              {recovery.contactedAt ? (
                <li>
                  {labels.contactedAt}:{" "}
                  {timestamp(locale, recovery.contactedAt)}
                </li>
              ) : null}
              {recovery.resentAt ? (
                <li>
                  {labels.resentAt}: {timestamp(locale, recovery.resentAt)}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
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
  const focusCompletion = useRef(false);
  const completionStatus = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (
      state !== "idle" ||
      pageInfo.remainingCount !== 0 ||
      !focusCompletion.current
    ) {
      return;
    }
    focusCompletion.current = false;
    completionStatus.current?.focus();
  }, [pageInfo.remainingCount, state]);

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
      focusCompletion.current = body.pageInfo.remainingCount === 0;
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
        <ol className="mt-3 space-y-3" data-customer-communications>
          {items.map((message) => {
            const DirectionIcon =
              message.direction === "inbound" ? Inbox : Send;
            return (
              <li key={message.id}>
                <details
                  className="an-elevated group rounded-2xl border"
                  data-customer-message
                >
                  <summary className="flex min-h-16 cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-xs font-bold text-[var(--an-amber)]">
                        <DirectionIcon
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                        {message.direction === "inbound"
                          ? copy.inbound
                          : copy.outbound}
                      </span>
                      <strong className="mt-1.5 block text-sm break-words text-[var(--an-text)]">
                        {message.subject}
                      </strong>
                      <small className="mt-1 block text-[11px] text-[var(--an-subtle)]">
                        {communicationChannelLabel(copy, message)} ·{" "}
                        {communicationCategoryLabel(copy, message.category)} ·{" "}
                        {timestamp(locale, message.at)}
                      </small>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--an-border)] bg-[var(--an-surface)] px-2 py-1 text-[10px] font-bold text-[var(--an-muted)]">
                      {communicationStatusLabel(copy, message.status)}
                      <ChevronDown
                        aria-hidden="true"
                        className="size-3.5 transition-transform group-open:rotate-180"
                      />
                    </span>
                  </summary>
                  <div className="border-t border-[var(--an-border)] p-4">
                    <p className="rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-3 text-sm leading-6 break-words whitespace-pre-wrap text-[var(--an-muted)]">
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
                                <span className="truncate">
                                  {item.filename}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <DeliveryJourney
                      copy={copy}
                      locale={locale}
                      message={message}
                    />
                    <details
                      className="mt-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] px-3 py-2 text-[11px] text-[var(--an-subtle)]"
                      data-message-technical-diagnostics
                    >
                      <summary className="min-h-8 cursor-pointer font-bold text-[var(--an-text)]">
                        {copy.technicalDetails}
                      </summary>
                      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                        <div>
                          <dt className="inline font-bold">
                            {copy.recordId}:{" "}
                          </dt>
                          <dd className="inline break-all">{message.id}</dd>
                        </div>
                        <div>
                          <dt className="inline font-bold">
                            {copy.rawDirection}:{" "}
                          </dt>
                          <dd className="inline">{message.direction}</dd>
                        </div>
                        <div>
                          <dt className="inline font-bold">
                            {copy.rawChannel}:{" "}
                          </dt>
                          <dd className="inline">{message.channel}</dd>
                        </div>
                        <div>
                          <dt className="inline font-bold">
                            {copy.rawCategory}:{" "}
                          </dt>
                          <dd className="inline">{message.category}</dd>
                        </div>
                        <div>
                          <dt className="inline font-bold">
                            {copy.rawStatus}:{" "}
                          </dt>
                          <dd className="inline">{message.status}</dd>
                        </div>
                        {message.replyToMessageId ? (
                          <div>
                            <dt className="inline font-bold">
                              {copy.replyTo}:{" "}
                            </dt>
                            <dd className="inline">
                              #{message.replyToMessageId}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </details>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--an-subtle)]">
                        {message.sentAt ? (
                          <div>
                            <dt className="inline font-bold">
                              {copy.sentAt}:{" "}
                            </dt>
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
                      </dl>
                      <Link
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[var(--an-amber)] hover:bg-[var(--an-amber-soft)]"
                        href={message.fallbackHref}
                      >
                        {copy.openThread}
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </details>
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
          aria-live="polite"
          className="mt-3 text-center text-xs text-[var(--an-subtle)]"
          data-communication-history-complete
          ref={completionStatus}
          role="status"
          tabIndex={-1}
        >
          {copy.allLoaded} · {items.length} {copy.of} {pageInfo.totalCount}
        </p>
      ) : null}
    </section>
  );
}
