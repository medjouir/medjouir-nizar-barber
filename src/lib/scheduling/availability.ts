/**
 * Availability engine — pure, deterministic, no I/O.
 *
 * For one barber, service and date, a start time is offered when:
 *   1. the whole service [start, start + duration) fits inside an open window
 *      (regular business hours + date-specific "available" openings, minus
 *      "blocked" intervals; a "closed" date has no windows);
 *   2. it keeps `bufferMinutes` of clearance before and after every
 *      time-occupying appointment (confirmed / completed);
 *   3. it is at least `minimumNoticeMinutes` after `now`;
 *   4. its date is within the booking horizon (today + horizonDays - 1);
 *   5. it falls on the slot grid (multiples of slotIntervalMinutes from local midnight).
 * All wall-clock values are interpreted in the barber's timezone.
 */

import type { AppointmentStatus } from "@/lib/database.types";
import {
  addDays,
  dayOfWeek,
  diffDays,
  instantToZoned,
  minutesToMs,
  minutesToTime,
  timeToMinutes,
  todayIn,
  zonedTimeToInstant,
  type LocalDate,
} from "./time";

export type BookingRules = {
  timezone: string;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minimumNoticeMinutes: number;
  horizonDays: number;
};

export type WeeklyHours = { dayOfWeek: number; start: string; end: string; active?: boolean };

export type DateException = {
  id?: string;
  date: LocalDate;
  type: "available" | "blocked" | "closed";
  /** Both null/undefined = whole day. */
  start?: string | null;
  end?: string | null;
  /** Private note (barber only). Ignored by the engine; never sent to public pages. */
  reason?: string | null;
};

export type ExistingAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
};

export type ScheduleInput = {
  rules: BookingRules;
  hours: WeeklyHours[];
  exceptions: DateException[];
  appointments: ExistingAppointment[];
};

export type Slot = {
  /** ISO instant. */
  startAt: string;
  endAt: string;
  /** Local "HH:MM". */
  time: string;
};

type Range = { start: number; end: number };

/** Statuses that occupy time. Cancelled and no-show free their slot. */
export const OCCUPYING_STATUSES: readonly AppointmentStatus[] = ["confirmed", "completed"];

/** Open windows of a local date, as local minute ranges (merged, sorted). */
export function openWindows(date: LocalDate, hours: WeeklyHours[], exceptions: DateException[]): Range[] {
  const ofDay = exceptions.filter((e) => e.date === date);
  if (ofDay.some((e) => e.type === "closed")) return [];
  if (ofDay.some((e) => e.type === "blocked" && !e.start)) return [];

  const dow = dayOfWeek(date);
  const open: Range[] = [
    ...hours
      .filter((h) => h.dayOfWeek === dow && h.active !== false)
      .map((h) => ({ start: timeToMinutes(h.start), end: timeToMinutes(h.end) })),
    ...ofDay
      .filter((e) => e.type === "available" && e.start && e.end)
      .map((e) => ({ start: timeToMinutes(e.start!), end: timeToMinutes(e.end!) })),
  ];

  const blocked = ofDay
    .filter((e) => e.type === "blocked" && e.start && e.end)
    .map((e) => ({ start: timeToMinutes(e.start!), end: timeToMinutes(e.end!) }));

  return subtract(merge(open), blocked);
}

/** Bookable start times for a service on a date. */
export function getAvailableSlots(params: {
  date: LocalDate;
  durationMinutes: number;
  schedule: ScheduleInput;
  now: number;
  /** Ignore this appointment (rescheduling it must not collide with itself). */
  excludeAppointmentId?: string;
}): Slot[] {
  const { date, durationMinutes, schedule, now, excludeAppointmentId } = params;
  const { rules } = schedule;
  const tz = rules.timezone;

  const today = todayIn(tz, now);
  const offset = diffDays(today, date);
  if (offset < 0 || offset >= rules.horizonDays) return [];

  const windows = openWindows(date, schedule.hours, schedule.exceptions).map((w) => ({
    start: zonedTimeToInstant(date, w.start, tz),
    end: zonedTimeToInstant(date, w.end, tz),
  }));
  if (windows.length === 0) return [];

  const duration = minutesToMs(durationMinutes);
  const buffer = minutesToMs(rules.bufferMinutes);
  const earliest = now + minutesToMs(rules.minimumNoticeMinutes);

  // Busy ranges grown by the buffer on both sides.
  const busy: Range[] = schedule.appointments
    .filter((a) => a.id !== excludeAppointmentId && OCCUPYING_STATUSES.includes(a.status))
    .map((a) => ({ start: Date.parse(a.startAt) - buffer, end: Date.parse(a.endAt) + buffer }));

  const slots: Slot[] = [];
  for (let m = 0; m < 24 * 60; m += rules.slotIntervalMinutes) {
    const start = zonedTimeToInstant(date, m, tz);
    const end = start + duration;
    if (start < earliest) continue;
    if (!windows.some((w) => start >= w.start && end <= w.end)) continue;
    if (busy.some((b) => start < b.end && end > b.start)) continue;
    // Guard against DST gaps mapping two grid points to the same local time.
    if (instantToZoned(start, tz).minutes !== m) continue;
    slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), time: minutesToTime(m) });
  }
  return slots;
}

export type DateOption = { date: LocalDate; available: boolean };

/** Every date of the booking horizon, flagged by whether the service fits at least once. */
export function getDateOptions(params: {
  durationMinutes: number;
  schedule: ScheduleInput;
  now: number;
  excludeAppointmentId?: string;
}): DateOption[] {
  const { schedule, now } = params;
  const today = todayIn(schedule.rules.timezone, now);
  return Array.from({ length: schedule.rules.horizonDays }, (_, i) => {
    const date = addDays(today, i);
    return { date, available: getAvailableSlots({ ...params, date }).length > 0 };
  });
}

/** The `count` slots closest in time to `requestedAt`, in chronological order. */
export function nearestSlots(slots: Slot[], requestedAt: string, count = 3): Slot[] {
  const target = Date.parse(requestedAt);
  return [...slots]
    .sort((a, b) => Math.abs(Date.parse(a.startAt) - target) - Math.abs(Date.parse(b.startAt) - target))
    .slice(0, count)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

function merge(ranges: Range[]): Range[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

function subtract(ranges: Range[], cuts: Range[]): Range[] {
  let out = ranges;
  for (const cut of cuts) {
    out = out.flatMap((r) => {
      if (cut.end <= r.start || cut.start >= r.end) return [r];
      const parts: Range[] = [];
      if (cut.start > r.start) parts.push({ start: r.start, end: cut.start });
      if (cut.end < r.end) parts.push({ start: cut.end, end: r.end });
      return parts;
    });
  }
  return out;
}
