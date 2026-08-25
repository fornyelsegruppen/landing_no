import type { PanelLocale } from "@/lib/panel-i18n";

export const panelLanguagePreferenceCookie = "tf_panel_language_ui";

export function serializePanelLanguagePreference(
  language: PanelLocale,
  secure: boolean,
) {
  return [
    `${panelLanguagePreferenceCookie}=${encodeURIComponent(language)}`,
    "Path=/",
    "Max-Age=31536000",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
