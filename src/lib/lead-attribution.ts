export const attributionKeys = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
] as const;

export type MarketingConsentChoice = "granted" | "denied" | "unknown";

export type LeadAttribution = Partial<
  Record<(typeof attributionKeys)[number], string>
> & {
  landingPage?: string;
  referrer?: string;
  contentSourcePath?: string;
  marketingConsent?: MarketingConsentChoice;
};

const CONTENT_SOURCE_KEY = "takfornyelse_content_source";
const CONTENT_SOURCE_TTL_MS = 30 * 60 * 1000;
const CONTENT_SOURCE_PATTERN = /^\/(no|en)\/blogg\/[a-z0-9-]+$/;

type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;

export function storeContentSource(
  storage: SessionStorageLike,
  path: string,
  now: number = Date.now(),
) {
  if (!CONTENT_SOURCE_PATTERN.test(path)) return false;
  storage.setItem(CONTENT_SOURCE_KEY, JSON.stringify({ path, at: now }));
  return true;
}

export function readContentSource(
  storage: SessionStorageLike,
  now: number = Date.now(),
) {
  try {
    const raw = storage.getItem(CONTENT_SOURCE_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as { at?: number; path?: string };
    if (
      typeof value.at !== "number" ||
      typeof value.path !== "string" ||
      now - value.at > CONTENT_SOURCE_TTL_MS ||
      !CONTENT_SOURCE_PATTERN.test(value.path)
    ) {
      return undefined;
    }
    return value.path;
  } catch {
    return undefined;
  }
}

const queryParamByField: Record<(typeof attributionKeys)[number], string> = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
  gclid: "gclid",
  gbraid: "gbraid",
  wbraid: "wbraid",
  fbclid: "fbclid",
  msclkid: "msclkid",
};

function clean(value: string | null, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function captureLeadAttribution(
  href: string,
  referrer = "",
  contentSourcePath?: string,
): LeadAttribution {
  const url = new URL(href);
  const contentSource = CONTENT_SOURCE_PATTERN.test(contentSourcePath || "")
    ? clean(contentSourcePath ?? null, 500)
    : undefined;
  const attribution: LeadAttribution = {
    landingPage: clean(url.href, 1000),
    referrer: clean(referrer, 1000),
    ...(contentSource ? { contentSourcePath: contentSource } : {}),
  };

  for (const field of attributionKeys) {
    const maxLength = field.startsWith("utm") ? 255 : 512;
    const value = clean(
      url.searchParams.get(queryParamByField[field]),
      maxLength,
    );
    if (value) attribution[field] = value;
  }

  return attribution;
}
