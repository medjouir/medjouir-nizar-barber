/**
 * Booking use cases. The frontend's availability is never trusted: every
 * write recomputes availability server-side before touching the store.
 */

import { normalizeMoroccanPhone } from "@/lib/phone";
import {
  getAvailableSlots,
  getDateOptions,
  nearestSlots,
  type ScheduleInput,
  type Slot,
} from "@/lib/scheduling/availability";
import { addDays, instantToZoned, isLocalDate, type LocalDate } from "@/lib/scheduling/time";
import type { Appointment, BookingStore, PublicBarber, Service } from "./types";

export type BookingRequest = {
  slug: string;
  serviceId: string;
  startAt: string;
  fullName: string;
  phone: string;
  note?: string;
};

export type BookingFailure =
  | { ok: false; reason: "invalid_name" | "invalid_phone" | "invalid_request" }
  | { ok: false; reason: "slot_taken"; alternatives: Slot[] };

export type BookingSuccess = { ok: true; appointment: Appointment; service: Service; barber: PublicBarber };

const MAX_NAME = 80;
const MAX_NOTE = 500;

async function loadContext(store: BookingStore, slug: string, serviceId: string) {
  const barber = await store.getBarberBySlug(slug);
  if (!barber) return null;
  const service = (await store.listServices(barber.id)).find((s) => s.id === serviceId && s.active);
  if (!service) return null;
  return { barber, service };
}

/**
 * "public": the barber's rules as configured.
 * "barber": Nizar booking manually — no minimum notice (walk-ins), same
 * opening hours, exceptions and overlap rules.
 */
export type BookingMode = "public" | "barber";

async function scheduleFor(store: BookingStore, barber: PublicBarber, mode: BookingMode = "public"): Promise<ScheduleInput> {
  const s = await store.getSchedule(barber.id);
  return {
    rules: mode === "barber" ? { ...barber.rules, minimumNoticeMinutes: 0 } : barber.rules,
    hours: s.hours,
    exceptions: s.exceptions,
    appointments: s.appointments.map((a) => ({ id: a.id, startAt: a.startAt, endAt: a.endAt, status: a.status })),
  };
}

export async function listDateOptions(
  store: BookingStore,
  slug: string,
  serviceId: string,
  now: number,
  mode: BookingMode = "public",
) {
  const ctx = await loadContext(store, slug, serviceId);
  if (!ctx) return null;
  return getDateOptions({
    durationMinutes: ctx.service.durationMinutes,
    schedule: await scheduleFor(store, ctx.barber, mode),
    now,
  });
}

export async function listSlots(
  store: BookingStore,
  params: {
    slug: string;
    serviceId: string;
    date: LocalDate;
    now: number;
    excludeAppointmentId?: string;
    mode?: BookingMode;
  },
): Promise<Slot[] | null> {
  if (!isLocalDate(params.date)) return null;
  const ctx = await loadContext(store, params.slug, params.serviceId);
  if (!ctx) return null;
  return getAvailableSlots({
    date: params.date,
    durationMinutes: ctx.service.durationMinutes,
    schedule: await scheduleFor(store, ctx.barber, params.mode),
    now: params.now,
    excludeAppointmentId: params.excludeAppointmentId,
  });
}

/** Alternatives near a lost slot: same day first, otherwise the next day that has room. */
async function alternativesFor(
  store: BookingStore,
  barber: PublicBarber,
  durationMinutes: number,
  startAt: string,
  now: number,
  excludeAppointmentId?: string,
  mode: BookingMode = "public",
): Promise<Slot[]> {
  const schedule = await scheduleFor(store, barber, mode);
  const day = instantToZoned(Date.parse(startAt), barber.rules.timezone).date;
  for (let i = 0; i < 7; i++) {
    const slots = getAvailableSlots({
      date: addDays(day, i),
      durationMinutes,
      schedule,
      now,
      excludeAppointmentId,
    });
    if (slots.length > 0) return nearestSlots(slots, startAt);
  }
  return [];
}

/**
 * 1 validate barber + service, 2 normalize phone, 3 recompute availability,
 * 4 verify the interval is still offered, 5 create/reuse client and insert
 * atomically (store-level overlap guarantee), 6 return the booking.
 */
export async function createBooking(
  store: BookingStore,
  req: BookingRequest,
  now: number,
  mode: BookingMode = "public",
): Promise<BookingSuccess | BookingFailure> {
  const fullName = req.fullName.trim().replace(/\s+/g, " ");
  if (!fullName || fullName.length > MAX_NAME) return { ok: false, reason: "invalid_name" };

  const phone = normalizeMoroccanPhone(req.phone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  const note = req.note?.trim() ? req.note.trim().slice(0, MAX_NOTE) : null;

  const ctx = await loadContext(store, req.slug, req.serviceId);
  if (!ctx || Number.isNaN(Date.parse(req.startAt))) return { ok: false, reason: "invalid_request" };
  const { barber, service } = ctx;

  const date = instantToZoned(Date.parse(req.startAt), barber.rules.timezone).date;
  const slots = getAvailableSlots({
    date,
    durationMinutes: service.durationMinutes,
    schedule: await scheduleFor(store, barber, mode),
    now,
  });
  const lost = async () => ({
    ok: false as const,
    reason: "slot_taken" as const,
    alternatives: await alternativesFor(store, barber, service.durationMinutes, req.startAt, now, undefined, mode),
  });
  const slot = slots.find((s) => Date.parse(s.startAt) === Date.parse(req.startAt));
  if (!slot) return lost();

  const result = await store.insertAppointment(barber.id, {
    serviceId: service.id,
    startAt: slot.startAt,
    endAt: slot.endAt,
    durationMinutes: service.durationMinutes,
    clientNote: note,
    client: { fullName, phone },
  });
  if (!result.ok) return lost();

  return { ok: true, appointment: result.appointment, service, barber };
}

export type ManagedAppointment = {
  appointment: Appointment;
  service: Service;
  barber: PublicBarber;
  /** Confirmed and not started yet: can still be changed or cancelled. */
  changeable: boolean;
};

export async function getByToken(store: BookingStore, token: string, now: number): Promise<ManagedAppointment | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const found = await store.findByToken(token);
  if (!found) return null;
  const barber = await store.getBarberById(found.barberId);
  const service = (await store.listServices(found.barberId)).find((s) => s.id === found.appointment.serviceId);
  if (!barber || !service) return null;
  const { appointment } = found;
  return {
    appointment,
    service,
    barber,
    changeable: appointment.status === "confirmed" && Date.parse(appointment.startAt) > now,
  };
}

/** Date options for moving an appointment (keeps its duration, ignores itself). */
export async function listRescheduleDates(store: BookingStore, token: string, now: number) {
  const managed = await getByToken(store, token, now);
  if (!managed?.changeable) return null;
  return getDateOptions({
    durationMinutes: managed.appointment.durationMinutes,
    schedule: await scheduleFor(store, managed.barber),
    now,
    excludeAppointmentId: managed.appointment.id,
  });
}

export async function listRescheduleSlots(store: BookingStore, token: string, date: LocalDate, now: number) {
  if (!isLocalDate(date)) return null;
  const managed = await getByToken(store, token, now);
  if (!managed?.changeable) return null;
  return getAvailableSlots({
    date,
    durationMinutes: managed.appointment.durationMinutes,
    schedule: await scheduleFor(store, managed.barber),
    now,
    excludeAppointmentId: managed.appointment.id,
  });
}

export async function rescheduleByToken(
  store: BookingStore,
  token: string,
  startAt: string,
  now: number,
): Promise<{ ok: true; appointment: Appointment } | BookingFailure | { ok: false; reason: "not_changeable" }> {
  const managed = await getByToken(store, token, now);
  if (!managed) return { ok: false, reason: "invalid_request" };
  if (!managed.changeable) return { ok: false, reason: "not_changeable" };
  if (Number.isNaN(Date.parse(startAt))) return { ok: false, reason: "invalid_request" };

  const { appointment, barber } = managed;
  const date = instantToZoned(Date.parse(startAt), barber.rules.timezone).date;
  const slots = getAvailableSlots({
    date,
    // The original duration is kept even if the service was edited since.
    durationMinutes: appointment.durationMinutes,
    schedule: await scheduleFor(store, barber),
    now,
    excludeAppointmentId: appointment.id,
  });
  const slot = slots.find((s) => Date.parse(s.startAt) === Date.parse(startAt));
  const lost = async () => ({
    ok: false as const,
    reason: "slot_taken" as const,
    alternatives: await alternativesFor(store, barber, appointment.durationMinutes, startAt, now, appointment.id),
  });
  if (!slot) return lost();

  const moved = await store.moveAppointment(token, slot.startAt, slot.endAt);
  if (!moved.ok) return moved.reason === "conflict" ? lost() : { ok: false, reason: "invalid_request" };
  return { ok: true, appointment: moved.appointment };
}

export async function cancelByToken(store: BookingStore, token: string, now: number) {
  const managed = await getByToken(store, token, now);
  if (!managed || !managed.changeable) return null;
  return store.cancelAppointment(token, new Date(now).toISOString());
}

export { isLocalDate };
