"use client";

import { useRouter } from "next/navigation";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { panelLanguageNames, panelLocales, type PanelLocale } from "@/lib/panel-i18n";
import { serializePanelLanguagePreference } from "@/lib/panel-language-preference";

export function AdminLanguageSwitcher({ locale }: { locale: PanelLocale }) {
  const router = useRouter();
  const copy = getAdminV2Copy(locale);

  function change(language: PanelLocale) {
    if (language === locale) return;
    document.cookie = serializePanelLanguagePreference(
      language,
      window.location.protocol === "https:",
    );
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only xl:not-sr-only">{copy.language}</span>
      <select
        aria-label={copy.language}
        className="min-h-10 rounded-xl border border-white/15 bg-background px-3 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        onChange={(event) => change(event.target.value as PanelLocale)}
        value={locale}
      >
        {panelLocales.map((language) => (
          <option key={language} value={language}>{panelLanguageNames[language]}</option>
        ))}
      </select>
    </label>
  );
}
