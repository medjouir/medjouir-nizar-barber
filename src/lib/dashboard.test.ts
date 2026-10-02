import { describe, expect, it } from "vitest";
import { zonedTimeToInstant } from "@/lib/scheduling/time";
import { appointmentsOn, buildDayProgram, nextAppointment, type DayAppointment } from "./dashboard";

const TZ = "Africa/Casablanca";
const DAY = "2026-10-05"; // Monday
const at = (hhmm: string, date = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(zonedTimeToInstant(date, h! * 60 + m!, TZ)).toISOString();
};
const hours = [
  { dayOfWeek: 1, start: "09:00", end: "13:00" },
  { dayOfWeek: 1, start: "14:00", end: "20:00" },
];
const appt = (id: string, start: string, end: string, status: DayAppointment["status"] = "confirmed", date = DAY): DayAppointment => ({
  id,
  startAt: at(start, date),
  endAt: at(end, date),
  durationMinutes: 60,
  status,
  clientName: id,
  clientPhone: "+212600000001",
  serviceName: "Coupe",
  note: null,
});

const summary = (items: ReturnType<typeof buildDayProgram>) =>
  items.map((i) => (i.kind === "free" ? `libre ${i.start}-${i.end}` : `${i.appointment.id} ${i.start}-${i.end}`));

describe("buildDayProgram", () => {
  const appointments = [
    appt("a", "10:00", "11:00"),
    appt("x", "11:00", "12:00", "cancelled"),
    appt("b", "14:00", "15:30"),
    appt("c", "16:00", "18:00"),
  ];

  it("lists appointments chronologically with meaningful free gaps", () => {
    const items = buildDayProgram({ date: DAY, timeZone: TZ, now: Date.parse(at("08:00")), hours, exceptions: [], appointments });
    expect(summary(items)).toEqual([
      "libre 09:00-10:00",
      "a 10:00-11:00",
      "libre 11:00-13:00", // cancelled appointment frees its time
      "b 14:00-15:30",
      "libre 15:30-16:00",
      "c 16:00-18:00",
      "libre 18:00-20:00",
    ]);
  });

  it("only shows free time that is still ahead and at least 30 min", () => {
    const items = buildDayProgram({ date: DAY, timeZone: TZ, now: Date.parse(at("15:45")), hours, exceptions: [], appointments });
    expect(summary(items)).toEqual(["a 10:00-11:00", "b 14:00-15:30", "c 16:00-18:00", "libre 18:00-20:00"]);
  });

  it("respects blocked periods and closed days", () => {
    const blocked = buildDayProgram({
      date: DAY,
      timeZone: TZ,
      now: Date.parse(at("08:00")),
      hours,
      exceptions: [{ date: DAY, type: "blocked", start: "18:30", end: "20:00" }],
      appointments,
    });
    expect(summary(blocked).at(-1)).toBe("libre 18:00-18:30");
    const closed = buildDayProgram({
      date: DAY,
      timeZone: TZ,
      now: Date.parse(at("08:00")),
      hours,
      exceptions: [{ date: DAY, type: "closed" }],
      appointments: [],
    });
    expect(closed).toEqual([]);
  });

  it("starts today's free time on the slot grid", () => {
    const items = buildDayProgram({ date: DAY, timeZone: TZ, now: Date.parse(at("18:13")), hours, exceptions: [], appointments });
    expect(summary(items).at(-1)).toBe("libre 18:15-20:00");
  });

  it("shows no free gaps on past days", () => {
    const items = buildDayProgram({ date: DAY, timeZone: TZ, now: Date.parse(at("09:00", "2026-10-06")), hours, exceptions: [], appointments });
    expect(items.every((i) => i.kind === "appointment")).toBe(true);
  });
});

describe("today's appointments and next appointment", () => {
  it("counts the day's non-cancelled appointments", () => {
    const list = [appt("a", "10:00", "11:00"), appt("b", "11:00", "12:00", "cancelled"), appt("c", "12:00", "13:00", "no_show"), appt("d", "10:00", "11:00", "confirmed", "2026-10-06")];
    expect(appointmentsOn(DAY, TZ, list).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("picks the confirmed appointment in progress or coming next, even on another day", () => {
    const list = [appt("a", "10:00", "11:00"), appt("b", "14:00", "15:00"), appt("t", "09:00", "10:00", "confirmed", "2026-10-06")];
    expect(nextAppointment(list, Date.parse(at("10:30")))?.id).toBe("a");
    expect(nextAppointment(list, Date.parse(at("11:00")))?.id).toBe("b");
    expect(nextAppointment(list, Date.parse(at("19:00")))?.id).toBe("t");
    expect(nextAppointment([appt("x", "16:00", "17:00", "cancelled")], Date.parse(at("08:00")))).toBeNull();
  });
});
