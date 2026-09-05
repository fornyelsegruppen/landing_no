"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { panelLanguageNames, panelLocales, type PanelLocale } from "@/lib/panel-i18n";

export function AdminLanguageSwitcher({ locale }: { locale: PanelLocale }) {
  const router = useRouter();
  const copy = getAdminV2Copy(locale);
  const [saving, setSaving] = useState(false);

  async function change(language: PanelLocale) {
    if (language === locale) return;
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
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only xl:not-sr-only">{copy.language}</span>
      <select
        aria-label={copy.language}
        aria-busy={saving}
        className="min-h-10 rounded-xl border border-white/15 bg-background px-3 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        disabled={saving}
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
