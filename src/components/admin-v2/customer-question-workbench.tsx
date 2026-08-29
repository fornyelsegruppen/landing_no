"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PanelLocale } from "@/lib/panel-i18n";
import { customerQuestionReplyStage } from "@/lib/messages/customer-question-state";
import {
  customerReplyRecoveryKind,
  type CustomerReplyRecoveryKind,
} from "@/lib/messages/customer-reply-recovery";
import {
  customerQuestionActionVisibility,
  customerQuestionDisplayState,
} from "./customer-question-action-visibility";
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
    sourceChangedStatus: "Sending blokkert – nytt utkast kreves",
    queuedStatus: "Svar venter på levering",
    queuedHelp:
      "Svaret er godkjent og ligger i sendekø. Kunden kan ikke signere før leveringen er fullført.",
    sentStatus: "Sendt – venter på leveringsbekreftelse",
    sentHelp:
      "E-postleverandøren har tatt imot svaret. Kunden kan ikke signere før leveringen er bekreftet.",
    deliveredStatus: "Svar bekreftet levert",
    deliveredHelp:
      "E-postleverandøren har bekreftet levering. Kunden kan fortsette til signering.",
    failedStatus: "Levering mislyktes",
    failedHelp:
      "Kontroller svar og leveringsfeil før du prøver å sende på nytt.",
    retry: "Prøv sending på nytt",
    retrying: "Prøver på nytt …",
    retryConfirm: "Sende det kontrollerte svaret til kunden på nytt?",
    retryQueued: "Svaret er lagt tilbake i sendekøen.",
    retrySent:
      "E-postleverandøren har tatt imot svaret. Vi venter på leveringsbekreftelse.",
    failed: "Handlingen kunne ikke fullføres. Oppdater siden og prøv igjen.",
    stale: "Saken er endret. Oppdater siden før du fortsetter.",
    aiUnavailable: "AI-utkast er ikke tilgjengelig nå. Velg «Skriv svar selv».",
    quotaDaily: (resetAt: string | null) =>
      resetAt
        ? `Dagens AI-kvote er brukt opp. Den fornyes ${resetAt} (norsk tid). Velg «Skriv svar selv» frem til da.`
        : "Dagens AI-kvote er brukt opp. Velg «Skriv svar selv» frem til kvoten fornyes.",
    quotaMonthly: (resetAt: string | null) =>
      resetAt
        ? `Månedens AI-kvote er brukt opp. Den fornyes ${resetAt} (norsk tid). Velg «Skriv svar selv» frem til da.`
        : "Månedens AI-kvote er brukt opp. Velg «Skriv svar selv» frem til kvoten fornyes.",
    safetyRejected:
      "Den automatiske faktakontrollen avviste AI-utkastet. Prøv et nytt AI-utkast, eller skriv et kontrollert svar selv.",
    sourceChanged:
      "Dokumenter, priser eller vilkår er endret. Det gamle svaret kan ikke sendes. Lag et nytt AI-utkast eller skriv et nytt manuelt svar.",
    secureLinkMissing:
      "En gyldig sikker kundelenke mangler for denne tilbudsversjonen. Utsted tilbudslenken på nytt før du sender svaret.",
    replacementAi: "Lag nytt AI-utkast",
    replacementManual: "Skriv nytt svar selv",
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
    sourceChangedStatus: "Siuntimas užblokuotas – būtinas naujas juodraštis",
    queuedStatus: "Atsakymas laukia pristatymo",
    queuedHelp:
      "Atsakymas patvirtintas ir laukia siuntimo. Klientas negali pasirašyti, kol pristatymas nebaigtas.",
    sentStatus: "Išsiųsta – laukiama pristatymo patvirtinimo",
    sentHelp:
      "El. pašto paslaugų teikėjas priėmė atsakymą. Klientas negali pasirašyti, kol pristatymas nepatvirtintas.",
    deliveredStatus: "Patvirtinta, kad atsakymas pristatytas",
    deliveredHelp:
      "El. pašto paslaugų teikėjas patvirtino pristatymą. Klientas gali tęsti pasirašymą.",
    failedStatus: "Pristatyti nepavyko",
    failedHelp:
      "Prieš siųsdami dar kartą patikrinkite atsakymą ir pristatymo klaidą.",
    retry: "Bandyti siųsti dar kartą",
    retrying: "Bandoma dar kartą …",
    retryConfirm: "Dar kartą išsiųsti patikrintą atsakymą klientui?",
    retryQueued: "Atsakymas vėl įtrauktas į siuntimo eilę.",
    retrySent:
      "El. pašto paslaugų teikėjas priėmė atsakymą. Laukiama pristatymo patvirtinimo.",
    failed:
      "Veiksmo atlikti nepavyko. Atnaujinkite puslapį ir bandykite dar kartą.",
    stale: "Byla pasikeitė. Prieš tęsdami atnaujinkite puslapį.",
    aiUnavailable:
      "DI juodraštis dabar nepasiekiamas. Pasirinkite „Rašyti atsakymą pačiam“.",
    quotaDaily: (resetAt: string | null) =>
      resetAt
        ? `DI dienos kvota išnaudota. Ji atsinaujins ${resetAt} Lietuvos laiku. Iki tol pasirinkite „Rašyti atsakymą pačiam“.`
        : "DI dienos kvota išnaudota. Iki jos atsinaujinimo pasirinkite „Rašyti atsakymą pačiam“.",
    quotaMonthly: (resetAt: string | null) =>
      resetAt
        ? `DI mėnesio kvota išnaudota. Ji atsinaujins ${resetAt} Lietuvos laiku. Iki tol pasirinkite „Rašyti atsakymą pačiam“.`
        : "DI mėnesio kvota išnaudota. Iki jos atsinaujinimo pasirinkite „Rašyti atsakymą pačiam“.",
    safetyRejected:
      "Automatinė faktų patikra atmetė DI juodraštį. Kurkite naują DI juodraštį arba parašykite patikrintą atsakymą patys.",
    sourceChanged:
      "Dokumentai, kainos arba sąlygos pasikeitė. Seno atsakymo siųsti negalima. Kurkite naują DI juodraštį arba naują rankinį atsakymą.",
    secureLinkMissing:
      "Šiai pasiūlymo versijai nėra galiojančios saugios kliento nuorodos. Prieš siųsdami atsakymą išduokite pasiūlymo nuorodą iš naujo.",
    replacementAi: "Kurti naują DI juodraštį",
    replacementManual: "Rašyti naują atsakymą pačiam",
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
    sourceChangedStatus: "Sending blocked – a new draft is required",
    queuedStatus: "Reply awaiting delivery",
    queuedHelp:
      "The reply is approved and queued. The customer cannot sign until delivery is complete.",
    sentStatus: "Sent – awaiting delivery confirmation",
    sentHelp:
      "The email provider accepted the reply. The customer cannot sign until delivery is confirmed.",
    deliveredStatus: "Reply confirmed delivered",
    deliveredHelp:
      "The email provider confirmed delivery. The customer can continue to signing.",
    failedStatus: "Delivery failed",
    failedHelp: "Review the reply and delivery error before trying again.",
    retry: "Retry delivery",
    retrying: "Retrying …",
    retryConfirm: "Send the reviewed reply to the customer again?",
    retryQueued: "The reply was placed back in the delivery queue.",
    retrySent:
      "The email provider accepted the reply. Delivery confirmation is pending.",
    failed: "The action could not be completed. Refresh and try again.",
    stale: "The case changed. Refresh before continuing.",
    aiUnavailable:
      "AI drafting is unavailable right now. Choose “Write reply manually”.",
    quotaDaily: (resetAt: string | null) =>
      resetAt
        ? `The daily AI quota is exhausted. It resets at ${resetAt} UTC. Choose “Write reply manually” until then.`
        : "The daily AI quota is exhausted. Choose “Write reply manually” until it resets.",
    quotaMonthly: (resetAt: string | null) =>
      resetAt
        ? `The monthly AI quota is exhausted. It resets at ${resetAt} UTC. Choose “Write reply manually” until then.`
        : "The monthly AI quota is exhausted. Choose “Write reply manually” until it resets.",
    safetyRejected:
      "The automated fact check rejected the AI draft. Create a new AI draft or write a controlled reply manually.",
    sourceChanged:
      "Documents, prices, or terms changed. The old reply cannot be sent. Create a new AI draft or write a new manual reply.",
    secureLinkMissing:
      "This quote version has no valid secure customer link. Reissue the quote link before sending the reply.",
    replacementAi: "Create new AI draft",
    replacementManual: "Write new reply manually",
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

class CustomerReplyActionError extends Error {
  constructor(
    message: string,
    readonly recovery: CustomerReplyRecoveryKind,
  ) {
    super(message);
    this.name = "CustomerReplyActionError";
  }
}

function formatQuotaReset(locale: PanelLocale, retryAt?: string) {
  if (!retryAt) return null;
  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) return null;
  const format =
    locale === "lt"
      ? { locale: "lt-LT", timeZone: "Europe/Vilnius" }
      : locale === "nb"
        ? { locale: "nb-NO", timeZone: "Europe/Oslo" }
        : { locale: "en-GB", timeZone: "UTC" };
  return new Intl.DateTimeFormat(format.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: format.timeZone,
  }).format(date);
}

function localizedFailure(
  locale: PanelLocale,
  result: {
    code?: string;
    error?: string;
    period?: "daily" | "monthly";
    retryAt?: string;
  },
) {
  const labels = copy[locale];
  const recovery = customerReplyRecoveryKind(result);
  const quotaReset = formatQuotaReset(locale, result.retryAt);
  const message =
    recovery === "refresh"
      ? labels.stale
      : recovery === "source_changed"
        ? labels.sourceChanged
        : recovery === "safety_rejected"
          ? labels.safetyRejected
          : recovery === "secure_link_missing"
            ? labels.secureLinkMissing
            : recovery === "quota_limited"
              ? result.period === "monthly"
                ? labels.quotaMonthly(quotaReset)
                : labels.quotaDaily(quotaReset)
              : recovery === "ai_unavailable"
                ? labels.aiUnavailable
                : labels.failed;
  return { message, recovery };
}

export function CustomerQuestionWorkbench(props: {
  documentReferences: string[];
  recovery?: CustomerReplyRecoveryKind | null;
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
    recovery?: CustomerReplyRecoveryKind;
  } | null>(null);
  const [expectedMessageId, setExpectedMessageId] = useState<number | null>(
    null,
  );
  const stage = customerQuestionReplyStage(props.reply);
  const effectiveRecovery =
    feedback?.kind === "error" ? feedback.recovery : props.recovery;
  const displayState = customerQuestionDisplayState(stage, effectiveRecovery);
  const actionVisibility = customerQuestionActionVisibility(
    stage,
    effectiveRecovery,
  );

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
      period?: "daily" | "monthly";
      queued?: boolean;
      retryAt?: string;
      sent?: boolean;
    };
    if (!response.ok) {
      const failure = localizedFailure(props.locale, result);
      throw new CustomerReplyActionError(failure.message, failure.recovery);
    }
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
        recovery:
          error instanceof CustomerReplyActionError
            ? error.recovery
            : "unknown",
      });
    } finally {
      setBusy(null);
    }
  }

  async function replaceFailedReply(kind: "ai" | "manual") {
    if (!props.reply || busy) return;
    setBusy(kind);
    setFeedback(null);
    try {
      const result = await post({
        action: "regenerate_reply",
        messageId: props.reply.id,
        recoveryMode: kind,
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
        recovery:
          error instanceof CustomerReplyActionError
            ? error.recovery
            : "unknown",
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
        recovery:
          error instanceof CustomerReplyActionError
            ? error.recovery
            : "unknown",
      });
    } finally {
      setBusy(null);
    }
  }

  const statusLabel =
    displayState === "source_changed"
      ? labels.sourceChangedStatus
      : stage === "prepare"
        ? labels.prepareStatus
        : stage === "review"
          ? labels.reviewStatus
          : stage === "delivery_failed"
            ? labels.failedStatus
            : stage === "sent"
              ? labels.sentStatus
              : stage === "delivered"
                ? labels.deliveredStatus
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
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${displayState === "source_changed" ? "border-red-400/50 bg-red-500/15 text-red-100" : "border-warning/35 bg-warning/10 text-warning"}`}
        >
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
            {actionVisibility.showPrepareActions ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-12 rounded-xl px-4 font-bold disabled:opacity-50"
                  disabled={
                    Boolean(busy) ||
                    Boolean(expectedMessageId) ||
                    actionVisibility.disableAiAction
                  }
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
            ) : null}
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
            initialRecovery={effectiveRecovery}
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
            {actionVisibility.showRetryAction ? (
              <button
                className="bg-accent text-accent-foreground hover:bg-accent-hover mt-4 min-h-12 rounded-xl px-5 font-bold disabled:opacity-50"
                disabled={Boolean(busy)}
                onClick={() => void retry()}
                type="button"
              >
                {busy === "retry" ? labels.retrying : labels.retry}
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-bold">{statusLabel}</h3>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {stage === "delivered"
                ? labels.deliveredHelp
                : stage === "sent"
                  ? labels.sentHelp
                  : labels.queuedHelp}
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
      {feedback?.kind === "error" && actionVisibility.showReplacementActions ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-12 rounded-xl px-4 font-bold disabled:opacity-50"
            disabled={
              Boolean(busy) ||
              Boolean(expectedMessageId) ||
              actionVisibility.disableAiAction
            }
            onClick={() =>
              void (stage === "delivery_failed"
                ? replaceFailedReply("ai")
                : prepare("ai"))
            }
            type="button"
          >
            {busy === "ai" ? labels.preparingAi : labels.replacementAi}
          </button>
          <button
            className="hover:border-accent/50 min-h-12 rounded-xl border border-white/20 px-4 font-bold disabled:opacity-50"
            disabled={Boolean(busy) || Boolean(expectedMessageId)}
            onClick={() =>
              void (stage === "delivery_failed"
                ? replaceFailedReply("manual")
                : prepare("manual"))
            }
            type="button"
          >
            {busy === "manual"
              ? labels.preparingManual
              : labels.replacementManual}
          </button>
        </div>
      ) : null}
    </div>
  );
}
