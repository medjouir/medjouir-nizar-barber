/**
 * Timezone-safe calendar helpers built on Intl (no hardcoded UTC offsets).
 *
 * Conventions:
 *   - LocalDate: "YYYY-MM-DD" wall-calendar date in the barber's timezone.
 *   - Minutes: minutes since local midnight (0–1440).
 *   - Instants: epoch milliseconds (UTC).
 */

export type LocalDate = string;

const MINUTE = 60_000;
const DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let dtf = formatters.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, dtf);
  }
  return dtf;
}

function zonedParts(instant: number, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(instant))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour! % 24,
    minute: parts.minute!,
    second: parts.second!,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in ms (e.g. +3_600_000 for GMT+1). */
export function timeZoneOffset(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Instant of a wall-clock time on a local date in `timeZone`. */
export function zonedTimeToInstant(date: LocalDate, minutes: number, timeZone: string): number {
  const [y, m, d] = parseDate(date);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = timeZoneOffset(guess, timeZone);
  const candidate = guess - first;
  const second = timeZoneOffset(candidate, timeZone);
  return first === second ? candidate : guess - second;
}

/** Local date and minutes-since-midnight of an instant in `timeZone`. */
export function instantToZoned(instant: number, timeZone: string): { date: LocalDate; minutes: number } {
  const p = zonedParts(instant, timeZone);
  return { date: formatDate(p.year, p.month, p.day), minutes: p.hour * 60 + p.minute };
}

export function todayIn(timeZone: string, now: number): LocalDate {
  return instantToZoned(now, timeZone).date;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return formatDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from `a` to `b`. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = parseDate(a);
  const [by, bm, bd] = parseDate(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: LocalDate): number {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "HH:MM" or "HH:MM:SS" → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

/** minutes since midnight → "HH:MM". */
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parseDate(value);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export const minutesToMs = (minutes: number) => minutes * MINUTE;

function parseDate(date: LocalDate): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y!, m!, d!];
}

function formatDate(y: number, m: number, d: number): LocalDate {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
