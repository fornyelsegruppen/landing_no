"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  messageDraftRequest,
  type MessageDraftAction,
} from "@/lib/admin-v2/message-draft-request";
import {
  customerReplyRecoveryKind,
  type CustomerReplyRecoveryKind,
} from "@/lib/messages/customer-reply-recovery";
import { customerReplyEditorActionVisibility } from "./customer-question-action-visibility";

const copy = {
  nb: {
    aiDraft: "AI-utkast – må kontrolleres av administrator",
    original: "Kundens opprinnelige melding",
    warnings: "Faktakontroll",
    subject: "Emne",
    body: "Svar til kunden",
    save: "Lagre utkast",
    polish: "Formuler profesjonelt med AI",
    undoPolish: "Angre AI-formulering",
    polished:
      "AI-forslaget er lagt inn. Kontroller teksten og lagre eller send når den er riktig.",
    regenerate: "Lag nytt AI-utkast",
    send: "Godkjenn og send",
    cancel: "Forkast utkast",
    cancelConfirm: "Forkaste dette utkastet? Det sendes ikke til kunden.",
    sendingConfirm:
      "Jeg har kontrollert fakta og godkjenner at denne meldingen sendes til kunden.",
    saved: "Utkastet er lagret.",
    regenerated: "Et nytt AI-utkast er opprettet.",
    sent: "E-postleverandøren har tatt imot meldingen. Vi venter på bekreftet levering før kunden kan signere.",
    queued: "Meldingen er kontrollert og ligger trygt i sendekø.",
    cancelled: "Utkastet er forkastet.",
    failed: "Handlingen kunne ikke fullføres.",
    stale: "Saken eller utkastet er endret. Oppdater siden før du fortsetter.",
    sourcesChanged:
      "Dokumenter, priser eller vilkår er endret. Lag et nytt utkast med oppdatert grunnlag før du sender.",
    safetyRejected:
      "Den automatiske faktakontrollen avviste teksten. Rett svaret manuelt, eller lag et nytt AI-utkast.",
    regenerateManual: "Start nytt manuelt svar",
    aiUnavailable: "AI-funksjonen er ikke tilgjengelig nå. Prøv igjen senere.",
    manualRequired:
      "Erstatt hjelpeteksten med et kundespesifikt svar før du lagrer eller sender.",
    regenerateConfirm:
      "Erstatte utkastet med et nytt AI-utkast? Ulagrede endringer går tapt.",
    processing: "Behandler …",
  },
  lt: {
    aiDraft: "DI juodraštis – administratorius privalo patikrinti",
    original: "Pradinė kliento žinutė",
    warnings: "Faktų patikra",
    subject: "Tema",
    body: "Atsakymas klientui",
    save: "Išsaugoti juodraštį",
    polish: "Profesionaliai perfrazuoti su DI",
    undoPolish: "Atšaukti DI perfrazavimą",
    polished:
      "DI pasiūlymas įkeltas. Patikrinkite tekstą ir tik tada išsaugokite arba siųskite.",
    regenerate: "Sukurti naują DI juodraštį",
    send: "Patvirtinti ir išsiųsti",
    cancel: "Atšaukti juodraštį",
    cancelConfirm: "Atšaukti šį juodraštį? Klientui jis nebus siunčiamas.",
    sendingConfirm:
      "Patvirtinu, kad patikrinau faktus ir leidžiu išsiųsti šią žinutę klientui.",
    saved: "Juodraštis išsaugotas.",
    regenerated: "Sukurtas naujas DI juodraštis.",
    sent: "El. pašto paslaugų teikėjas priėmė žinutę. Laukiama patvirtinto pristatymo, kol klientas galės pasirašyti.",
    queued: "Žinutė patikrinta ir saugiai laukia siuntimo eilėje.",
    cancelled: "Juodraštis atšauktas.",
    failed: "Veiksmo atlikti nepavyko.",
    stale:
      "Byla arba juodraštis pasikeitė. Prieš tęsdami atnaujinkite puslapį.",
    sourcesChanged:
      "Dokumentai, kainos arba sąlygos pasikeitė. Prieš siųsdami sukurkite naują juodraštį.",
    safetyRejected:
      "Automatinė faktų patikra atmetė tekstą. Pataisykite atsakymą rankiniu būdu arba sukurkite naują DI juodraštį.",
    regenerateManual: "Pradėti naują rankinį atsakymą",
    aiUnavailable: "DI funkcija dabar nepasiekiama. Bandykite vėliau.",
    manualRequired:
      "Prieš išsaugodami arba siųsdami pakeiskite pagalbinį tekstą konkrečiu atsakymu klientui.",
    regenerateConfirm:
      "Pakeisti juodraštį nauju DI juodraščiu? Neišsaugoti pakeitimai bus prarasti.",
    processing: "Vykdoma …",
  },
  en: {
    aiDraft: "AI draft – administrator review required",
    original: "Customer's original message",
    warnings: "Fact check",
    subject: "Subject",
    body: "Reply to customer",
    save: "Save draft",
    polish: "Polish professionally with AI",
    undoPolish: "Undo AI polish",
    polished:
      "The AI suggestion is now in the editor. Review it before saving or sending.",
    regenerate: "Generate a new AI draft",
    send: "Approve and send",
    cancel: "Discard draft",
    cancelConfirm: "Discard this draft? It will not be sent to the customer.",
    sendingConfirm:
      "I have checked the facts and approve sending this message to the customer.",
    saved: "The draft was saved.",
    regenerated: "A new AI draft was created.",
    sent: "The email provider accepted the message. Confirmed delivery is required before the customer can sign.",
    queued: "The message was reviewed and is safely queued for delivery.",
    cancelled: "The draft was discarded.",
    failed: "The action could not be completed.",
    stale: "The case or draft changed. Refresh before continuing.",
    sourcesChanged:
      "Documents, prices, or terms changed. Create a new draft before sending.",
    safetyRejected:
      "The automated fact check rejected the text. Correct the reply manually or create a new AI draft.",
    regenerateManual: "Start a new manual reply",
    aiUnavailable: "The AI feature is unavailable right now. Try again later.",
    manualRequired:
      "Replace the helper text with a customer-specific reply before saving or sending.",
    regenerateConfirm:
      "Replace this draft with a new AI draft? Unsaved changes will be lost.",
    processing: "Processing …",
  },
} as const;

class CustomerReplyDraftActionError extends Error {
  constructor(
    message: string,
    readonly recovery: CustomerReplyRecoveryKind,
  ) {
    super(message);
    this.name = "CustomerReplyDraftActionError";
  }
}

export function MessageDraftEditor(props: {
  aiAssisted?: boolean;
  bodyText: string;
  factWarnings?: string[];
  caseRevision: number;
  leadId: number;
  locale: PanelLocale;
  manualReplyRequiresEditing?: boolean;
  messageId: number;
  messageUpdatedAt: string;
  sourceContextAvailable?: boolean;
  sourceBody?: string;
  sourceSubject?: string;
  subject: string;
}) {
  const labels = copy[props.locale];
  const router = useRouter();
  const activeMessageId = useRef(props.messageId);
  const expectedMessageUpdatedAt = useRef(props.messageUpdatedAt);
  const [subject, setSubject] = useState(props.subject);
  const [bodyText, setBodyText] = useState(props.bodyText);
  const [busy, setBusy] = useState<
    "cancel" | "polish" | "save" | "regenerate" | "send" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [recovery, setRecovery] = useState<CustomerReplyRecoveryKind | null>(
    null,
  );
  const [beforePolish, setBeforePolish] = useState<{
    bodyText: string;
    subject: string;
  } | null>(null);
  const dirty = subject !== props.subject || bodyText !== props.bodyText;
  const hasSourceContext =
    Boolean(props.sourceBody) || Boolean(props.sourceContextAvailable);
  const manualReplyNeedsEditing =
    Boolean(props.manualReplyRequiresEditing) && !dirty;
  const actionVisibility = customerReplyEditorActionVisibility({
    aiAssisted: Boolean(props.aiAssisted),
    hasSourceContext,
    recovery,
  });

  useEffect(() => {
    if (activeMessageId.current === props.messageId) return;
    activeMessageId.current = props.messageId;
    setSubject(props.subject);
    setBodyText(props.bodyText);
    setBeforePolish(null);
    setNotice("");
    setRecovery(null);
  }, [props.bodyText, props.messageId, props.subject]);

  useEffect(() => {
    expectedMessageUpdatedAt.current = props.messageUpdatedAt;
  }, [props.messageUpdatedAt]);

  function localizedFailure(result: { code?: string; error?: string }) {
    const recoveryKind = customerReplyRecoveryKind(result);
    if (recoveryKind === "refresh") return labels.stale;
    if (recoveryKind === "source_changed") return labels.sourcesChanged;
    if (recoveryKind === "safety_rejected") return labels.safetyRejected;
    if (recoveryKind === "ai_unavailable") return labels.aiUnavailable;
    const error = result.error?.toLowerCase() || "";
    if (
      error.includes("customer-specific answer") ||
      error.includes("manual reply")
    ) {
      return labels.manualRequired;
    }
    if (
      error.includes("only a draft") ||
      error.includes("active ai reply") ||
      error.includes("changed by another administrator") ||
      error.includes("revision conflict") ||
      error.includes("refresh before")
    ) {
      return labels.stale;
    }
    return labels.failed;
  }

  async function post(action: MessageDraftAction) {
    const requestBody = messageDraftRequest(action, {
      bodyText,
      caseRevision: props.caseRevision,
      messageId: props.messageId,
      messageUpdatedAt: expectedMessageUpdatedAt.current,
      subject,
    });
    const response = await fetch(`/api/admin/leads/${props.leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const result = (await response.json().catch(() => ({}))) as {
      code?: string;
      configurationRequired?: boolean;
      error?: string;
      messageUpdatedAt?: string;
      polished?: { bodyText?: string; subject?: string };
      queued?: boolean;
      sent?: boolean;
    };
    if (!response.ok) {
      const message = localizedFailure(result);
      if (response.status === 409 && message === labels.stale) router.refresh();
      throw new CustomerReplyDraftActionError(
        message,
        customerReplyRecoveryKind(result),
      );
    }
    return result;
  }

  async function run(
    kind: "cancel" | "polish" | "save" | "regenerate" | "send",
  ) {
    if (busy) return;
    if (kind === "send" && !window.confirm(labels.sendingConfirm)) return;
    if (kind === "cancel" && !window.confirm(labels.cancelConfirm)) return;
    if (
      kind === "regenerate" &&
      dirty &&
      !window.confirm(labels.regenerateConfirm)
    )
      return;
    setBusy(kind);
    setNotice("");
    setRecovery(null);
    try {
      if (kind === "cancel") {
        await post("cancel_draft");
        setNotice(labels.cancelled);
      } else if (kind === "polish") {
        const original = { bodyText, subject };
        const result = await post("polish_reply");
        if (!result.polished?.subject || !result.polished.bodyText)
          throw new Error(labels.failed);
        setBeforePolish(original);
        setSubject(result.polished.subject);
        setBodyText(result.polished.bodyText);
        setNotice(labels.polished);
      } else if (kind === "regenerate") {
        await post("regenerate_reply");
        setNotice(labels.regenerated);
      } else {
        if (kind === "send") {
          const result = await post("approve_send");
          setNotice(result.sent ? labels.sent : labels.queued);
        } else {
          const result = await post("save_draft");
          if (result.messageUpdatedAt) {
            expectedMessageUpdatedAt.current = result.messageUpdatedAt;
          }
          setNotice(labels.saved);
        }
      }
      if (kind === "send") {
        window.setTimeout(() => router.refresh(), 800);
      } else if (kind !== "polish") {
        router.refresh();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : labels.failed);
      setRecovery(
        error instanceof CustomerReplyDraftActionError
          ? error.recovery
          : "unknown",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-accent/35 bg-accent/5 rounded-2xl border p-4">
      {props.aiAssisted ? (
        <p className="text-accent text-xs font-bold tracking-wider uppercase">
          {labels.aiDraft}
        </p>
      ) : null}
      {props.sourceBody ? (
        <details
          className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3"
          open
        >
          <summary className="cursor-pointer text-sm font-bold">
            {labels.original}
          </summary>
          {props.sourceSubject ? (
            <p className="mt-3 text-sm font-semibold">{props.sourceSubject}</p>
          ) : null}
          <p className="mt-2 text-sm whitespace-pre-wrap text-white/75">
            {props.sourceBody}
          </p>
        </details>
      ) : null}
      {props.factWarnings?.length ? (
        <div className="border-warning/30 bg-warning/5 mt-3 rounded-xl border p-3">
          <p className="text-warning text-xs font-bold tracking-wider uppercase">
            {labels.warnings}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
            {props.factWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="mt-4 grid gap-1.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {labels.subject}
        </span>
        <input
          className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3"
          maxLength={160}
          minLength={5}
          onChange={(event) => setSubject(event.target.value)}
          value={subject}
        />
      </label>
      <label className="mt-4 grid gap-1.5">
        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {labels.body}
        </span>
        <textarea
          className="min-h-56 rounded-xl border border-white/10 bg-[#0d1118] p-3"
          maxLength={3_000}
          minLength={20}
          onChange={(event) => setBodyText(event.target.value)}
          value={bodyText}
        />
      </label>
      {manualReplyNeedsEditing ? (
        <p className="border-warning/30 bg-warning/5 text-warning mt-3 rounded-xl border p-3 text-sm">
          {labels.manualRequired}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {actionVisibility.showDraftActions ? (
          <button
            className="hover:border-accent/50 min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-50"
            disabled={
              Boolean(busy) ||
              subject.trim().length < 5 ||
              bodyText.trim().length < 20 ||
              manualReplyNeedsEditing
            }
            onClick={() => void run("save")}
            type="button"
          >
            {busy === "save" ? labels.processing : labels.save}
          </button>
        ) : null}
        {actionVisibility.showDraftActions && hasSourceContext ? (
          <button
            className="border-accent/40 text-accent hover:bg-accent/10 min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50"
            disabled={
              Boolean(busy) ||
              subject.trim().length < 5 ||
              bodyText.trim().length < 20 ||
              manualReplyNeedsEditing
            }
            onClick={() => void run("polish")}
            type="button"
          >
            {busy === "polish" ? labels.processing : labels.polish}
          </button>
        ) : null}
        {actionVisibility.showDraftActions && beforePolish ? (
          <button
            className="hover:border-accent/50 min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={() => {
              setSubject(beforePolish.subject);
              setBodyText(beforePolish.bodyText);
              setBeforePolish(null);
              setNotice("");
              setRecovery(null);
            }}
            type="button"
          >
            {labels.undoPolish}
          </button>
        ) : null}
        {actionVisibility.showRegenerateAction ? (
          <button
            className="border-accent/40 text-accent hover:bg-accent/10 min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={() => void run("regenerate")}
            type="button"
          >
            {busy === "regenerate"
              ? labels.processing
              : props.aiAssisted
                ? labels.regenerate
                : labels.regenerateManual}
          </button>
        ) : null}
        {actionVisibility.showDraftActions ? (
          <button
            className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-11 rounded-xl px-4 font-bold disabled:opacity-50"
            disabled={
              Boolean(busy) ||
              subject.trim().length < 5 ||
              bodyText.trim().length < 20 ||
              manualReplyNeedsEditing
            }
            onClick={() => void run("send")}
            type="button"
          >
            {busy === "send" ? labels.processing : labels.send}
          </button>
        ) : null}
        <button
          className="min-h-11 rounded-xl border border-red-400/40 px-4 font-bold text-red-200 hover:bg-red-400/10 disabled:opacity-50"
          disabled={Boolean(busy)}
          onClick={() => void run("cancel")}
          type="button"
        >
          {busy === "cancel" ? labels.processing : labels.cancel}
        </button>
      </div>
      {notice ? (
        <p
          aria-live="polite"
          className="text-muted-foreground mt-3 text-sm"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
