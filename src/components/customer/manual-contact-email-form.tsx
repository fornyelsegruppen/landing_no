"use client";

import { FormEvent, useState } from "react";

export function ManualContactEmailForm(props: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/customer/contact/${encodeURIComponent(props.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.get("email"),
            emailConfirmation: data.get("emailConfirmation"),
          }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        delivery?: "sent" | "queued";
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Kunne ikke lagre e-postadressen.");
      setDone(true);
      setNotice(
        result.delivery === "sent"
          ? "Takk. E-postadressen er lagret, og informasjonen er sendt på nytt."
          : "Takk. E-postadressen er lagret. Informasjonen sendes på nytt så snart leveringen er tilgjengelig.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Kunne ikke lagre e-postadressen.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-black/15 p-5"
      onSubmit={submit}
    >
      <label className="grid gap-2">
        <span className="font-semibold">E-postadresse</span>
        <input
          autoComplete="email"
          className="min-h-12 rounded-xl border border-white/15 bg-[#0d1118] px-4"
          disabled={pending || done}
          maxLength={320}
          name="email"
          required
          type="email"
        />
      </label>
      <label className="grid gap-2">
        <span className="font-semibold">Gjenta e-postadressen</span>
        <input
          autoComplete="email"
          className="min-h-12 rounded-xl border border-white/15 bg-[#0d1118] px-4"
          disabled={pending || done}
          maxLength={320}
          name="emailConfirmation"
          required
          type="email"
        />
      </label>
      <p className="text-sm leading-6 text-white/65">
        Adressen brukes til videre kommunikasjon i saken. Opplysninger i
        allerede signerte dokumenter endres ikke.
      </p>
      <button
        className="bg-accent text-accent-foreground min-h-12 rounded-xl px-5 font-bold disabled:opacity-60"
        disabled={pending || done}
        type="submit"
      >
        {pending
          ? "Lagrer og sender …"
          : done
            ? "E-postadressen er lagret"
            : "Lagre og motta informasjonen på nytt"}
      </button>
      {notice ? (
        <p
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm ${done ? "border-emerald-500/35 bg-emerald-500/10" : "border-red-400/35 bg-red-400/10"}`}
          role={done ? "status" : "alert"}
        >
          {notice}
        </p>
      ) : null}
    </form>
  );
}
