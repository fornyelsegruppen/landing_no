"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWorkerCopy,
  panelLanguageNames,
  panelLocales,
  type PanelLocale,
} from "@/lib/panel-i18n";
import { serializePanelLanguagePreference } from "@/lib/panel-language-preference";

export function PanelLanguageSwitcher({
  locale,
  persistToProfile = false,
}: {
  locale: PanelLocale;
  persistToProfile?: boolean;
}) {
  const router = useRouter();
  const copy = getWorkerCopy(locale);
  const [saving, setSaving] = useState(false);

  async function change(language: PanelLocale) {
    if (language === locale) return;
    if (persistToProfile) {
      setSaving(true);
      try {
        const response = await fetch("/api/user/interface-language", {
          body: JSON.stringify({ interfaceLanguage: language }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (response.ok) router.refresh();
      } finally {
        setSaving(false);
      }
      return;
    }
    document.cookie = serializePanelLanguagePreference(
      language,
      window.location.protocol === "https:",
    );
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only sm:not-sr-only">{copy.language}</span>
      <select
        aria-label={copy.language}
        aria-busy={saving}
        className="min-h-10 rounded-lg border border-white/15 bg-background px-2 text-sm text-white outline-none focus:border-accent"
        disabled={saving}
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
