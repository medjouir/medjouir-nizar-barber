import { dayName, fullDateLabel, localDateTime, shortDate } from "@/lib/format";
import type { DateOption, Slot } from "@/lib/scheduling/availability";
import { todayIn } from "@/lib/scheduling/time";
import type { BookingStore } from "./types";

/** Client-safe shapes for date and time pickers. */
export type DateChoice = { date: string; name: string; short: string; available: boolean };
export type SlotChoice = { startAt: string; time: string; date: string; dateLabel: string };

/** The barber's timezone, by public slug or by appointment token. */
export async function timezoneOf(store: BookingStore, ref: { slug: string } | { token: string }): Promise<string> {
  const barber =
    "slug" in ref
      ? await store.getBarberBySlug(ref.slug)
      : await store.findByToken(ref.token).then((f) => (f ? store.getBarberById(f.barberId) : null));
  return barber?.rules.timezone ?? "Africa/Casablanca";
}

export function toDateChoices(options: DateOption[] | null, now: number, tz: string): DateChoice[] | null {
  if (!options) return null;
  const today = todayIn(tz, now);
  return options.map((o) => ({ date: o.date, name: dayName(o.date, today), short: shortDate(o.date), available: o.available }));
}

export function toSlotChoices(slots: Slot[], now: number, tz: string): SlotChoice[] {
  const today = todayIn(tz, now);
  return slots.map((s) => {
    const { date } = localDateTime(s.startAt, tz);
    return { startAt: s.startAt, time: s.time, date, dateLabel: fullDateLabel(date, today) };
  });
}
