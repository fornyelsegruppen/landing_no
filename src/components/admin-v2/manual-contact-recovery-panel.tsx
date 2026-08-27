"use client";

import { useState } from "react";
import { Check, Clipboard, ExternalLink, LoaderCircle } from "lucide-react";

type Locale = "nb" | "lt" | "en";
type Recovery = {
  channel?: string;
  contactedAt?: string;
  resentAt?: string;
  status?: string;
};

const labels = {
  nb: {
    title: "Manuell kontakt",
    intro:
      "Bruk dette hvis e-posten ikke kom frem. Kunden får en sikker lenke for å oppgi riktig e-postadresse og motta akkurat denne meldingen på nytt.",
    prepare: "Lag sikker kontaktmelding",
    renew: "Lag en ny sikker lenke",
    copy: "Kopier melding og lenke",
    copied: "Kopiert",
    open: "Kontroller kundesiden",
    record: "Registrer manuell kontakt",
    recorded: "Manuell kontakt registrert",
    channel: "Kontaktkanal",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Telefon",
    other: "Annet",
    failed: "Kunne ikke utføre handlingen.",
    recoveryDone:
      "Kunden har registrert ny e-postadresse, og den valgte meldingen er sendt på nytt.",
    recoveryQueued:
      "Ny e-postadresse er registrert. Meldingen venter på nytt leveringsforsøk.",
  },
  lt: {
    title: "Susisiekti rankiniu būdu",
    intro:
      "Naudokite, jei el. laiškas kliento nepasiekė. Klientas saugioje nuorodoje įves teisingą el. paštą ir gaus būtent šį laišką dar kartą.",
    prepare: "Sukurti saugią kontaktinę žinutę",
    renew: "Sukurti naują saugią nuorodą",
    copy: "Kopijuoti žinutę ir nuorodą",
    copied: "Nukopijuota",
    open: "Patikrinti kliento puslapį",
    record: "Pažymėti, kad susisiekta",
    recorded: "Rankinis kontaktas užregistruotas",
    channel: "Kontaktavimo kanalas",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Telefonas",
    other: "Kita",
    failed: "Veiksmo atlikti nepavyko.",
    recoveryDone:
      "Klientas įvedė naują el. paštą, o pasirinktas laiškas išsiųstas dar kartą.",
    recoveryQueued:
      "Naujas el. paštas išsaugotas. Laiškas laukia pakartotinio siuntimo.",
  },
  en: {
    title: "Manual contact",
    intro:
      "Use this if the email did not arrive. The customer gets a secure link to enter the correct address and receive this exact message again.",
    prepare: "Create secure contact message",
    renew: "Create a new secure link",
    copy: "Copy message and link",
    copied: "Copied",
    open: "Check customer page",
    record: "Record manual contact",
    recorded: "Manual contact recorded",
    channel: "Contact channel",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Phone",
    other: "Other",
    failed: "The action could not be completed.",
    recoveryDone:
      "The customer entered a new email address and the selected message was resent.",
    recoveryQueued:
      "The new email address was saved. The message is queued for another delivery attempt.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function ManualContactRecoveryPanel(props: {
  locale: Locale;
  messageId: number;
  recovery?: Recovery;
}) {
  const copy = labels[props.locale];
  const [pending, setPending] = useState(false);
  const [manualText, setManualText] = useState("");
  const [secureUrl, setSecureUrl] = useState("");
  const [channel, setChannel] = useState("sms");
  const [copied, setCopied] = useState(false);
  const [recorded, setRecorded] = useState(
    Boolean(props.recovery?.contactedAt),
  );
  const [error, setError] = useState("");

  const completed = props.recovery?.status === "resent";
  const queued = props.recovery?.status === "retry_queued";

  async function action(body: Record<string, unknown>) {
    const response = await fetch(
      `/api/admin/messages/${props.messageId}/manual-contact`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const result = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new Error(
        typeof result.error === "string" ? result.error : copy.failed,
      );
    }
    return result;
  }

  async function prepare() {
    setPending(true);
    setError("");
    try {
      const result = await action({ action: "prepare" });
      setManualText(String(result.manualText || ""));
      setSecureUrl(String(result.secureUrl || ""));
      setCopied(false);
      setRecorded(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setPending(false);
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(manualText);
      setCopied(true);
    } catch {
      setError(copy.failed);
    }
  }

  async function record() {
    setPending(true);
    setError("");
    try {
      await action({ action: "record", channel });
      setRecorded(true);
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.failed);
      setPending(false);
    }
  }

  return (
    <details
      className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-4"
      open={completed || queued || props.recovery?.status === "contacted"}
    >
      <summary className="cursor-pointer font-bold text-amber-200">
        {copy.title}
      </summary>
      <div className="mt-4 grid gap-4">
        {completed || queued ? (
          <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">
            {completed ? copy.recoveryDone : copy.recoveryQueued}
          </p>
        ) : null}
        <p className="text-sm leading-6 text-white/75">{copy.intro}</p>
        <button
          className="min-h-11 rounded-xl border border-amber-400/35 px-4 text-left font-bold text-amber-200 disabled:opacity-50"
          disabled={pending || completed}
          onClick={prepare}
          type="button"
        >
          {pending ? (
            <LoaderCircle className="mr-2 inline size-4 animate-spin" />
          ) : null}
          {props.recovery?.status ? copy.renew : copy.prepare}
        </button>
        {manualText ? (
          <div className="grid gap-3">
            <textarea
              aria-label={copy.copy}
              className="min-h-36 w-full rounded-xl border border-white/15 bg-[#0b0e14] p-3 text-sm leading-6"
              readOnly
              value={manualText}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="bg-accent text-accent-foreground min-h-11 rounded-xl px-4 font-bold"
                onClick={copyMessage}
                type="button"
              >
                {copied ? (
                  <Check className="mr-2 inline size-4" />
                ) : (
                  <Clipboard className="mr-2 inline size-4" />
                )}
                {copied ? copy.copied : copy.copy}
              </button>
              <a
                className="min-h-11 rounded-xl border border-white/15 px-4 py-2.5 font-bold"
                href={secureUrl}
                rel="noreferrer"
                target="_blank"
              >
                {copy.open} <ExternalLink className="ml-2 inline size-4" />
              </a>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-1 text-sm font-semibold">
                {copy.channel}
                <select
                  className="min-h-11 rounded-xl border border-white/15 bg-[#0b0e14] px-3"
                  onChange={(event) => setChannel(event.target.value)}
                  value={channel}
                >
                  <option value="sms">{copy.sms}</option>
                  <option value="whatsapp">{copy.whatsapp}</option>
                  <option value="phone">{copy.phone}</option>
                  <option value="other">{copy.other}</option>
                </select>
              </label>
              <button
                className="min-h-11 self-end rounded-xl border border-white/15 px-4 font-bold disabled:opacity-50"
                disabled={pending || recorded}
                onClick={record}
                type="button"
              >
                {recorded ? copy.recorded : copy.record}
              </button>
            </div>
          </div>
        ) : recorded ? (
          <p className="text-sm text-emerald-200">{copy.recorded}</p>
        ) : null}
        {error ? (
          <p className="text-danger text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
