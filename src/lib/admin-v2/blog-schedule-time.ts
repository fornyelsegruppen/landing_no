export const BLOG_SCHEDULE_TIME_ZONE = "Europe/Oslo";

type LocalParts = {
  day: string;
  hour: string;
  minute: string;
  month: string;
  year: string;
};

export type OsloScheduleConversion =
  | { ok: true; iso: string }
  | { ok: false; reason: "ambiguous" | "invalid" | "nonexistent" };

export function osloScheduleValidationReason(localDateTime: string) {
  if (!localDateTime) return null;
  const conversion = osloScheduleIso(localDateTime);
  return conversion.ok ? null : conversion.reason;
}

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const osloFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BLOG_SCHEDULE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsFor(date: Date): LocalParts {
  const parts = osloFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function localKey(parts: LocalParts) {
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function osloLocalDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return localKey(partsFor(date));
}

export function osloScheduleIso(localDateTime: string): OsloScheduleConversion {
  const match = localDateTimePattern.exec(localDateTime);
  if (!match) return { ok: false, reason: "invalid" };
  const [, year, month, day, hour, minute] = match;
  const target = `${year}-${month}-${day}T${hour}:${minute}`;
  const assumedUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const matches: Date[] = [];

  // Oslo's UTC offset is +01:00 or +02:00. Scan a wider fixed window so the
  // conversion is independent of the operator's browser time zone.
  for (let deltaMinutes = -240; deltaMinutes <= 240; deltaMinutes += 1) {
    const candidate = new Date(assumedUtc + deltaMinutes * 60_000);
    if (localKey(partsFor(candidate)) === target) matches.push(candidate);
  }
  if (matches.length === 0) return { ok: false, reason: "nonexistent" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, iso: matches[0].toISOString() };
}
