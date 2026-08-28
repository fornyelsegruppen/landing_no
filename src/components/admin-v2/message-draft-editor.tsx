"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

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
    sent: "Meldingen er godkjent og lagt til utsending.",
    cancelled: "Utkastet er forkastet.",
    failed: "Handlingen kunne ikke fullføres.",
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
    sent: "Žinutė patvirtinta ir perduota siuntimui.",
    cancelled: "Juodraštis atšauktas.",
    failed: "Veiksmo atlikti nepavyko.",
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
    sent: "The message was approved and queued for delivery.",
    cancelled: "The draft was discarded.",
    failed: "The action could not be completed.",
    processing: "Processing …",
  },
} as const;

export function MessageDraftEditor(props: {
  aiAssisted?: boolean;
  bodyText: string;
  factWarnings?: string[];
  leadId: number;
  locale: PanelLocale;
  messageId: number;
  sourceBody?: string;
  sourceSubject?: string;
  subject: string;
}) {
  const labels = copy[props.locale];
  const router = useRouter();
  const [subject, setSubject] = useState(props.subject);
  const [bodyText, setBodyText] = useState(props.bodyText);
  const [busy, setBusy] = useState<
    "cancel" | "polish" | "save" | "regenerate" | "send" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [beforePolish, setBeforePolish] = useState<{
    bodyText: string;
    subject: string;
  } | null>(null);

  async function post(
    action:
      | "cancel_draft"
      | "polish_reply"
      | "save_draft"
      | "regenerate_reply"
      | "approve_send",
  ) {
    const response = await fetch(`/api/admin/leads/${props.leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "save_draft" || action === "polish_reply"
          ? { action, messageId: props.messageId, subject, bodyText }
          : { action, messageId: props.messageId },
      ),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      polished?: { bodyText?: string; subject?: string };
    };
    if (!response.ok) throw new Error(result.error || labels.failed);
    return result;
  }

  async function run(
    kind: "cancel" | "polish" | "save" | "regenerate" | "send",
  ) {
    if (busy) return;
    if (kind === "send" && !window.confirm(labels.sendingConfirm)) return;
    if (kind === "cancel" && !window.confirm(labels.cancelConfirm)) return;
    setBusy(kind);
    setNotice("");
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
        await post("save_draft");
        if (kind === "send") {
          await post("approve_send");
          setNotice(labels.sent);
        } else setNotice(labels.saved);
      }
      if (kind !== "polish") router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : labels.failed);
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
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="hover:border-accent/50 min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-50"
          disabled={
            Boolean(busy) ||
            subject.trim().length < 5 ||
            bodyText.trim().length < 20
          }
          onClick={() => void run("save")}
          type="button"
        >
          {busy === "save" ? labels.processing : labels.save}
        </button>
        {props.aiAssisted && props.sourceBody ? (
          <button
            className="border-accent/40 text-accent hover:bg-accent/10 min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50"
            disabled={
              Boolean(busy) ||
              subject.trim().length < 5 ||
              bodyText.trim().length < 20
            }
            onClick={() => void run("polish")}
            type="button"
          >
            {busy === "polish" ? labels.processing : labels.polish}
          </button>
        ) : null}
        {beforePolish ? (
          <button
            className="hover:border-accent/50 min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={() => {
              setSubject(beforePolish.subject);
              setBodyText(beforePolish.bodyText);
              setBeforePolish(null);
              setNotice("");
            }}
            type="button"
          >
            {labels.undoPolish}
          </button>
        ) : null}
        {props.aiAssisted && props.sourceBody ? (
          <button
            className="border-accent/40 text-accent hover:bg-accent/10 min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={() => void run("regenerate")}
            type="button"
          >
            {busy === "regenerate" ? labels.processing : labels.regenerate}
          </button>
        ) : null}
        <button
          className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-11 rounded-xl px-4 font-bold disabled:opacity-50"
          disabled={
            Boolean(busy) ||
            subject.trim().length < 5 ||
            bodyText.trim().length < 20
          }
          onClick={() => void run("send")}
          type="button"
        >
          {busy === "send" ? labels.processing : labels.send}
        </button>
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
