import type { AppointmentStatus } from "@/lib/database.types";
import type { BookingRules, DateException, WeeklyHours } from "@/lib/scheduling/availability";

/** Barber data that is safe to show on public pages. */
export type PublicBarber = {
  id: string;
  slug: string;
  publicName: string;
  address: string | null;
  city: string | null;
  mapsUrl: string | null;
  rules: BookingRules;
};

export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
  displayOrder: number;
};

export type Client = { id: string; fullName: string; phone: string };

export type Appointment = {
  id: string;
  serviceId: string;
  clientId: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  clientNote: string | null;
  publicToken: string;
  createdAt: string;
  cancelledAt: string | null;
};

export type BarberSchedule = {
  hours: WeeklyHours[];
  exceptions: DateException[];
  appointments: Appointment[];
};

export type NewAppointment = {
  serviceId: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  clientNote: string | null;
  client: { fullName: string; phone: string };
};

/**
 * Persistence boundary. Implementations must make insertAppointment and
 * moveAppointment atomic with respect to overlaps (the Supabase implementation
 * relies on the appointments_no_overlap exclusion constraint).
 */
export interface BookingStore {
  getBarberBySlug(slug: string): Promise<PublicBarber | null>;
  getBarberById(id: string): Promise<PublicBarber | null>;
  listServices(barberId: string): Promise<Service[]>;
  getSchedule(barberId: string): Promise<BarberSchedule>;
  /** Barber-side only (never exposed to public pages). */
  listClients(barberId: string): Promise<Client[]>;
  /** Creates or reuses the client (same barber + phone) and inserts the appointment. */
  insertAppointment(
    barberId: string,
    data: NewAppointment,
  ): Promise<{ ok: true; appointment: Appointment } | { ok: false; reason: "conflict" }>;
  findByToken(token: string): Promise<{ barberId: string; appointment: Appointment; client: Client } | null>;
  moveAppointment(
    token: string,
    startAt: string,
    endAt: string,
  ): Promise<{ ok: true; appointment: Appointment } | { ok: false; reason: "conflict" | "not_found" }>;
  cancelAppointment(token: string, at: string): Promise<Appointment | null>;
}
