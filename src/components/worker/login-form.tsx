"use client";

import { FormEvent, useState } from "react";

export function WorkerLoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/users/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Innloggingen mislyktes. Kontroller opplysningene eller kontakt administrator.");
      setPending(false);
      return;
    }

    window.location.assign("/user");
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="email">
          E-post
        </label>
        <input
          autoComplete="username"
          className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="password">
          Passord
        </label>
        <input
          autoComplete="current-password"
          className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {error ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="min-h-12 w-full rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Logger inn …" : "Logg inn"}
      </button>
    </form>
  );
}
