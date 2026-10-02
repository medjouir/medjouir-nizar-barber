import { describe, expect, it } from "vitest";
import {
  getAvailableSlots,
  getDateOptions,
  nearestSlots,
  type ExistingAppointment,
  type ScheduleInput,
} from "./availability";
import { zonedTimeToInstant } from "./time";

const TZ = "Africa/Casablanca";
// Friday 2026-10-02 08:00 local (07:00Z) unless stated otherwise.
const NOW = Date.parse("2026-10-02T07:00:00Z");
const DAY = "2026-10-05"; // Monday

const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(zonedTimeToInstant(date, h! * 60 + m!, TZ)).toISOString();
};

function schedule(overrides: Partial<ScheduleInput> = {}, rules: Partial<ScheduleInput["rules"]> = {}): ScheduleInput {
  return {
    rules: {
      timezone: TZ,
      slotIntervalMinutes: 15,
      bufferMinutes: 0,
      minimumNoticeMinutes: 30,
      horizonDays: 30,
      ...rules,
    },
    hours: [1, 2, 3, 4, 5, 6].flatMap((d) => [
      { dayOfWeek: d, start: "09:00", end: "13:00" },
      { dayOfWeek: d, start: "14:00", end: "20:00" },
    ]),
    exceptions: [],
    appointments: [],
    ...overrides,
  };
}

const times = (date: string, duration: number, s: ScheduleInput, now = NOW) =>
  getAvailableSlots({ date, durationMinutes: duration, schedule: s, now }).map((x) => x.time);

const appt = (id: string, date: string, start: string, end: string, status: ExistingAppointment["status"] = "confirmed") => ({
  id,
  startAt: at(date, start),
  endAt: at(date, end),
  status,
});

describe("service duration fits the window", () => {
  const window = schedule({ hours: [{ dayOfWeek: 1, start: "14:00", end: "15:30" }] });

  it("Coupe 60 min: valid in a 14:00–15:30 window", () => {
    expect(times(DAY, 60, window)).toEqual(["14:00", "14:15", "14:30"]);
  });
  it("Coupe + barbe 90 min: valid only at 14:00", () => {
    expect(times(DAY, 90, window)).toEqual(["14:00"]);
  });
  it("Proteine 120 min: not valid", () => {
    expect(times(DAY, 120, window)).toEqual([]);
  });
});

describe("split working hours", () => {
  it("never offers a service across the lunch break", () => {
    const t = times(DAY, 60, schedule());
    expect(t).toContain("12:00");
    expect(t).not.toContain("12:15"); // would end 13:15, in the break
    expect(t).not.toContain("13:00");
    expect(t).toContain("14:00");
    expect(t.at(-1)).toBe("19:00");
  });

  it("respects the slot interval", () => {
    expect(times(DAY, 60, schedule({}, { slotIntervalMinutes: 30 })).slice(0, 3)).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("closed weekday (Sunday) has no slots", () => {
    expect(times("2026-10-04", 60, schedule())).toEqual([]);
  });
});

describe("overlap with existing appointments", () => {
  it("removes every start that would overlap a confirmed appointment", () => {
    const s = schedule({ appointments: [appt("a", DAY, "10:00", "11:00")] });
    const t = times(DAY, 60, s);
    expect(t).toContain("09:00"); // ends exactly at 10:00
    expect(t).not.toContain("09:15");
    expect(t).not.toContain("10:30");
    expect(t).toContain("11:00"); // starts exactly at 11:00
  });

  it("completed appointments still occupy time; no-shows and cancellations do not", () => {
    const occupied = schedule({ appointments: [appt("a", DAY, "10:00", "11:00", "completed")] });
    expect(times(DAY, 60, occupied)).not.toContain("10:00");
    const noShow = schedule({ appointments: [appt("a", DAY, "10:00", "11:00", "no_show")] });
    expect(times(DAY, 60, noShow)).toContain("10:00");
  });

  it("cancellation reopens the slot", () => {
    const a = appt("a", DAY, "10:00", "11:00");
    expect(times(DAY, 60, schedule({ appointments: [a] }))).not.toContain("10:00");
    expect(times(DAY, 60, schedule({ appointments: [{ ...a, status: "cancelled" }] }))).toContain("10:00");
  });

  it("rescheduling ignores the appointment being moved", () => {
    const s = schedule({ appointments: [appt("me", DAY, "10:00", "11:00")] });
    const slots = getAvailableSlots({ date: DAY, durationMinutes: 60, schedule: s, now: NOW, excludeAppointmentId: "me" });
    expect(slots.map((x) => x.time)).toContain("10:30");
  });
});

describe("buffer", () => {
  it("keeps clearance before and after appointments", () => {
    const s = schedule({ appointments: [appt("a", DAY, "10:00", "11:00")] }, { bufferMinutes: 15 });
    const t = times(DAY, 60, s);
    // A 60 min service must end by 09:45, i.e. start by 08:45 — before opening.
    expect(t.filter((x) => x < "10:00")).toEqual([]);
    expect(t).not.toContain("11:00");
    expect(t).toContain("11:15");
  });

  it("allows a start exactly one buffer before another appointment's buffer zone", () => {
    const s = schedule({ appointments: [appt("a", DAY, "11:00", "12:00")] }, { bufferMinutes: 15 });
    const t = times(DAY, 60, s);
    expect(t).toContain("09:45"); // ends 10:45, +15 buffer = 11:00
    expect(t).not.toContain("10:00");
  });
});

describe("schedule exceptions", () => {
  it("blocked interval removes overlapping starts", () => {
    const s = schedule({ exceptions: [{ date: DAY, type: "blocked", start: "17:00", end: "18:30" }] });
    const t = times(DAY, 60, s);
    expect(t).toContain("16:00");
    expect(t).not.toContain("16:15");
    expect(t).not.toContain("18:00");
    expect(t).toContain("18:30");
  });

  it("whole-day block and closed date have no slots", () => {
    expect(times(DAY, 60, schedule({ exceptions: [{ date: DAY, type: "blocked" }] }))).toEqual([]);
    expect(times(DAY, 60, schedule({ exceptions: [{ date: DAY, type: "closed" }] }))).toEqual([]);
  });

  it("closed beats an available opening", () => {
    const s = schedule({
      exceptions: [
        { date: DAY, type: "closed" },
        { date: DAY, type: "available", start: "09:00", end: "12:00" },
      ],
    });
    expect(times(DAY, 60, s)).toEqual([]);
  });

  it("available exception opens extra time, even on a closed weekday", () => {
    const sunday = "2026-10-04";
    const s = schedule({ exceptions: [{ date: sunday, type: "available", start: "10:00", end: "12:00" }] });
    expect(times(sunday, 60, s)).toEqual(["10:00", "10:15", "10:30", "10:45", "11:00"]);
  });

  it("only affects its own date", () => {
    const s = schedule({ exceptions: [{ date: "2026-10-06", type: "closed" }] });
    expect(times(DAY, 60, s).length).toBeGreaterThan(0);
  });
});

describe("minimum booking notice", () => {
  it("hides starts sooner than the notice", () => {
    // Monday 10:00 local.
    const now = Date.parse(at(DAY, "10:00"));
    const t = times(DAY, 60, schedule(), now);
    expect(t).not.toContain("10:15");
    expect(t[0]).toBe("10:30");
  });

  it("past days have no slots", () => {
    expect(times("2026-10-01", 60, schedule())).toEqual([]);
  });
});

describe("booking horizon", () => {
  it("allows the last day of the horizon and nothing after", () => {
    const s = schedule({}, { horizonDays: 30 });
    // Today is 2026-10-02 → last bookable day 2026-10-31 (Saturday).
    expect(times("2026-10-31", 60, s).length).toBeGreaterThan(0);
    expect(times("2026-11-02", 60, s)).toEqual([]);
  });

  it("date options cover exactly the horizon and flag closed days", () => {
    const options = getDateOptions({ durationMinutes: 60, schedule: schedule({}, { horizonDays: 7 }), now: NOW });
    expect(options.map((o) => o.date)).toEqual([
      "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08",
    ]);
    expect(options.find((o) => o.date === "2026-10-04")!.available).toBe(false); // Sunday
    expect(options.find((o) => o.date === "2026-10-05")!.available).toBe(true);
  });

  it("a day can be available for a short service and not a long one", () => {
    const s = schedule({ hours: [{ dayOfWeek: 1, start: "14:00", end: "15:30" }] }, { horizonDays: 7 });
    const short = getDateOptions({ durationMinutes: 60, schedule: s, now: NOW });
    const long = getDateOptions({ durationMinutes: 120, schedule: s, now: NOW });
    expect(short.find((o) => o.date === DAY)!.available).toBe(true);
    expect(long.find((o) => o.date === DAY)!.available).toBe(false);
  });
});

describe("timezone", () => {
  it("returns UTC instants that match local wall-clock times (GMT+1, June 2026)", () => {
    const now = Date.parse("2026-06-12T07:00:00Z");
    const [first] = getAvailableSlots({ date: "2026-06-15", durationMinutes: 60, schedule: schedule(), now });
    expect(first).toEqual({ startAt: "2026-06-15T08:00:00.000Z", endAt: "2026-06-15T09:00:00.000Z", time: "09:00" });
  });

  it("keeps 09:00 local during Ramadan (GMT+0)", () => {
    const now = Date.parse("2026-02-27T07:00:00Z");
    const [first] = getAvailableSlots({ date: "2026-03-02", durationMinutes: 60, schedule: schedule(), now });
    expect(first!.startAt).toBe("2026-03-02T09:00:00.000Z");
    expect(first!.time).toBe("09:00");
  });
});

describe("nearestSlots", () => {
  it("returns the closest alternatives in chronological order", () => {
    const slots = getAvailableSlots({ date: DAY, durationMinutes: 60, schedule: schedule(), now: NOW });
    expect(nearestSlots(slots, at(DAY, "10:05")).map((s) => s.time)).toEqual(["09:45", "10:00", "10:15"]);
  });
});
