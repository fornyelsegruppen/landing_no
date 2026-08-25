const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const windowPattern = /^((?:[01]\d|2[0-3]):[0-5]\d)[–-]((?:[01]\d|2[0-3]):[0-5]\d)$/;

export function parseArrivalWindow(value?: string | null) {
  const match = value?.trim().match(windowPattern);
  return match ? { start: match[1], end: match[2] } : null;
}

export function arrivalWindowFromTimes(start: string, end: string) {
  if (!timePattern.test(start) || !timePattern.test(end)) {
    throw new TypeError("Arrival times must use HH:mm");
  }
  if (end <= start) {
    throw new TypeError("Arrival end time must be later than the start time");
  }
  return `${start}–${end}`;
}

export function validateArrivalWindowForSchedule(
  scheduledLocal: string | null | undefined,
  arrivalWindow: string | null | undefined,
) {
  if (!arrivalWindow) return null;
  const parsed = parseArrivalWindow(arrivalWindow);
  if (!parsed) throw new TypeError("Arrival window must use HH:mm–HH:mm");
  arrivalWindowFromTimes(parsed.start, parsed.end);
  if (scheduledLocal && scheduledLocal.slice(11, 16) !== parsed.start) {
    throw new TypeError("The planned start time must match the arrival window start");
  }
  return `${parsed.start}–${parsed.end}`;
}
