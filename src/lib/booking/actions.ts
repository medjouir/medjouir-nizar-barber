"use server";

import { fullDateLabel, localDateTime, shortDate, dayName } from "@/lib/format";
import type { DateOption, Slot } from "@/lib/scheduling/availability";
import { todayIn } from "@/lib/scheduling/time";
import {
  cancelByToken,
  createBooking,
  listDateOptions,
  listRescheduleDates,
  listRescheduleSlots,
  listSlots,
  rescheduleByToken,
} from "./service";
import { getBookingStore } from "./store";

/*
 * Server Actions for the public booking pages. Inputs are untrusted; every
 * action re-reads data and re-validates through the booking service. Outputs
 * contain only what the visitor needs (no other clients, no private reasons).
 */

export type DateChoice = { date: string; name: string; short: string; available: boolean };
export type SlotChoice = { startAt: string; time: string; date: string; dateLabel: string };

type Store = Awaited<ReturnType<typeof getBookingStore>>["store"];

/** The barber's timezone, by public slug or by appointment token. */
async function timezoneOf(store: Store, ref: { slug: string } | { token: string }): Promise<string> {
  const barber =
    "slug" in ref
      ? await store.getBarberBySlug(ref.slug)
      : await store.findByToken(ref.token).then((f) => (f ? store.getBarberById(f.barberId) : null));
  return barber?.rules.timezone ?? "Africa/Casablanca";
}

function toDateChoices(options: DateOption[] | null, now: number, tz: string): DateChoice[] | null {
  if (!options) return null;
  const today = todayIn(tz, now);
  return options.map((o) => ({ date: o.date, name: dayName(o.date, today), short: shortDate(o.date), available: o.available }));
}

function toSlotChoices(slots: Slot[], now: number, tz: string): SlotChoice[] {
  const today = todayIn(tz, now);
  return slots.map((s) => {
    const { date } = localDateTime(s.startAt, tz);
    return { startAt: s.startAt, time: s.time, date, dateLabel: fullDateLabel(date, today) };
  });
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

export async function fetchDateOptions(slug: string, serviceId: string): Promise<DateChoice[] | null> {
  const now = Date.now();
  const { store } = await getBookingStore(now);
  return toDateChoices(await listDateOptions(store, str(slug), str(serviceId), now), now, await timezoneOf(store, { slug: str(slug) }));
}

export async function fetchSlots(slug: string, serviceId: string, date: string): Promise<SlotChoice[] | null> {
  const now = Date.now();
  const { store } = await getBookingStore(now);
  const slots = await listSlots(store, { slug: str(slug), serviceId: str(serviceId), date: str(date, 10), now });
  return slots && toSlotChoices(slots, now, await timezoneOf(store, { slug: str(slug) }));
}

export type SubmitResult =
  | { ok: true; token: string }
  | { ok: false; reason: "invalid_name" | "invalid_phone" | "error" }
  | { ok: false; reason: "slot_taken"; alternatives: SlotChoice[] };

export async function submitBooking(input: {
  slug: string;
  serviceId: string;
  startAt: string;
  fullName: string;
  phone: string;
  note?: string;
}): Promise<SubmitResult> {
  try {
    const now = Date.now();
    const { store, commit } = await getBookingStore(now);
    const result = await createBooking(
      store,
      {
        slug: str(input.slug),
        serviceId: str(input.serviceId),
        startAt: str(input.startAt, 40),
        fullName: str(input.fullName, 200),
        phone: str(input.phone, 40),
        note: str(input.note, 1000),
      },
      now,
    );
    if (result.ok) {
      await commit();
      return { ok: true, token: result.appointment.publicToken };
    }
    if (result.reason === "slot_taken") {
      const tz = await timezoneOf(store, { slug: str(input.slug) });
      return { ok: false, reason: "slot_taken", alternatives: toSlotChoices(result.alternatives, now, tz) };
    }
    if (result.reason === "invalid_name" || result.reason === "invalid_phone") return { ok: false, reason: result.reason };
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function fetchRescheduleDates(token: string): Promise<DateChoice[] | null> {
  const now = Date.now();
  const { store } = await getBookingStore(now);
  return toDateChoices(await listRescheduleDates(store, str(token, 64), now), now, await timezoneOf(store, { token: str(token, 64) }));
}

export async function fetchRescheduleSlots(token: string, date: string): Promise<SlotChoice[] | null> {
  const now = Date.now();
  const { store } = await getBookingStore(now);
  const slots = await listRescheduleSlots(store, str(token, 64), str(date, 10), now);
  return slots && toSlotChoices(slots, now, await timezoneOf(store, { token: str(token, 64) }));
}

export type ChangeResult =
  | { ok: true }
  | { ok: false; reason: "error" }
  | { ok: false; reason: "slot_taken"; alternatives: SlotChoice[] };

export async function rescheduleAppointment(token: string, startAt: string): Promise<ChangeResult> {
  try {
    const now = Date.now();
    const { store, commit } = await getBookingStore(now);
    const result = await rescheduleByToken(store, str(token, 64), str(startAt, 40), now);
    if (result.ok) {
      await commit();
      return { ok: true };
    }
    if (result.reason === "slot_taken") {
      const tz = await timezoneOf(store, { token: str(token, 64) });
      return { ok: false, reason: "slot_taken", alternatives: toSlotChoices(result.alternatives, now, tz) };
    }
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function cancelAppointment(token: string): Promise<{ ok: boolean }> {
  try {
    const now = Date.now();
    const { store, commit } = await getBookingStore(now);
    const cancelled = await cancelByToken(store, str(token, 64), now);
    if (!cancelled) return { ok: false };
    await commit();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
