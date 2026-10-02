import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/booking/memory-store";
import { createBooking, listSlots } from "@/lib/booking/service";
import { zonedTimeToInstant } from "@/lib/scheduling/time";
import { validateBlock, validateHours, validateProfile, validateRules, validateService } from "./settings";

const RULES = { timezone: "Africa/Casablanca", slotIntervalMinutes: 15, bufferMinutes: 0, minimumNoticeMinutes: 30, horizonDays: 30 };

describe("validateService", () => {
  it("normalizes the name and accepts 5-minute durations", () => {
    expect(validateService({ name: "  Coupe   + barbe ", durationMinutes: "90", active: true })).toEqual({
      ok: true,
      value: { name: "Coupe + barbe", durationMinutes: 90, active: true },
    });
  });
  it.each([
    [{ name: "", durationMinutes: 60, active: true }, "name"],
    [{ name: "x".repeat(61), durationMinutes: 60, active: true }, "name"],
    [{ name: "Coupe", durationMinutes: 62, active: true }, "duration"],
    [{ name: "Coupe", durationMinutes: 600, active: true }, "duration"],
  ])("rejects %o", (input, error) => {
    expect(validateService(input)).toEqual({ ok: false, error });
  });
});

describe("validateHours", () => {
  it("accepts split days and sorts them", () => {
    const result = validateHours([
      { dayOfWeek: 1, start: "14:00", end: "20:00" },
      { dayOfWeek: 1, start: "09:00", end: "13:00" },
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        { dayOfWeek: 1, start: "09:00", end: "13:00" },
        { dayOfWeek: 1, start: "14:00", end: "20:00" },
      ],
    });
  });
  it("rejects overlaps, reversed ranges and bad times", () => {
    expect(validateHours([{ dayOfWeek: 1, start: "09:00", end: "13:00" }, { dayOfWeek: 1, start: "12:00", end: "15:00" }])).toEqual({ ok: false, error: "overlap" });
    expect(validateHours([{ dayOfWeek: 2, start: "13:00", end: "09:00" }])).toEqual({ ok: false, error: "order" });
    expect(validateHours([{ dayOfWeek: 2, start: "9h", end: "13:00" }])).toEqual({ ok: false, error: "time" });
    expect(validateHours([{ dayOfWeek: 7, start: "09:00", end: "13:00" }])).toEqual({ ok: false, error: "hours" });
  });
  it("an empty week means closed every day", () => {
    expect(validateHours([])).toEqual({ ok: true, value: [] });
  });
});

describe("validateBlock", () => {
  const today = "2026-06-15";
  it("creates a timed or whole-day private block", () => {
    expect(validateBlock({ date: "2026-06-16", wholeDay: false, start: "17:00", end: "18:30", reason: " Tbib " }, today)).toEqual({
      ok: true,
      value: { date: "2026-06-16", type: "blocked", start: "17:00", end: "18:30", reason: "Tbib" },
    });
    expect(validateBlock({ date: "2026-06-16", wholeDay: true, start: "", end: "", reason: "" }, today)).toEqual({
      ok: true,
      value: { date: "2026-06-16", type: "blocked", start: null, end: null, reason: null },
    });
  });
  it("rejects past dates and reversed times", () => {
    expect(validateBlock({ date: "2026-06-14", wholeDay: true, start: "", end: "", reason: "" }, today)).toMatchObject({ error: "date" });
    expect(validateBlock({ date: "2026-06-16", wholeDay: false, start: "18:00", end: "17:00", reason: "" }, today)).toMatchObject({ error: "order" });
  });
});

describe("validateRules and validateProfile", () => {
  it("only accepts offered choices", () => {
    expect(validateRules({ slotIntervalMinutes: "30", bufferMinutes: "10", minimumNoticeMinutes: "60", horizonDays: "14" }, RULES)).toEqual({
      ok: true,
      value: { ...RULES, slotIntervalMinutes: 30, bufferMinutes: 10, minimumNoticeMinutes: 60, horizonDays: 14 },
    });
    expect(validateRules({ slotIntervalMinutes: 7, bufferMinutes: 0, minimumNoticeMinutes: 30, horizonDays: 30 }, RULES)).toEqual({ ok: false, error: "rules" });
  });
  it("requires a name and an https maps link", () => {
    expect(validateProfile({ publicName: " " })).toEqual({ ok: false, error: "name" });
    expect(validateProfile({ publicName: "Nizar", mapsUrl: "javascript:alert(1)" })).toEqual({ ok: false, error: "maps" });
    expect(validateProfile({ publicName: "Nizar", mapsUrl: "https://maps.app.goo.gl/x" })).toMatchObject({ ok: true });
  });
});

describe("settings change availability", () => {
  const at = (date: string, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(zonedTimeToInstant(date, h! * 60 + m!, RULES.timezone)).toISOString();
  };
  const NOW = Date.parse("2026-06-12T07:00:00Z");
  const DAY = "2026-06-15"; // Monday
  const make = () =>
    new MemoryStore(
      {
        barbers: [{ id: "b1", slug: "nizar", publicName: "Nizar", salonName: null, phone: null, address: null, city: null, mapsUrl: null, rules: RULES }],
        services: [{ id: "s1", barberId: "b1", name: "Coupe", durationMinutes: 60, active: true, displayOrder: 1 }],
        schedules: { b1: { hours: [{ dayOfWeek: 1, start: "09:00", end: "12:00" }], exceptions: [] } },
        clients: [],
        appointments: [],
      },
      { id: (() => { let n = 0; return () => `id${++n}`; })(), token: () => "f".repeat(64) },
    );
  const times = async (store: MemoryStore) =>
    (await listSlots(store, { slug: "nizar", serviceId: "s1", date: DAY, now: NOW }))!.map((s) => s.time);

  it("new hours, blocks, durations, rules and deactivation apply immediately", async () => {
    const store = make();
    expect((await times(store)).at(-1)).toBe("11:00");

    await store.setHours("b1", [{ dayOfWeek: 1, start: "09:00", end: "13:00" }]);
    expect((await times(store)).at(-1)).toBe("12:00");

    const block = await store.addException("b1", { date: DAY, type: "blocked", start: "10:00", end: "11:00" });
    expect(await times(store)).not.toContain("10:00");
    await store.removeException("b1", block.id!);
    expect(await times(store)).toContain("10:00");

    await store.updateService("b1", "s1", { name: "Coupe", durationMinutes: 120, active: true });
    expect((await times(store)).at(-1)).toBe("11:00");

    await store.updateBarber("b1", { rules: { ...RULES, slotIntervalMinutes: 60 } });
    expect(await times(store)).toEqual(["09:00", "10:00", "11:00"]);

    await store.updateService("b1", "s1", { name: "Coupe", durationMinutes: 120, active: false });
    expect(await listSlots(store, { slug: "nizar", serviceId: "s1", date: DAY, now: NOW })).toBeNull();
    const booking = await createBooking(store, { slug: "nizar", serviceId: "s1", startAt: at(DAY, "09:00"), fullName: "A", phone: "0611111111" }, NOW);
    expect(booking).toMatchObject({ ok: false, reason: "invalid_request" });
  });
});
