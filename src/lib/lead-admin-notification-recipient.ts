import {
  normalizePanelLocale,
  type PanelLocale,
} from "@/lib/panel-i18n";

type Environment = Readonly<Record<string, string | undefined>>;

export type AdminNotificationProfile = {
  active?: boolean | null;
  email?: string | null;
  interfaceLanguage?: unknown;
  role?: string | null;
};

export type AdminNotificationRecipient = {
  email: string;
  locale: PanelLocale;
  localeSource: "admin_profile" | "fallback";
  to: string;
};

function persistedPanelLocale(value: unknown): PanelLocale | null {
  return value === "nb" || value === "lt" || value === "en" ? value : null;
}

function emailAddress(value: string) {
  const trimmed = value.trim();
  const displayNameMatch = trimmed.match(/<([^<>]+)>$/u);
  const email = (displayNameMatch?.[1] || trimmed).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/u.test(email) ? email : null;
}

/**
 * LEAD_TO_EMAIL historically accepts a comma-delimited recipient list. Keep
 * each destination separate so every administrator receives content in their
 * own persisted profile language and duplicate addresses are not notified
 * twice.
 */
export function parseAdminNotificationRecipients(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((to) => ({ email: emailAddress(to), to: to.trim() }))
    .filter(
      (recipient): recipient is { email: string; to: string } =>
        Boolean(recipient.to && recipient.email),
    )
    .filter((recipient) => {
      if (seen.has(recipient.email)) return false;
      seen.add(recipient.email);
      return true;
    });
}

export function adminNotificationFallbackLocale(
  environment: Environment = process.env,
): PanelLocale {
  return normalizePanelLocale(
    environment.LEAD_ADMIN_NOTIFICATION_FALLBACK_LOCALE || "nb",
  );
}

export function resolveAdminNotificationRecipients(input: {
  configuredRecipients: string;
  fallbackLocale?: PanelLocale;
  profiles: readonly AdminNotificationProfile[];
}): AdminNotificationRecipient[] {
  const fallbackLocale = input.fallbackLocale ?? "nb";
  const profileLocales = new Map<string, PanelLocale>();

  for (const profile of input.profiles) {
    if (
      profile.active !== true ||
      profile.role !== "admin" ||
      typeof profile.email !== "string"
    ) {
      continue;
    }
    const email = emailAddress(profile.email);
    if (!email) continue;
    const locale = persistedPanelLocale(profile.interfaceLanguage);
    if (!locale) continue;
    profileLocales.set(email, locale);
  }

  return parseAdminNotificationRecipients(input.configuredRecipients).map(
    (recipient) => {
      const profileLocale = profileLocales.get(recipient.email);
      return {
        ...recipient,
        locale: profileLocale ?? fallbackLocale,
        localeSource: profileLocale ? "admin_profile" : "fallback",
      };
    },
  );
}
