/**
 * Pure helpers for Nizar's "Lyouma" screen: the day's programme with free
 * gaps, today's count and the next appointment.
 */

import type { AppointmentStatus } from "@/lib/database.types";
import { openWindows, type DateException, type WeeklyHours } from "@/lib/scheduling/availability";
import { instantToZoned, minutesToTime, todayIn, type LocalDate } from "@/lib/scheduling/time";

export type DayAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  note: string | null;
};

export type ProgramItem =
  | { kind: "appointment"; start: string; end: string; appointment: DayAppointment }
  | { kind: "free"; start: string; end: string; minutes: number };

/** Appointments shown on a day: everything except cancellations, in time order. */
export function appointmentsOn(date: LocalDate, timeZone: string, appointments: DayAppointment[]): DayAppointment[] {
  return appointments
    .filter((a) => a.status !== "cancelled" && instantToZoned(Date.parse(a.startAt), timeZone).date === date)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

/**
 * The day's programme: appointments plus "Libre" gaps inside opening hours.
 * Only gaps of at least `minFreeMinutes` that are still ahead of `now` count
 * as meaningful.
 */
export function buildDayProgram(params: {
  date: LocalDate;
  timeZone: string;
  now: number;
  hours: WeeklyHours[];
  exceptions: DateException[];
  appointments: DayAppointment[];
  minFreeMinutes?: number;
  /** Free time today starts at "now" rounded up to this grid (e.g. 12:13 → 12:15). */
  slotIntervalMinutes?: number;
}): ProgramItem[] {
  const { date, timeZone, now, minFreeMinutes = 30, slotIntervalMinutes = 15 } = params;
  const local = (iso: string) => instantToZoned(Date.parse(iso), timeZone).minutes;
  const day = appointmentsOn(date, timeZone, params.appointments);

  const items: (ProgramItem & { at: number })[] = day.map((a) => ({
    kind: "appointment",
    at: local(a.startAt),
    start: minutesToTime(local(a.startAt)),
    end: minutesToTime(local(a.endAt)),
    appointment: a,
  }));

  const today = todayIn(timeZone, now);
  if (date >= today) {
    const nowMinutes = instantToZoned(now, timeZone).minutes;
    const from = date === today ? Math.ceil(nowMinutes / slotIntervalMinutes) * slotIntervalMinutes : 0;
    // No-shows don't occupy time; everything else on the day does.
    const busy = day
      .filter((a) => a.status !== "no_show")
      .map((a) => ({ start: local(a.startAt), end: local(a.endAt) }));

    for (const w of openWindows(date, params.hours, params.exceptions)) {
      let cursor = Math.max(w.start, from);
      for (const b of busy.filter((b) => b.end > cursor && b.start < w.end).sort((x, y) => x.start - y.start)) {
        if (b.start - cursor >= minFreeMinutes) items.push(free(cursor, b.start));
        cursor = Math.max(cursor, b.end);
      }
      if (w.end - cursor >= minFreeMinutes) items.push(free(cursor, w.end));
    }
  }

  return items.sort((a, b) => a.at - b.at).map(({ at: _at, ...item }) => item);
}

function free(start: number, end: number): ProgramItem & { at: number } {
  return { kind: "free", at: start, start: minutesToTime(start), end: minutesToTime(end), minutes: end - start };
}

/** The confirmed appointment happening now or coming next, any day. */
export function nextAppointment(appointments: DayAppointment[], now: number): DayAppointment | null {
  return (
    appointments
      .filter((a) => a.status === "confirmed" && Date.parse(a.endAt) > now)
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0] ?? null
  );
}
