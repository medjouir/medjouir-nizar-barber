import { describe, expect, it } from "vitest";
import { zonedTimeToInstant } from "@/lib/scheduling/time";
import { blockedSpans, place, visibleRange, weekDates } from "./planning";

const TZ = "Africa/Casablanca";
const hours = [
  { dayOfWeek: 1, start: "09:00", end: "13:00" },
  { dayOfWeek: 1, start: "14:00", end: "20:00" },
];
const iso = (date: string, h: number, m = 0) => new Date(zonedTimeToInstant(date, h * 60 + m, TZ)).toISOString();

describe("planning layout", () => {
  it("builds a Monday-first week", () => {
    expect(weekDates("2026-06-17")).toEqual([
      "2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21",
    ]);
    expect(weekDates("2026-06-21")[0]).toBe("2026-06-15"); // Sunday belongs to the week before
  });

  it("covers hours and out-of-hours appointments, rounded to whole hours", () => {
    expect(visibleRange({ dates: ["2026-06-15"], hours, exceptions: [], appointments: [], timeZone: TZ })).toEqual({ start: 540, end: 1200 });
    const late = [{ startAt: iso("2026-06-15", 20, 15), endAt: iso("2026-06-15", 21, 15) }];
    expect(visibleRange({ dates: ["2026-06-15"], hours, exceptions: [], appointments: late, timeZone: TZ })).toEqual({ start: 540, end: 1320 });
    expect(visibleRange({ dates: ["2026-06-21"], hours, exceptions: [], appointments: [], timeZone: TZ })).toEqual({ start: 540, end: 1200 });
  });

  it("makes block height proportional to duration", () => {
    const range = { start: 540, end: 1200 };
    expect(place({ start: 600, end: 660 }, range, 1.2)).toEqual({ top: 72, height: 72 }); // 1h
    expect(place({ start: 600, end: 690 }, range, 1.2).height).toBe(108); // 1h30
    expect(place({ start: 600, end: 720 }, range, 1.2).height).toBe(144); // 2h
  });

  it("returns blocked periods with their private reason", () => {
    const range = { start: 540, end: 1200 };
    const spans = blockedSpans(
      "2026-06-15",
      [
        { date: "2026-06-15", type: "blocked", start: "17:00", end: "18:30", reason: "Tbib" },
        { date: "2026-06-16", type: "closed" },
      ],
      range,
    );
    expect(spans).toEqual([{ start: 1020, end: 1110, reason: "Tbib", wholeDay: false }]);
    expect(blockedSpans("2026-06-16", [{ date: "2026-06-16", type: "closed" }], range)[0]).toMatchObject({ start: 540, end: 1200, wholeDay: true });
  });
});
