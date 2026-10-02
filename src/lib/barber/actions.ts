"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireBarber } from "@/lib/auth";
import { timezoneOf, toDateChoices, toSlotChoices, type DateChoice, type SlotChoice } from "@/lib/booking/choices";
import { createBooking, listDateOptions, listSlots } from "@/lib/booking/service";
import { getBookingStore } from "@/lib/booking/store";

/*
 * Nizar-only Server Actions. Each one re-checks the barber session server-side
 * and uses the barber's own slug — never a slug sent by the browser.
 * Manual bookings use "barber" mode: no minimum notice (walk-ins), same
 * hours, exceptions and overlap protection as public bookings.
 */

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

async function context() {
  const account = await requireBarber();
  const now = Date.now();
  const { store, commit } = await getBookingStore(now);
  const tz = await timezoneOf(store, { slug: account.slug });
  return { slug: account.slug, now, store, commit, tz };
}

export async function fetchManualDates(serviceId: string): Promise<DateChoice[] | null> {
  const { slug, now, store, tz } = await context();
  return toDateChoices(await listDateOptions(store, slug, str(serviceId), now, "barber"), now, tz);
}

export async function fetchManualSlots(serviceId: string, date: string): Promise<SlotChoice[] | null> {
  const { slug, now, store, tz } = await context();
  const slots = await listSlots(store, { slug, serviceId: str(serviceId), date: str(date, 10), now, mode: "barber" });
  return slots && toSlotChoices(slots, now, tz);
}

export type ManualResult =
  | { ok: true }
  | { ok: false; reason: "invalid_name" | "invalid_phone" | "error" }
  | { ok: false; reason: "slot_taken"; alternatives: SlotChoice[] };

export async function createManualAppointment(input: {
  serviceId: string;
  startAt: string;
  fullName: string;
  phone: string;
  note?: string;
}): Promise<ManualResult> {
  try {
    const { slug, now, store, commit, tz } = await context();
    const result = await createBooking(
      store,
      {
        slug,
        serviceId: str(input.serviceId),
        startAt: str(input.startAt, 40),
        fullName: str(input.fullName, 200),
        phone: str(input.phone, 40),
        note: str(input.note, 1000),
      },
      now,
      "barber",
    );
    if (result.ok) {
      await commit();
      revalidatePath("/dashboard", "layout");
      return { ok: true };
    }
    if (result.reason === "slot_taken") {
      return { ok: false, reason: "slot_taken", alternatives: toSlotChoices(result.alternatives, now, tz) };
    }
    if (result.reason === "invalid_name" || result.reason === "invalid_phone") return { ok: false, reason: result.reason };
    return { ok: false, reason: "error" };
  } catch (error) {
    unstable_rethrow(error); // requireBarber() redirects by throwing
    return { ok: false, reason: "error" };
  }
}
