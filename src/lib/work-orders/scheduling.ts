const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const windowPattern = /^((?:[01]\d|2[0-3]):[0-5]\d)[–-]((?:[01]\d|2[0-3]):[0-5]\d)$/;

function minutesFromTime(value: string) {
  if (!timePattern.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

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

export function normalizeArrivalStartTime(value?: string | null) {
  const minutes = value ? minutesFromTime(value) : null;
  if (minutes === null) return "08:00";
  const rounded = Math.round(minutes / 30) * 30;
  return timeFromMinutes(Math.min(22 * 60 + 30, Math.max(6 * 60, rounded)));
}

export function defaultArrivalEndTime(start: string) {
  const minutes = minutesFromTime(start);
  if (minutes === null) return "10:00";
  return timeFromMinutes(Math.min(23 * 60, minutes + 2 * 60));
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
