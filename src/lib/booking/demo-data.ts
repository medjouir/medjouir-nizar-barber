import { addDays, todayIn, zonedTimeToInstant } from "@/lib/scheduling/time";
import type { MemoryData } from "./memory-store";

/**
 * Example data for demo mode, mirroring supabase/seed.sql. Dates are relative
 * to today so the demo always has upcoming appointments. Seed tokens are
 * never shown to visitors.
 */
export const DEMO_BARBER_ID = "demo-barber-nizar";
const TZ = "Africa/Casablanca";

export function buildDemoData(now: number): MemoryData {
  const today = todayIn(TZ, now);
  const at = (dayOffset: number, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(zonedTimeToInstant(addDays(today, dayOffset), h! * 60 + m!, TZ)).toISOString();
  };
  const seedAppointment = (
    id: string,
    clientId: string,
    serviceId: string,
    day: number,
    start: string,
    minutes: number,
    status: "confirmed" | "cancelled" | "no_show" | "completed" = "confirmed",
  ) => {
    const startAt = at(day, start);
    return {
      id,
      barberId: DEMO_BARBER_ID,
      serviceId,
      clientId,
      startAt,
      endAt: new Date(Date.parse(startAt) + minutes * 60_000).toISOString(),
      durationMinutes: minutes,
      status,
      clientNote: null,
      publicToken: id.padEnd(64, "0").replace(/[^0-9a-f]/g, "0"),
      createdAt: at(-7, "12:00"),
      cancelledAt: status === "cancelled" ? at(-1, "12:00") : null,
    };
  };

  return {
    barbers: [
      {
        id: DEMO_BARBER_ID,
        slug: "nizar",
        publicName: "Nizar",
        salonName: null,
        phone: null,
        address: "Casablanca",
        city: "Casablanca",
        mapsUrl: "https://maps.google.com/?q=Casablanca",
        rules: { timezone: TZ, slotIntervalMinutes: 15, bufferMinutes: 0, minimumNoticeMinutes: 30, horizonDays: 30 },
      },
    ],
    services: [
      { id: "svc-coupe", barberId: DEMO_BARBER_ID, name: "Coupe", durationMinutes: 60, active: true, displayOrder: 1 },
      { id: "svc-coupe-barbe", barberId: DEMO_BARBER_ID, name: "Coupe + barbe", durationMinutes: 90, active: true, displayOrder: 2 },
      { id: "svc-proteine", barberId: DEMO_BARBER_ID, name: "Proteine cheveux", durationMinutes: 120, active: true, displayOrder: 3 },
    ],
    schedules: {
      [DEMO_BARBER_ID]: {
        // Monday–Saturday, split day. Sunday: Ma khedamch.
        hours: [1, 2, 3, 4, 5, 6].flatMap((dayOfWeek) => [
          { dayOfWeek, start: "09:00", end: "13:00" },
          { dayOfWeek, start: "14:00", end: "20:00" },
        ]),
        exceptions: [
          { id: "x1", date: addDays(today, 1), type: "blocked", start: "17:00", end: "18:30", reason: "Rendez-vous chkhsi" },
          { id: "x2", date: addDays(today, 5), type: "closed", reason: "3otla" },
        ],
      },
    },
    clients: [
      { id: "c1", barberId: DEMO_BARBER_ID, fullName: "Youssef El Amrani", phone: "+212600000001" },
      { id: "c2", barberId: DEMO_BARBER_ID, fullName: "Hamza Bennani", phone: "+212600000002" },
      { id: "c3", barberId: DEMO_BARBER_ID, fullName: "Amine Tazi", phone: "+212600000003" },
      { id: "c4", barberId: DEMO_BARBER_ID, fullName: "Karim Alaoui", phone: "+212600000004" },
      { id: "c5", barberId: DEMO_BARBER_ID, fullName: "Mehdi Idrissi", phone: "+212600000005" },
    ],
    appointments: [
      seedAppointment("a1", "c1", "svc-coupe", 0, "10:00", 60),
      seedAppointment("a2", "c4", "svc-coupe", 0, "11:00", 60, "cancelled"),
      seedAppointment("a3", "c2", "svc-coupe-barbe", 0, "14:00", 90),
      seedAppointment("a4", "c3", "svc-proteine", 0, "16:00", 120),
      seedAppointment("a5", "c5", "svc-coupe", -1, "10:00", 60, "no_show"),
      seedAppointment("a6", "c1", "svc-coupe-barbe", -1, "15:00", 90, "completed"),
      seedAppointment("a7", "c2", "svc-coupe", 1, "10:00", 60),
      seedAppointment("a8", "c3", "svc-coupe-barbe", 1, "14:30", 90),
      seedAppointment("a9", "c4", "svc-proteine", 2, "09:00", 120),
    ],
  };
}
