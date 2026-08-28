"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PanelLocale } from "@/lib/panel-i18n";
import { customerQuestionReplyStage } from "@/lib/messages/customer-question-state";
import { MessageDraftEditor } from "./message-draft-editor";

const copy = {
  nb: {
    customerQuestion: "Kundens spørsmål",
    received: "Mottatt",
    relatedVersion: "Gjelder dokument",
    noDocument: "Ingen dokumentreferanse registrert",
    prepareStatus: "Svar må klargjøres",
    prepareTitle: "Velg hvordan du vil svare",
    prepareHelp:
      "Lag et kontrollert AI-utkast, eller start med et manuelt svar uten AI.",
    aiDraft: "Lag AI-utkast",
    manualDraft: "Skriv svar selv",
    preparingAi: "Lager AI-utkast …",
    preparingManual: "Åpner manuelt svar …",
    aiReady: "AI-utkastet er klart. Redaktøren åpnes nå.",
    manualReady: "Et manuelt svarutkast er klart. Redaktøren åpnes nå.",
    openingEditor: "Åpner redaktøren …",
    reviewStatus: "Svarutkast klart",
    queuedStatus: "Svar venter på levering",
    queuedHelp:
      "Svaret er godkjent og ligger i sendekø. Kunden kan ikke signere før leveringen er fullført.",
    sentStatus: "Svar sendt",
    sentHelp: "Svaret er sendt til kunden.",
    failedStatus: "Levering mislyktes",
    failedHelp:
      "Kontroller svar og leveringsfeil før du prøver å sende på nytt.",
    retry: "Prøv sending på nytt",
    retrying: "Prøver på nytt …",
    retryConfirm: "Sende det kontrollerte svaret til kunden på nytt?",
    retryQueued: "Svaret er lagt tilbake i sendekøen.",
    retrySent: "Svaret er sendt til kunden.",
    failed: "Handlingen kunne ikke fullføres. Oppdater siden og prøv igjen.",
    stale: "Saken er endret. Oppdater siden før du fortsetter.",
    aiUnavailable: "AI-utkast er ikke tilgjengelig nå. Velg «Skriv svar selv».",
    outgoingReply: "Svar som skal leveres",
  },
  lt: {
    customerQuestion: "Kliento klausimas",
    received: "Gauta",
    relatedVersion: "Susijęs dokumentas",
    noDocument: "Dokumento nuoroda neužregistruota",
    prepareStatus: "Reikia parengti atsakymą",
    prepareTitle: "Pasirinkite, kaip atsakysite",
    prepareHelp:
      "Parenkite patikrintą DI juodraštį arba pradėkite rankinį atsakymą be DI.",
    aiDraft: "Kurti DI juodraštį",
    manualDraft: "Rašyti atsakymą pačiam",
    preparingAi: "Kuriamas DI juodraštis …",
    preparingManual: "Atveriamas rankinis atsakymas …",
    aiReady: "DI juodraštis parengtas. Dabar atveriamas redaktorius.",
    manualReady:
      "Rankinis atsakymo juodraštis parengtas. Dabar atveriamas redaktorius.",
    openingEditor: "Atveriamas redaktorius …",
    reviewStatus: "Atsakymo juodraštis parengtas",
    queuedStatus: "Atsakymas laukia pristatymo",
    queuedHelp:
      "Atsakymas patvirtintas ir laukia siuntimo. Klientas negali pasirašyti, kol pristatymas nebaigtas.",
    sentStatus: "Atsakymas išsiųstas",
    sentHelp: "Atsakymas išsiųstas klientui.",
    failedStatus: "Pristatyti nepavyko",
    failedHelp:
      "Prieš siųsdami dar kartą patikrinkite atsakymą ir pristatymo klaidą.",
    retry: "Bandyti siųsti dar kartą",
    retrying: "Bandoma dar kartą …",
    retryConfirm: "Dar kartą išsiųsti patikrintą atsakymą klientui?",
    retryQueued: "Atsakymas vėl įtrauktas į siuntimo eilę.",
    retrySent: "Atsakymas išsiųstas klientui.",
    failed:
      "Veiksmo atlikti nepavyko. Atnaujinkite puslapį ir bandykite dar kartą.",
    stale: "Byla pasikeitė. Prieš tęsdami atnaujinkite puslapį.",
    aiUnavailable:
      "DI juodraštis dabar nepasiekiamas. Pasirinkite „Rašyti atsakymą pačiam“.",
    outgoingReply: "Atsakymas, kuris bus pristatytas",
  },
  en: {
    customerQuestion: "Customer question",
    received: "Received",
    relatedVersion: "Related document",
    noDocument: "No document reference recorded",
    prepareStatus: "A reply must be prepared",
    prepareTitle: "Choose how to reply",
    prepareHelp:
      "Create a controlled AI draft, or start a manual reply without AI.",
    aiDraft: "Create AI draft",
    manualDraft: "Write reply manually",
    preparingAi: "Creating AI draft …",
    preparingManual: "Opening manual reply …",
    aiReady: "The AI draft is ready. Opening the editor now.",
    manualReady: "A manual reply draft is ready. Opening the editor now.",
    openingEditor: "Opening the editor …",
    reviewStatus: "Reply draft ready",
    queuedStatus: "Reply awaiting delivery",
    queuedHelp:
      "The reply is approved and queued. The customer cannot sign until delivery is complete.",
    sentStatus: "Reply sent",
    sentHelp: "The reply was sent to the customer.",
    failedStatus: "Delivery failed",
    failedHelp: "Review the reply and delivery error before trying again.",
    retry: "Retry delivery",
    retrying: "Retrying …",
    retryConfirm: "Send the reviewed reply to the customer again?",
    retryQueued: "The reply was placed back in the delivery queue.",
    retrySent: "The reply was sent to the customer.",
    failed: "The action could not be completed. Refresh and try again.",
    stale: "The case changed. Refresh before continuing.",
    aiUnavailable:
      "AI drafting is unavailable right now. Choose “Write reply manually”.",
    outgoingReply: "Reply to be delivered",
  },
} as const;

type QuestionReply = {
  aiAssisted?: boolean;
  bodyText: string;
  factWarnings?: string[];
  failureMessage?: string;
  id: number;
  manualReplyRequiresEditing?: boolean;
  status?: string;
  subject: string;
  updatedAt: string;
};

function localizedFailure(
  locale: PanelLocale,
  result: { code?: string; error?: string },
) {
  const labels = copy[locale];
  if (
    result.code === "CASE_REVISION_CONFLICT" ||
    result.code === "MESSAGE_REVISION_CONFLICT"
  ) {
    return labels.stale;
  }
  const error = result.error?.toLowerCase() || "";
  if (
    error.includes("ai draft") ||
    error.includes("gemini") ||
    error.includes("ai usage")
  ) {
    return labels.aiUnavailable;
  }
  return labels.failed;
}

export function CustomerQuestionWorkbench(props: {
  documentReferences: string[];
  leadId: number;
  leadRevision: number;
  locale: PanelLocale;
  question: {
    bodyText: string;
    id: number;
    receivedAt: string;
    subject: string;
  };
  reply?: QuestionReply | null;
}) {
  const labels = copy[props.locale];
  const router = useRouter();
  const refreshTimers = useRef<number[]>([]);
  const [busy, setBusy] = useState<"ai" | "manual" | "retry" | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [expectedMessageId, setExpectedMessageId] = useState<number | null>(
    null,
  );
  const stage = customerQuestionReplyStage(props.reply);

  useEffect(
    () => () => {
      for (const timer of refreshTimers.current) window.clearTimeout(timer);
    },
    [],
  );

  function refreshEditor() {
    router.refresh();
    refreshTimers.current.push(
      window.setTimeout(() => router.refresh(), 500),
      window.setTimeout(() => router.refresh(), 1_500),
    );
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/leads/${props.leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as {
      code?: string;
      duplicate?: boolean;
      error?: string;
      messageId?: number;
      queued?: boolean;
      sent?: boolean;
    };
    if (!response.ok) throw new Error(localizedFailure(props.locale, result));
    return result;
  }

  async function prepare(kind: "ai" | "manual") {
    if (busy) return;
    setBusy(kind);
    setFeedback(null);
    try {
      const result = await post({
        action:
          kind === "ai"
            ? "prepare_question_reply"
            : "prepare_manual_question_reply",
        sourceMessageId: props.question.id,
        expectedRevision: props.leadRevision,
      });
      if (typeof result.messageId !== "number") throw new Error(labels.failed);
      setExpectedMessageId(result.messageId);
      setFeedback({
        kind: "success",
        message: kind === "ai" ? labels.aiReady : labels.manualReady,
      });
      refreshEditor();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : labels.failed,
      });
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    if (!props.reply || busy || !window.confirm(labels.retryConfirm)) return;
    setBusy("retry");
    setFeedback(null);
    try {
      const result = await post({
        action: "retry_send",
        messageId: props.reply.id,
        expectedRevision: props.leadRevision,
      });
      setFeedback({
        kind: "success",
        message: result.sent ? labels.retrySent : labels.retryQueued,
      });
      refreshTimers.current.push(
        window.setTimeout(() => router.refresh(), 800),
      );
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : labels.failed,
      });
    } finally {
      setBusy(null);
    }
  }

  const statusLabel =
    stage === "prepare"
      ? labels.prepareStatus
      : stage === "review"
        ? labels.reviewStatus
        : stage === "delivery_failed"
          ? labels.failedStatus
          : stage === "sent"
            ? labels.sentStatus
            : labels.queuedStatus;

  return (
    <div className="border-warning/35 bg-warning/5 mt-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-warning text-xs font-bold tracking-[.16em] uppercase">
            {labels.customerQuestion}
          </p>
          <h2 className="mt-2 text-lg font-bold break-words">
            {props.question.subject}
          </h2>
        </div>
        <span className="border-warning/35 bg-warning/10 text-warning w-fit rounded-full border px-3 py-1 text-xs font-bold">
          {statusLabel}
        </span>
      </div>

      <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap text-white/90">
        {props.question.bodyText}
      </p>
      <dl className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{labels.received}</dt>
          <dd className="mt-1 font-semibold">{props.question.receivedAt}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{labels.relatedVersion}</dt>
          <dd className="mt-1 font-semibold break-words">
            {props.documentReferences.length
              ? props.documentReferences.join(" · ")
              : labels.noDocument}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-white/10 pt-5">
        {stage === "prepare" ? (
          <div>
            <h3 className="text-lg font-bold">{labels.prepareTitle}</h3>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {labels.prepareHelp}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-12 rounded-xl px-4 font-bold disabled:opacity-50"
                disabled={Boolean(busy) || Boolean(expectedMessageId)}
                onClick={() => void prepare("ai")}
                type="button"
              >
                {busy === "ai" ? labels.preparingAi : labels.aiDraft}
              </button>
              <button
                className="hover:border-accent/50 min-h-12 rounded-xl border border-white/20 px-4 font-bold disabled:opacity-50"
                disabled={Boolean(busy) || Boolean(expectedMessageId)}
                onClick={() => void prepare("manual")}
                type="button"
              >
                {busy === "manual"
                  ? labels.preparingManual
                  : labels.manualDraft}
              </button>
            </div>
            {expectedMessageId ? (
              <p className="text-muted-foreground mt-3 text-sm" role="status">
                {labels.openingEditor}
              </p>
            ) : null}
          </div>
        ) : stage === "review" && props.reply ? (
          <MessageDraftEditor
            key={`${props.reply.id}:${props.reply.updatedAt}`}
            aiAssisted={props.reply.aiAssisted}
            bodyText={props.reply.bodyText}
            caseRevision={props.leadRevision}
            factWarnings={props.reply.factWarnings}
            leadId={props.leadId}
            locale={props.locale}
            manualReplyRequiresEditing={props.reply.manualReplyRequiresEditing}
            messageId={props.reply.id}
            messageUpdatedAt={props.reply.updatedAt}
            sourceContextAvailable
            subject={props.reply.subject}
          />
        ) : stage === "delivery_failed" && props.reply ? (
          <div>
            <h3 className="text-lg font-bold">{labels.failedStatus}</h3>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {labels.failedHelp}
            </p>
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 p-4">
              <p className="text-xs font-bold tracking-wider text-red-200 uppercase">
                {labels.outgoingReply}
              </p>
              <p className="mt-2 font-semibold">{props.reply.subject}</p>
              <p className="mt-2 text-sm whitespace-pre-wrap text-white/80">
                {props.reply.bodyText}
              </p>
              {props.reply.failureMessage ? (
                <p className="mt-3 text-sm text-red-200" role="alert">
                  {props.reply.failureMessage}
                </p>
              ) : null}
            </div>
            <button
              className="bg-accent text-accent-foreground hover:bg-accent-hover mt-4 min-h-12 rounded-xl px-5 font-bold disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() => void retry()}
              type="button"
            >
              {busy === "retry" ? labels.retrying : labels.retry}
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-bold">{statusLabel}</h3>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {stage === "sent" ? labels.sentHelp : labels.queuedHelp}
            </p>
            {props.reply ? (
              <details className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                <summary className="cursor-pointer text-sm font-bold">
                  {labels.outgoingReply}
                </summary>
                <p className="mt-3 font-semibold">{props.reply.subject}</p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-white/75">
                  {props.reply.bodyText}
                </p>
              </details>
            ) : null}
          </div>
        )}
      </div>

      {feedback ? (
        <p
          aria-live="polite"
          className={`mt-4 rounded-xl border px-3 py-2 text-sm ${feedback.kind === "error" ? "border-danger/35 bg-danger/10 text-red-100" : "border-success/35 bg-success/10 text-green-100"}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
