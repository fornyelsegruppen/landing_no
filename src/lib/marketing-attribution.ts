export type MarketingAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  landingPage?: string;
  referrer?: string;
};

const storageKey = "takfornyelse_marketing_attribution_v1";
const queryFields = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
  gclid: "gclid",
  fbclid: "fbclid",
} as const;

function clean(value: string | null, max = 255): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

export function captureMarketingAttribution(): void {
  if (typeof window === "undefined") return;

  try {
    const stored = readMarketingAttribution();
    const params = new URLSearchParams(window.location.search);
    const next: MarketingAttribution = { ...stored };

    for (const [queryKey, field] of Object.entries(queryFields)) {
      const value = clean(params.get(queryKey));
      if (value) next[field as keyof MarketingAttribution] = value;
    }

    next.landingPage ||= clean(window.location.pathname, 500);

    if (!next.referrer && document.referrer) {
      try {
        next.referrer = clean(new URL(document.referrer).hostname, 255);
      } catch {
        // Ignore malformed browser referrers.
      }
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Attribution must never block the public site or lead form.
  }
}

export function readMarketingAttribution(): MarketingAttribution {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MarketingAttribution;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
