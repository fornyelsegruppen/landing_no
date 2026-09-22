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
const ACQUISITION_STORAGE_KEY = "takfornyelse_lead_acquisition";
export const ACQUISITION_TTL_MS = 30 * 60 * 1000;

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

export function hasCampaignAttribution(attribution: LeadAttribution) {
  return attributionKeys.some((key) => Boolean(attribution[key]));
}

function readAcquisition(
  storage: SessionStorageLike,
  landingPage: string | undefined,
  now: number,
): LeadAttribution | undefined {
  if (!landingPage) return undefined;
  try {
    const raw = storage.getItem(ACQUISITION_STORAGE_KEY);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Partial<
      Record<(typeof attributionKeys)[number], unknown>
    > & {
      at?: number;
      landingPage?: string;
      referrer?: string;
    };
    if (
      typeof stored.at !== "number" ||
      stored.at > now ||
      now - stored.at >= ACQUISITION_TTL_MS ||
      typeof stored.landingPage !== "string" ||
      new URL(stored.landingPage).origin !== new URL(landingPage).origin
    ) {
      return undefined;
    }
    const attribution = captureLeadAttribution(
      stored.landingPage,
      typeof stored.referrer === "string" ? stored.referrer : "",
    );
    for (const key of attributionKeys) {
      const value = stored[key];
      if (typeof value === "string") {
        attribution[key] = clean(value, key.startsWith("utm") ? 255 : 512);
      }
    }
    return attribution;
  } catch {
    return undefined;
  }
}

/** Persist acquisition only after consent; callers may keep pre-consent context in memory. */
export function rememberLeadAcquisition(
  storage: SessionStorageLike,
  attribution: LeadAttribution,
  consent: MarketingConsentChoice,
  now: number = Date.now(),
) {
  if (consent !== "granted" || !attribution.landingPage) return;
  const previous = readAcquisition(storage, attribution.landingPage, now);
  // Ordinary navigation must not replace the landing URL or extend its lifetime.
  if (
    previous &&
    (!hasCampaignAttribution(attribution) ||
      (previous.landingPage === attribution.landingPage &&
        attributionKeys.every((key) => previous[key] === attribution[key])))
  ) {
    return;
  }
  const acquisition = captureLeadAttribution(
    attribution.landingPage,
    attribution.referrer,
  );
  for (const key of attributionKeys) {
    if (attribution[key]) acquisition[key] = attribution[key];
  }
  try {
    storage.setItem(
      ACQUISITION_STORAGE_KEY,
      JSON.stringify({
        at: now,
        ...acquisition,
      }),
    );
  } catch {}
}

export function resolveLeadAcquisition(
  storage: SessionStorageLike,
  current: LeadAttribution,
  consent: MarketingConsentChoice,
  now: number = Date.now(),
): LeadAttribution {
  if (consent !== "granted" || hasCampaignAttribution(current)) return current;
  const acquisition = readAcquisition(storage, current.landingPage, now);
  return acquisition
    ? {
        ...acquisition,
        ...(current.contentSourcePath
          ? { contentSourcePath: current.contentSourcePath }
          : {}),
      }
    : current;
}

export function clearLeadAcquisition(storage: Pick<Storage, "removeItem">) {
  try {
    storage.removeItem(ACQUISITION_STORAGE_KEY);
  } catch {}
}
