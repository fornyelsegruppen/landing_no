function isoWeekParts(date: Date) {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return { year: utc.getUTCFullYear(), week };
}

export const SEO_TIME_ZONE = "Europe/Oslo";
export const SEO_DRAFT_LOCAL_HOUR = 9;

function osloDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    date: new Date(Date.UTC(get("year"), get("month") - 1, get("day"))),
    hour: get("hour"),
  };
}

export function seoDraftDue(date: Date) {
  const local = osloDate(date);
  return (
    [1, 4].includes(local.date.getUTCDay()) &&
    local.hour >= SEO_DRAFT_LOCAL_HOUR
  );
}

export function nextConfiguredSeoDraftAt(now: Date) {
  for (let day = 0; day < 9; day++) {
    for (const hour of [7, 8]) {
      const candidate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + day,
          hour,
        ),
      );
      const local = osloDate(candidate);
      if (
        candidate > now &&
        [1, 4].includes(local.date.getUTCDay()) &&
        local.hour === SEO_DRAFT_LOCAL_HOUR
      )
        return candidate.toISOString();
    }
  }
  throw new TypeError("Could not resolve the next Oslo draft slot");
}

export function seoWeekKey(date: Date) {
  const { year, week } = isoWeekParts(osloDate(date).date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function seoDraftSlot(date: Date) {
  const day = osloDate(date).date.getUTCDay();
  return day >= 4 || day === 0 ? "thursday" : "monday";
}

function previewCanaryId(environment: Record<string, string | undefined>) {
  if (environment.VERCEL_ENV !== "preview") return null;
  const value = environment.SEO_PREVIEW_CANARY_ID?.trim();
  return value && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function seoDraftIdempotencyKey(
  date: Date,
  environment: Record<string, string | undefined> = process.env,
) {
  const base = `seo-draft:${seoWeekKey(date)}:${seoDraftSlot(date)}`;
  const canaryId = previewCanaryId(environment);
  return canaryId ? `${base}:preview-canary:${canaryId}` : base;
}
