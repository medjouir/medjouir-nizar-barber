import { dayOfWeek, diffDays, instantToZoned, minutesToTime, type LocalDate } from "@/lib/scheduling/time";

/** Weekday names in Darija, index 0 = Sunday. */
export const DARIJA_DAYS = ["L7ed", "Tnin", "Tlat", "Larb3", "Lkhmis", "Jom3a", "Sebt"] as const;

const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"] as const;

/** "Lyouma", "Gheda", or the weekday ("Jom3a"). */
export function dayName(date: LocalDate, today: LocalDate): string {
  const diff = diffDays(today, date);
  if (diff === 0) return "Lyouma";
  if (diff === 1) return "Gheda";
  return DARIJA_DAYS[dayOfWeek(date)]!;
}

/** "9 oct". */
export function shortDate(date: LocalDate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m! - 1]}`;
}

/** "Lyouma, 2 oct" / "Jom3a 9 oct". */
export function fullDateLabel(date: LocalDate, today: LocalDate): string {
  const name = dayName(date, today);
  const isRelative = name === "Lyouma" || name === "Gheda";
  return `${name}${isRelative ? "," : ""} ${shortDate(date)}`;
}

/** 60 → "1h", 90 → "1h30", 45 → "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Local date and "HH:MM" of an ISO instant in the barber's timezone. */
export function localDateTime(iso: string, timeZone: string): { date: LocalDate; time: string } {
  const { date, minutes } = instantToZoned(Date.parse(iso), timeZone);
  return { date, time: minutesToTime(minutes) };
}
