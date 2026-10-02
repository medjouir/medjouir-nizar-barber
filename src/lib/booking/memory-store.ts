import { OCCUPYING_STATUSES } from "@/lib/scheduling/availability";
import type {
  Appointment,
  BarberSchedule,
  BookingStore,
  Client,
  NewAppointment,
  PublicBarber,
  Service,
} from "./types";

export type MemoryData = {
  barbers: PublicBarber[];
  services: (Service & { barberId: string })[];
  schedules: Record<string, Omit<BarberSchedule, "appointments">>;
  clients: (Client & { barberId: string })[];
  appointments: (Appointment & { barberId: string })[];
};

/**
 * In-memory BookingStore. Used by tests and by the demo store. Mirrors the
 * database guarantees: unique (barber, phone) clients and no overlapping
 * occupying appointments.
 */
export class MemoryStore implements BookingStore {
  constructor(
    readonly data: MemoryData,
    private readonly ids: { id: () => string; token: () => string },
  ) {}

  async getBarberBySlug(slug: string) {
    return this.data.barbers.find((b) => b.slug === slug) ?? null;
  }

  async getBarberById(id: string) {
    return this.data.barbers.find((b) => b.id === id) ?? null;
  }

  async listServices(barberId: string) {
    return this.data.services
      .filter((s) => s.barberId === barberId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getSchedule(barberId: string): Promise<BarberSchedule> {
    const base = this.data.schedules[barberId] ?? { hours: [], exceptions: [] };
    return { ...base, appointments: this.data.appointments.filter((a) => a.barberId === barberId) };
  }

  async insertAppointment(barberId: string, data: NewAppointment) {
    if (this.overlaps(barberId, data.startAt, data.endAt)) return { ok: false as const, reason: "conflict" as const };

    let client = this.data.clients.find((c) => c.barberId === barberId && c.phone === data.client.phone);
    if (!client) {
      client = { id: this.ids.id(), barberId, fullName: data.client.fullName, phone: data.client.phone };
      this.data.clients.push(client);
    }

    const appointment = {
      id: this.ids.id(),
      barberId,
      serviceId: data.serviceId,
      clientId: client.id,
      startAt: data.startAt,
      endAt: data.endAt,
      durationMinutes: data.durationMinutes,
      status: "confirmed" as const,
      clientNote: data.clientNote,
      publicToken: this.ids.token(),
      createdAt: new Date().toISOString(),
      cancelledAt: null,
    };
    this.data.appointments.push(appointment);
    return { ok: true as const, appointment };
  }

  async findByToken(token: string) {
    const appointment = this.data.appointments.find((a) => a.publicToken === token);
    if (!appointment) return null;
    const client = this.data.clients.find((c) => c.id === appointment.clientId)!;
    return { barberId: appointment.barberId, appointment, client };
  }

  async moveAppointment(token: string, startAt: string, endAt: string) {
    const appointment = this.data.appointments.find((a) => a.publicToken === token);
    if (!appointment) return { ok: false as const, reason: "not_found" as const };
    if (this.overlaps(appointment.barberId, startAt, endAt, appointment.id)) {
      return { ok: false as const, reason: "conflict" as const };
    }
    appointment.startAt = startAt;
    appointment.endAt = endAt;
    return { ok: true as const, appointment };
  }

  async cancelAppointment(token: string, at: string) {
    const appointment = this.data.appointments.find((a) => a.publicToken === token);
    if (!appointment) return null;
    appointment.status = "cancelled";
    appointment.cancelledAt = at;
    return appointment;
  }

  private overlaps(barberId: string, startAt: string, endAt: string, excludeId?: string) {
    const s = Date.parse(startAt);
    const e = Date.parse(endAt);
    return this.data.appointments.some(
      (a) =>
        a.barberId === barberId &&
        a.id !== excludeId &&
        OCCUPYING_STATUSES.includes(a.status) &&
        s < Date.parse(a.endAt) &&
        e > Date.parse(a.startAt),
    );
  }
}
