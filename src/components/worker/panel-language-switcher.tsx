"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWorkerCopy,
  panelLanguageNames,
  panelLocales,
  type PanelLocale,
} from "@/lib/panel-i18n";

export function PanelLanguageSwitcher({ locale }: { locale: PanelLocale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const copy = getWorkerCopy(locale);

  async function change(language: PanelLocale) {
    if (language === locale) return;
    setPending(true);
    const response = await fetch("/api/user/interface-language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    }).catch(() => null);
    if (response?.ok) router.refresh();
    setPending(false);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only sm:not-sr-only">{copy.language}</span>
      <select
        aria-label={copy.language}
        className="min-h-10 rounded-lg border border-white/15 bg-background px-2 text-sm text-white outline-none focus:border-accent"
        disabled={pending}
        onChange={(event) => void change(event.target.value as PanelLocale)}
        value={locale}
      >
        {panelLocales.map((language) => (
          <option key={language} value={language}>
            {panelLanguageNames[language]}
          </option>
        ))}
      </select>
    </label>
  );
}
