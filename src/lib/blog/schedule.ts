function isoWeekParts(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: utc.getUTCFullYear(), week };
}

export function seoWeekKey(date: Date) {
  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function seoDraftSlot(date: Date) {
  const day = date.getUTCDay();
  return day >= 4 || day === 0 ? "thursday" : "monday";
}

export function seoDraftIdempotencyKey(date: Date) {
  return `seo-draft:${seoWeekKey(date)}:${seoDraftSlot(date)}`;
}
