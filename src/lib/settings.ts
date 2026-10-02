/**
 * Validation for Nizar's settings. Mirrors the database CHECK constraints so
 * errors are caught with a clear message before reaching storage. Every
 * function returns either a normalized value or an error code.
 */

import type { BookingRules, DateException, WeeklyHours } from "@/lib/scheduling/availability";
import { isLocalDate, timeToMinutes } from "@/lib/scheduling/time";

export type Invalid = { ok: false; error: string };
export type Valid<T> = { ok: true; value: T };
type Result<T> = Valid<T> | Invalid;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = (error: string): Invalid => ({ ok: false, error });

/* Services --------------------------------------------------------------- */

export const DURATION_CHOICES = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240] as const;

export function validateService(input: { name: unknown; durationMinutes: unknown; active: unknown }): Result<{
  name: string;
  durationMinutes: number;
  active: boolean;
}> {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 1 || name.length > 60) return bad("name");
  const duration = Number(input.durationMinutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480 || duration % 5 !== 0) return bad("duration");
  return { ok: true, value: { name, durationMinutes: duration, active: input.active === true } };
}

/* Business hours ---------------------------------------------------------- */

/** Validates a full week: "HH:MM" times, start < end, no overlap within a day. */
export function validateHours(input: unknown): Result<WeeklyHours[]> {
  if (!Array.isArray(input) || input.length > 7 * 6) return bad("hours");
  const hours: WeeklyHours[] = [];
  for (const raw of input) {
    const { dayOfWeek, start, end } = (raw ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(dayOfWeek) || (dayOfWeek as number) < 0 || (dayOfWeek as number) > 6) return bad("hours");
    if (typeof start !== "string" || typeof end !== "string" || !TIME.test(start) || !TIME.test(end)) return bad("time");
    if (timeToMinutes(end) <= timeToMinutes(start)) return bad("order");
    hours.push({ dayOfWeek: dayOfWeek as number, start, end });
  }
  for (let d = 0; d < 7; d++) {
    const day = hours.filter((h) => h.dayOfWeek === d).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (let i = 1; i < day.length; i++) {
      if (timeToMinutes(day[i]!.start) < timeToMinutes(day[i - 1]!.end)) return bad("overlap");
    }
  }
  return {
    ok: true,
    value: hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek || timeToMinutes(a.start) - timeToMinutes(b.start)),
  };
}

/* Unavailability ("Ma disponiblech") -------------------------------------- */

export function validateBlock(
  input: { date: unknown; wholeDay: unknown; start: unknown; end: unknown; reason: unknown },
  today: string,
): Result<DateException> {
  if (!isLocalDate(input.date) || input.date < today) return bad("date");
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim().slice(0, 200) : null;
  if (input.wholeDay === true) return { ok: true, value: { date: input.date, type: "blocked", start: null, end: null, reason } };
  const { start, end } = input;
  if (typeof start !== "string" || typeof end !== "string" || !TIME.test(start) || !TIME.test(end)) return bad("time");
  if (timeToMinutes(end) <= timeToMinutes(start)) return bad("order");
  return { ok: true, value: { date: input.date, type: "blocked", start, end, reason } };
}

/* Booking rules ------------------------------------------------------------ */

export const RULE_CHOICES = {
  slotIntervalMinutes: [5, 10, 15, 20, 30, 60],
  bufferMinutes: [0, 5, 10, 15, 20, 30],
  minimumNoticeMinutes: [0, 15, 30, 60, 120, 240, 1440],
  horizonDays: [7, 14, 30, 60, 90],
} as const;

export function validateRules(
  input: Record<string, unknown>,
  current: BookingRules,
): Result<BookingRules> {
  const pick = <K extends keyof typeof RULE_CHOICES>(key: K): number | null => {
    const n = Number(input[key]);
    return (RULE_CHOICES[key] as readonly number[]).includes(n) ? n : null;
  };
  const slot = pick("slotIntervalMinutes");
  const buffer = pick("bufferMinutes");
  const notice = pick("minimumNoticeMinutes");
  const horizon = pick("horizonDays");
  if (slot === null || buffer === null || notice === null || horizon === null) return bad("rules");
  return {
    ok: true,
    value: { ...current, slotIntervalMinutes: slot, bufferMinutes: buffer, minimumNoticeMinutes: notice, horizonDays: horizon },
  };
}

/* Profile ------------------------------------------------------------------ */

export function validateProfile(input: Record<string, unknown>): Result<{
  publicName: string;
  salonName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  mapsUrl: string | null;
}> {
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const publicName = text(input.publicName, 60);
  if (!publicName) return bad("name");
  const mapsUrl = text(input.mapsUrl, 500);
  if (mapsUrl && !/^https:\/\/\S+$/.test(mapsUrl)) return bad("maps");
  return {
    ok: true,
    value: {
      publicName,
      salonName: text(input.salonName, 80),
      phone: text(input.phone, 20),
      address: text(input.address, 200),
      city: text(input.city, 80),
      mapsUrl,
    },
  };
}
