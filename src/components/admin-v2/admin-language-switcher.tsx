"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { panelLanguageNames, panelLocales, type PanelLocale } from "@/lib/panel-i18n";

export function AdminLanguageSwitcher({ locale }: { locale: PanelLocale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const copy = getAdminV2Copy(locale);

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
      <span className="sr-only xl:not-sr-only">{copy.language}</span>
      <select
        aria-label={copy.language}
        className="min-h-10 rounded-xl border border-white/15 bg-background px-3 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        disabled={pending}
        onChange={(event) => void change(event.target.value as PanelLocale)}
        value={locale}
      >
        {panelLocales.map((language) => (
          <option key={language} value={language}>{panelLanguageNames[language]}</option>
        ))}
      </select>
    </label>
  );
}
