import { beforeEach, describe, expect, it } from "vitest";
import { zonedTimeToInstant } from "@/lib/scheduling/time";
import { MemoryStore } from "./memory-store";
import { cancelByToken, createBooking, getByToken, listDateOptions, listSlots, rescheduleByToken } from "./service";

const TZ = "Africa/Casablanca";
const NOW = Date.parse("2026-10-02T07:00:00Z"); // Friday 08:00 local
const DAY = "2026-10-05"; // Monday
const at = (hhmm: string, date = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(zonedTimeToInstant(date, h! * 60 + m!, TZ)).toISOString();
};

let n = 0;
function makeStore() {
  n = 0;
  return new MemoryStore(
    {
      barbers: [
        {
          id: "b1",
          slug: "nizar",
          publicName: "Nizar",
          address: null,
          city: null,
          mapsUrl: null,
          rules: { timezone: TZ, slotIntervalMinutes: 15, bufferMinutes: 0, minimumNoticeMinutes: 30, horizonDays: 30 },
        },
      ],
      services: [
        { id: "coupe", barberId: "b1", name: "Coupe", durationMinutes: 60, active: true, displayOrder: 1 },
        { id: "barbe", barberId: "b1", name: "Coupe + barbe", durationMinutes: 90, active: true, displayOrder: 2 },
        { id: "off", barberId: "b1", name: "Old", durationMinutes: 30, active: false, displayOrder: 3 },
      ],
      schedules: {
        b1: { hours: [{ dayOfWeek: 1, start: "09:00", end: "13:00" }], exceptions: [] },
      },
      clients: [],
      appointments: [],
    },
    { id: () => `id${++n}`, token: () => String(++n).padStart(64, "0").replace(/^0/, "a") },
  );
}

const request = (overrides: Partial<Parameters<typeof createBooking>[1]> = {}) => ({
  slug: "nizar",
  serviceId: "coupe",
  startAt: at("10:00"),
  fullName: "  Youssef   El Amrani ",
  phone: "06 12 34 56 78",
  ...overrides,
});

let store: MemoryStore;
beforeEach(() => {
  store = makeStore();
});

describe("createBooking", () => {
  it("books an available slot with a normalized phone and trimmed name", async () => {
    const result = await createBooking(store, request({ note: " Dégradé " }), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointment).toMatchObject({
      startAt: at("10:00"),
      endAt: at("11:00"),
      durationMinutes: 60,
      status: "confirmed",
      clientNote: "Dégradé",
    });
    expect(store.data.clients).toEqual([
      { id: expect.any(String), barberId: "b1", fullName: "Youssef El Amrani", phone: "+212612345678" },
    ]);
  });

  it("reuses the client for the same phone written differently", async () => {
    await createBooking(store, request(), NOW);
    const second = await createBooking(store, request({ startAt: at("11:00"), phone: "+212612345678", fullName: "Youssef" }), NOW);
    expect(second.ok).toBe(true);
    expect(store.data.clients).toHaveLength(1);
    expect(new Set(store.data.appointments.map((a) => a.clientId)).size).toBe(1);
  });

  it("prevents double booking and offers nearby alternatives", async () => {
    expect((await createBooking(store, request(), NOW)).ok).toBe(true);
    const clash = await createBooking(store, request({ startAt: at("10:30"), phone: "0700000000" }), NOW);
    expect(clash).toMatchObject({ ok: false, reason: "slot_taken" });
    if (clash.ok || clash.reason !== "slot_taken") return;
    expect(clash.alternatives.map((s) => s.time)).toEqual(["11:00", "11:15", "11:30"]);
  });

  it("two simultaneous requests for the same slot: exactly one wins", async () => {
    const results = await Promise.all([
      createBooking(store, request({ phone: "0611111111" }), NOW),
      createBooking(store, request({ phone: "0622222222" }), NOW),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(store.data.appointments).toHaveLength(1);
  });

  it("rejects slots that are not offered (closed day, off grid, too soon, inactive service)", async () => {
    expect(await createBooking(store, request({ startAt: at("10:00", "2026-10-06") }), NOW)).toMatchObject({ reason: "slot_taken" });
    expect(await createBooking(store, request({ startAt: at("10:05") }), NOW)).toMatchObject({ reason: "slot_taken" });
    expect(await createBooking(store, request({ startAt: at("12:30") }), NOW)).toMatchObject({ reason: "slot_taken" });
    expect(await createBooking(store, request({ serviceId: "off" }), NOW)).toMatchObject({ reason: "invalid_request" });
    expect(await createBooking(store, request({ slug: "other" }), NOW)).toMatchObject({ reason: "invalid_request" });
  });

  it("validates name and phone", async () => {
    expect(await createBooking(store, request({ fullName: "   " }), NOW)).toMatchObject({ reason: "invalid_name" });
    expect(await createBooking(store, request({ phone: "12345" }), NOW)).toMatchObject({ reason: "invalid_phone" });
  });
});

describe("public token management", () => {
  it("finds an appointment only with its exact token", async () => {
    const booked = await createBooking(store, request(), NOW);
    if (!booked.ok) throw new Error("booking failed");
    const token = booked.appointment.publicToken;
    expect((await getByToken(store, token, NOW))?.appointment.id).toBe(booked.appointment.id);
    expect(await getByToken(store, token.replace(/.$/, "f"), NOW)).toBeNull();
    expect(await getByToken(store, "not-a-token", NOW)).toBeNull();
    expect(await getByToken(store, booked.appointment.id, NOW)).toBeNull();
  });

  it("cancellation keeps the record and reopens the slot", async () => {
    const booked = await createBooking(store, request(), NOW);
    if (!booked.ok) throw new Error("booking failed");
    const before = await listSlots(store, { slug: "nizar", serviceId: "coupe", date: DAY, now: NOW });
    expect(before!.map((s) => s.time)).not.toContain("10:00");

    const cancelled = await cancelByToken(store, booked.appointment.publicToken, NOW);
    expect(cancelled).toMatchObject({ status: "cancelled", cancelledAt: new Date(NOW).toISOString() });
    expect(store.data.appointments).toHaveLength(1);

    const after = await listSlots(store, { slug: "nizar", serviceId: "coupe", date: DAY, now: NOW });
    expect(after!.map((s) => s.time)).toContain("10:00");
    // A cancelled appointment cannot be cancelled or moved again.
    expect(await cancelByToken(store, booked.appointment.publicToken, NOW)).toBeNull();
    expect(await rescheduleByToken(store, booked.appointment.publicToken, at("11:00"), NOW)).toMatchObject({
      reason: "not_changeable",
    });
  });

  it("reschedule moves the appointment, may overlap its own old time, and frees the old slot", async () => {
    const booked = await createBooking(store, request(), NOW);
    if (!booked.ok) throw new Error("booking failed");
    const moved = await rescheduleByToken(store, booked.appointment.publicToken, at("10:30"), NOW);
    expect(moved).toMatchObject({ ok: true, appointment: { startAt: at("10:30"), endAt: at("11:30") } });

    const slots = await listSlots(store, { slug: "nizar", serviceId: "coupe", date: DAY, now: NOW });
    expect(slots!.map((s) => s.time)).toContain("09:30"); // old 10:00 is free up to 10:30
    expect(slots!.map((s) => s.time)).not.toContain("10:00");
  });

  it("reschedule cannot take another client's slot", async () => {
    const mine = await createBooking(store, request(), NOW);
    await createBooking(store, request({ startAt: at("11:00"), phone: "0700000000" }), NOW);
    if (!mine.ok) throw new Error("booking failed");
    expect(await rescheduleByToken(store, mine.appointment.publicToken, at("11:30"), NOW)).toMatchObject({
      ok: false,
      reason: "slot_taken",
    });
  });

  it("past appointments are no longer changeable", async () => {
    const booked = await createBooking(store, request(), NOW);
    if (!booked.ok) throw new Error("booking failed");
    const later = Date.parse(at("10:30"));
    expect((await getByToken(store, booked.appointment.publicToken, later))?.changeable).toBe(false);
    expect(await cancelByToken(store, booked.appointment.publicToken, later)).toBeNull();
  });
});

describe("date options", () => {
  it("lists the horizon with Monday available and other days closed", async () => {
    const options = await listDateOptions(store, "nizar", "coupe", NOW);
    expect(options).toHaveLength(30);
    expect(options!.filter((o) => o.available).map((o) => o.date).slice(0, 2)).toEqual(["2026-10-05", "2026-10-12"]);
  });
});
