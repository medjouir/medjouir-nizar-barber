"use server";

import { revalidatePath } from "next/cache";
import { requireBarber } from "@/lib/auth";
import { getBookingStore } from "@/lib/booking/store";
import { todayIn } from "@/lib/scheduling/time";
import { validateBlock, validateHours, validateProfile, validateRules, validateService } from "@/lib/settings";

/*
 * Settings Server Actions (Nizar only). Inputs are validated with lib/settings
 * — the same rules as the database constraints — before anything is stored.
 * Settings affect public pages too (hours, services, name), so the whole app
 * is revalidated after each change.
 */

export type SaveResult = { ok: true } | { ok: false; error: string };

async function context() {
  const account = await requireBarber();
  const now = Date.now();
  const { store, commit } = await getBookingStore(now);
  const barber = await store.getBarberBySlug(account.slug);
  if (!barber) throw new Error("Barber not found");
  const done = async (): Promise<SaveResult> => {
    await commit();
    revalidatePath("/", "layout");
    return { ok: true };
  };
  return { now, store, barber, done };
}

export async function saveService(id: string, input: { name: string; durationMinutes: number; active: boolean }): Promise<SaveResult> {
  const { store, barber, done } = await context();
  const valid = validateService(input);
  if (!valid.ok) return valid;
  if (!(await store.updateService(barber.id, String(id).slice(0, 80), valid.value))) return { ok: false, error: "not_found" };
  return done();
}

export async function saveHours(hours: { dayOfWeek: number; start: string; end: string }[]): Promise<SaveResult> {
  const { store, barber, done } = await context();
  const valid = validateHours(hours);
  if (!valid.ok) return valid;
  await store.setHours(barber.id, valid.value);
  return done();
}

export async function addBlock(input: { date: string; wholeDay: boolean; start: string; end: string; reason: string }): Promise<SaveResult> {
  const { store, barber, done, now } = await context();
  const valid = validateBlock(input, todayIn(barber.rules.timezone, now));
  if (!valid.ok) return valid;
  await store.addException(barber.id, valid.value);
  return done();
}

export async function removeBlock(id: string): Promise<SaveResult> {
  const { store, barber, done } = await context();
  if (!(await store.removeException(barber.id, String(id).slice(0, 80)))) return { ok: false, error: "not_found" };
  return done();
}

export async function saveRules(input: Record<string, unknown>): Promise<SaveResult> {
  const { store, barber, done } = await context();
  const valid = validateRules(input ?? {}, barber.rules);
  if (!valid.ok) return valid;
  await store.updateBarber(barber.id, { rules: valid.value });
  return done();
}

export async function saveProfile(input: Record<string, unknown>): Promise<SaveResult> {
  const { store, barber, done } = await context();
  const valid = validateProfile(input ?? {});
  if (!valid.ok) return valid;
  await store.updateBarber(barber.id, valid.value);
  return done();
}
