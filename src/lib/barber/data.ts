import "server-only";
import { requireBarber } from "@/lib/auth";
import { getBookingStore } from "@/lib/booking/store";
import type { DayAppointment } from "@/lib/dashboard";

/**
 * Everything Nizar's private screens read, for the signed-in barber only.
 * requireBarber() runs first, so a visitor without a barber session never
 * reaches the store.
 */
export async function loadBarberWorkspace(now = Date.now()) {
  const account = await requireBarber();
  const { store } = await getBookingStore(now);
  const barber = await store.getBarberBySlug(account.slug);
  if (!barber) throw new Error("Barber not found in store");

  const [services, schedule, clients] = await Promise.all([
    store.listServices(barber.id),
    store.getSchedule(barber.id),
    store.listClients(barber.id),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const appointments: DayAppointment[] = schedule.appointments.map((a) => {
    const client = clientById.get(a.clientId);
    return {
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      durationMinutes: a.durationMinutes,
      status: a.status,
      clientName: client?.fullName ?? "—",
      clientPhone: client?.phone ?? "",
      serviceName: serviceById.get(a.serviceId)?.name ?? "—",
      note: a.clientNote,
    };
  });

  return { account, barber, services, schedule, appointments };
}
