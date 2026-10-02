import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentRow,
  BarberRow,
  BusinessHoursRow,
  ClientRow,
  Database,
  ScheduleExceptionRow,
  ServiceRow,
} from "@/lib/database.types";
import type { DateException, WeeklyHours } from "@/lib/scheduling/availability";
import type { Appointment, BarberSchedule, BookingStore, Client, NewAppointment, PublicBarber, Service } from "./types";

/**
 * BookingStore on Supabase, used by the Next.js server with the service-role
 * key. RLS is bypassed, so every query is explicitly scoped by barber id (or
 * by the 256-bit public token). Writes that must be race-free go through the
 * SQL functions in supabase/migrations/20261002090000_booking_functions.sql.
 */

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

const toBarber = (r: BarberRow): PublicBarber => ({
  id: r.id,
  slug: r.slug,
  publicName: r.public_name,
  salonName: r.salon_name,
  phone: r.phone,
  address: r.address,
  city: r.city,
  mapsUrl: r.maps_url,
  rules: {
    timezone: r.timezone,
    slotIntervalMinutes: r.slot_interval_minutes,
    bufferMinutes: r.buffer_minutes,
    minimumNoticeMinutes: r.minimum_booking_notice_minutes,
    horizonDays: r.booking_horizon_days,
  },
});

const toService = (r: ServiceRow): Service => ({
  id: r.id,
  name: r.name,
  durationMinutes: r.duration_minutes,
  active: r.active,
  displayOrder: r.display_order,
});

const toHours = (r: BusinessHoursRow): WeeklyHours => ({
  dayOfWeek: r.day_of_week,
  start: hhmm(r.start_time)!,
  end: hhmm(r.end_time)!,
  active: r.active,
});

const toException = (r: ScheduleExceptionRow): DateException => ({
  id: r.id,
  date: r.date,
  type: r.type,
  start: hhmm(r.start_time),
  end: hhmm(r.end_time),
  reason: r.reason,
});

const toAppointment = (r: AppointmentRow): Appointment => ({
  id: r.id,
  serviceId: r.service_id,
  clientId: r.client_id,
  startAt: new Date(r.start_at).toISOString(),
  endAt: new Date(r.end_at).toISOString(),
  durationMinutes: r.duration_snapshot,
  status: r.status,
  clientNote: r.client_note,
  publicToken: r.public_token,
  createdAt: r.created_at,
  cancelledAt: r.cancelled_at,
});

const toClient = (r: ClientRow): Client => ({ id: r.id, fullName: r.full_name, phone: r.phone });

type Result<T> = { data: T | null; error: { message: string } | null };

/** Lists, single() and RPCs: data is always present unless there is an error. */
function must<T>(result: Result<T>): NonNullable<T> {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  return (result.data ?? []) as NonNullable<T>;
}

/** maybeSingle(): no row is a normal outcome. */
function maybe<T>(result: Result<T>): T | null {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  return result.data;
}

export class SupabaseStore implements BookingStore {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getBarberBySlug(slug: string) {
    const row = maybe(await this.db.from("barbers").select("*").eq("slug", slug).maybeSingle());
    return row ? toBarber(row) : null;
  }

  async getBarberById(id: string) {
    const row = maybe(await this.db.from("barbers").select("*").eq("id", id).maybeSingle());
    return row ? toBarber(row) : null;
  }

  async listServices(barberId: string) {
    return must(await this.db.from("services").select("*").eq("barber_id", barberId).order("display_order")).map(toService);
  }

  async getSchedule(barberId: string): Promise<BarberSchedule> {
    const [hours, exceptions, appointments] = await Promise.all([
      this.db.from("business_hours").select("*").eq("barber_id", barberId).eq("active", true),
      this.db.from("schedule_exceptions").select("*").eq("barber_id", barberId),
      this.db.from("appointments").select("*").eq("barber_id", barberId).order("start_at"),
    ]);
    return {
      hours: must(hours).map(toHours),
      exceptions: must(exceptions).map(toException),
      appointments: must(appointments).map(toAppointment),
    };
  }

  async listClients(barberId: string) {
    return must(await this.db.from("clients").select("*").eq("barber_id", barberId)).map(toClient);
  }

  async insertAppointment(barberId: string, data: NewAppointment) {
    const row = must(
      await this.db.rpc("book_appointment", {
        p_barber_id: barberId,
        p_service_id: data.serviceId,
        p_start: data.startAt,
        p_duration: data.durationMinutes,
        p_full_name: data.client.fullName,
        p_phone: data.client.phone,
        p_note: data.clientNote,
      }),
    );
    // NULL composite (slot taken under the lock) comes back with a null id.
    if (!row?.id) return { ok: false as const, reason: "conflict" as const };
    return { ok: true as const, appointment: toAppointment(row) };
  }

  async findByToken(token: string) {
    const appointment: AppointmentRow | null = maybe(await this.db.from("appointments").select("*").eq("public_token", token).maybeSingle());
    if (!appointment) return null;
    const client = must(await this.db.from("clients").select("*").eq("id", appointment.client_id).single());
    return { barberId: appointment.barber_id, appointment: toAppointment(appointment), client: toClient(client) };
  }

  async moveAppointment(token: string, startAt: string) {
    const row = must(await this.db.rpc("move_appointment", { p_token: token, p_start: startAt }));
    if (!row?.id) {
      const exists = maybe(await this.db.from("appointments").select("id").eq("public_token", token).maybeSingle());
      return { ok: false as const, reason: exists ? ("conflict" as const) : ("not_found" as const) };
    }
    return { ok: true as const, appointment: toAppointment(row) };
  }

  async cancelAppointment(token: string, at: string) {
    const row = maybe(
      await this.db
        .from("appointments")
        .update({ status: "cancelled", cancelled_at: at })
        .eq("public_token", token)
        .eq("status", "confirmed")
        .select("*")
        .maybeSingle(),
    );
    return row ? toAppointment(row) : null;
  }

  async getAppointment(barberId: string, id: string) {
    const row = maybe(await this.db.from("appointments").select("*").eq("barber_id", barberId).eq("id", id).maybeSingle());
    return row ? toAppointment(row) : null;
  }

  async setStatus(token: string, status: "completed" | "no_show") {
    const row = maybe(
      await this.db.from("appointments").update({ status }).eq("public_token", token).eq("status", "confirmed").select("*").maybeSingle(),
    );
    return row ? toAppointment(row) : null;
  }

  async updateService(barberId: string, id: string, patch: Pick<Service, "name" | "durationMinutes" | "active">) {
    const row = maybe(
      await this.db
        .from("services")
        .update({ name: patch.name, duration_minutes: patch.durationMinutes, active: patch.active })
        .eq("barber_id", barberId)
        .eq("id", id)
        .select("*")
        .maybeSingle(),
    );
    return row ? toService(row) : null;
  }

  async setHours(barberId: string, hours: WeeklyHours[]) {
    must(
      await this.db.rpc("replace_business_hours", {
        p_barber_id: barberId,
        p_hours: hours.map(({ dayOfWeek, start, end }) => ({ dayOfWeek, start, end })),
      }),
    );
  }

  async addException(barberId: string, e: DateException) {
    const row = must(
      await this.db
        .from("schedule_exceptions")
        .insert({ barber_id: barberId, date: e.date, type: e.type, start_time: e.start ?? null, end_time: e.end ?? null, reason: e.reason ?? null })
        .select("*")
        .single(),
    );
    return toException(row);
  }

  async removeException(barberId: string, id: string) {
    const rows = must(await this.db.from("schedule_exceptions").delete().eq("barber_id", barberId).eq("id", id).select("id"));
    return rows.length > 0;
  }

  async updateBarber(barberId: string, patch: Partial<PublicBarber>) {
    const update: Database["public"]["Tables"]["barbers"]["Update"] = {};
    if (patch.publicName !== undefined) update.public_name = patch.publicName;
    if (patch.salonName !== undefined) update.salon_name = patch.salonName;
    if (patch.phone !== undefined) update.phone = patch.phone;
    if (patch.address !== undefined) update.address = patch.address;
    if (patch.city !== undefined) update.city = patch.city;
    if (patch.mapsUrl !== undefined) update.maps_url = patch.mapsUrl;
    if (patch.rules) {
      update.slot_interval_minutes = patch.rules.slotIntervalMinutes;
      update.buffer_minutes = patch.rules.bufferMinutes;
      update.minimum_booking_notice_minutes = patch.rules.minimumNoticeMinutes;
      update.booking_horizon_days = patch.rules.horizonDays;
    }
    const row = maybe(await this.db.from("barbers").update(update).eq("id", barberId).select("*").maybeSingle());
    return row ? toBarber(row) : null;
  }
}
