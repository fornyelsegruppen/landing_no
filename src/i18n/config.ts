export const routingConfig = {
  locales: ["no", "en"],
  defaultLocale: "no",
  localePrefix: "always",
  // Always open Norwegian first for client/share links (language switcher still works).
  localeDetection: false,
  // Next's metadata is the single hreflang source of truth. The middleware's
  // generated Link header used unprefixed x-default URLs that redirected again,
  // which sent Google conflicting canonicalisation signals.
  alternateLinks: false,
} as const;
