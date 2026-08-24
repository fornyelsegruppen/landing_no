export const NORWAY_TIME_ZONE = "Europe/Oslo";

type DateValue = Date | number | string;

function date(value: DateValue) {
  const result = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(result.getTime())) throw new TypeError("Invalid date");
  return result;
}

export function norwayDateKey(value: DateValue) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NORWAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatNorwayDateTime(
  value: DateValue,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: NORWAY_TIME_ZONE,
  }).format(date(value));
}

export function formatNorwayDateTimeInput(value: DateValue) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NORWAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function timeZoneOffsetMilliseconds(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - value.getTime();
}

export function norwayLocalDateTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new TypeError("Invalid Norwegian local date and time");
  const [, year, month, day, hour, minute] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let instant = new Date(
    localAsUtc -
      timeZoneOffsetMilliseconds(new Date(localAsUtc), NORWAY_TIME_ZONE),
  );
  instant = new Date(
    localAsUtc - timeZoneOffsetMilliseconds(instant, NORWAY_TIME_ZONE),
  );
  if (formatNorwayDateTimeInput(instant) !== value) {
    throw new TypeError("This local time does not exist in Norway");
  }
  return instant.toISOString();
}
