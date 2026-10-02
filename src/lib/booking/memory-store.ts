import { OCCUPYING_STATUSES, type DateException, type WeeklyHours } from "@/lib/scheduling/availability";
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

  async listClients(barberId: string): Promise<Client[]> {
    return this.data.clients.filter((c) => c.barberId === barberId);
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

  async getAppointment(barberId: string, id: string) {
    return this.data.appointments.find((a) => a.barberId === barberId && a.id === id) ?? null;
  }

  async setStatus(token: string, status: "completed" | "no_show") {
    const appointment = this.data.appointments.find((a) => a.publicToken === token);
    if (!appointment) return null;
    appointment.status = status;
    return appointment;
  }

  async updateService(barberId: string, id: string, patch: Pick<Service, "name" | "durationMinutes" | "active">) {
    const service = this.data.services.find((s) => s.barberId === barberId && s.id === id);
    if (!service) return null;
    Object.assign(service, patch);
    return service;
  }

  async setHours(barberId: string, hours: WeeklyHours[]) {
    this.schedule(barberId).hours = hours;
  }

  async addException(barberId: string, exception: DateException) {
    const created = { ...exception, id: exception.id ?? this.ids.id() };
    this.schedule(barberId).exceptions.push(created);
    return created;
  }

  async removeException(barberId: string, id: string) {
    const schedule = this.schedule(barberId);
    const before = schedule.exceptions.length;
    schedule.exceptions = schedule.exceptions.filter((e) => e.id !== id);
    return schedule.exceptions.length < before;
  }

  async updateBarber(barberId: string, patch: Partial<PublicBarber>) {
    const barber = this.data.barbers.find((b) => b.id === barberId);
    if (!barber) return null;
    Object.assign(barber, patch);
    return barber;
  }

  private schedule(barberId: string) {
    return (this.data.schedules[barberId] ??= { hours: [], exceptions: [] });
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
