/**
 * Pure layout helpers for the Planning timeline.
 */

import { openWindows, type DateException, type WeeklyHours } from "@/lib/scheduling/availability";
import { addDays, dayOfWeek, instantToZoned, timeToMinutes, type LocalDate } from "@/lib/scheduling/time";

export type Span = { start: number; end: number };

/** Monday-first week containing `date`. */
export function weekDates(date: LocalDate): LocalDate[] {
  const monday = addDays(date, -((dayOfWeek(date) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Blocked intervals of a date as minute spans (whole-day blocks/closures span the visible range). */
export function blockedSpans(date: LocalDate, exceptions: DateException[], range: Span) {
  return exceptions
    .filter((e) => e.date === date && (e.type === "blocked" || e.type === "closed"))
    .map((e) => ({
      start: e.start ? timeToMinutes(e.start) : range.start,
      end: e.end ? timeToMinutes(e.end) : range.end,
      reason: e.reason ?? null,
      wholeDay: !e.start,
    }));
}

/**
 * Visible hour range for one or more days: covers regular hours, extra
 * openings and appointments, rounded to whole hours. Defaults to 09–20.
 */
export function visibleRange(params: {
  dates: LocalDate[];
  hours: WeeklyHours[];
  exceptions: DateException[];
  appointments: { startAt: string; endAt: string }[];
  timeZone: string;
}): Span {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const date of params.dates) {
    const regular = params.hours.filter((h) => h.dayOfWeek === dayOfWeek(date) && h.active !== false);
    for (const h of regular) {
      starts.push(timeToMinutes(h.start));
      ends.push(timeToMinutes(h.end));
    }
    for (const w of openWindows(date, params.hours, params.exceptions)) {
      starts.push(w.start);
      ends.push(w.end);
    }
  }
  for (const a of params.appointments) {
    const s = instantToZoned(Date.parse(a.startAt), params.timeZone);
    const e = instantToZoned(Date.parse(a.endAt), params.timeZone);
    if (!params.dates.includes(s.date)) continue;
    starts.push(s.minutes);
    ends.push(e.date === s.date ? e.minutes : 24 * 60);
  }
  if (starts.length === 0) return { start: 9 * 60, end: 20 * 60 };
  return {
    start: Math.floor(Math.min(...starts) / 60) * 60,
    end: Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60),
  };
}

/** Top offset and height in px for a span inside the range. */
export function place(span: Span, range: Span, pxPerMinute: number) {
  const start = Math.max(span.start, range.start);
  const end = Math.min(span.end, range.end);
  return { top: (start - range.start) * pxPerMinute, height: Math.max(0, end - start) * pxPerMinute };
}
