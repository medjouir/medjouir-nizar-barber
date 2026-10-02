import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, diffDays, instantToZoned, timeZoneOffset, zonedTimeToInstant } from "./time";

const TZ = "Africa/Casablanca";

describe("timezone handling (Africa/Casablanca, no hardcoded offset)", () => {
  it("uses GMT+1 outside Ramadan", () => {
    expect(new Date(zonedTimeToInstant("2026-10-02", 10 * 60, TZ)).toISOString()).toBe("2026-10-02T09:00:00.000Z");
  });

  it("switches to GMT+0 during Ramadan 2026", () => {
    expect(new Date(zonedTimeToInstant("2026-03-01", 10 * 60, TZ)).toISOString()).toBe("2026-03-01T10:00:00.000Z");
    expect(timeZoneOffset(Date.parse("2026-03-01T10:00:00Z"), TZ)).toBe(0);
    expect(timeZoneOffset(Date.parse("2026-04-01T10:00:00Z"), TZ)).toBe(3_600_000);
  });

  it("round-trips instants to local date and minutes", () => {
    const t = zonedTimeToInstant("2026-10-02", 14 * 60 + 30, TZ);
    expect(instantToZoned(t, TZ)).toEqual({ date: "2026-10-02", minutes: 870 });
  });

  it("finds the local date across midnight UTC", () => {
    // 23:30 UTC on Oct 1 is 00:30 on Oct 2 in Casablanca (GMT+1).
    expect(instantToZoned(Date.parse("2026-10-01T23:30:00Z"), TZ)).toEqual({ date: "2026-10-02", minutes: 30 });
  });

  it("does calendar arithmetic", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-10-02", "2026-11-01")).toBe(30);
    expect(dayOfWeek("2026-10-02")).toBe(5); // Friday = Jom3a
  });
});
