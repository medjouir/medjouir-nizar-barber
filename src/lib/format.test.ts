import { describe, expect, it } from "vitest";
import { dayName, formatDuration, fullDateLabel, localDateTime } from "./format";

describe("format", () => {
  it("names days in Darija relative to today", () => {
    expect(dayName("2026-10-02", "2026-10-02")).toBe("Lyouma");
    expect(dayName("2026-10-03", "2026-10-02")).toBe("Gheda");
    expect(dayName("2026-10-04", "2026-10-02")).toBe("L7ed");
    expect(dayName("2026-10-09", "2026-10-02")).toBe("Jom3a");
    expect(fullDateLabel("2026-10-02", "2026-10-02")).toBe("Lyouma, 2 oct");
    expect(fullDateLabel("2026-10-09", "2026-10-02")).toBe("Jom3a 9 oct");
  });

  it("formats durations like the spec", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(45)).toBe("45 min");
  });

  it("renders instants in the barber's timezone", () => {
    expect(localDateTime("2026-10-05T13:00:00.000Z", "Africa/Casablanca")).toEqual({ date: "2026-10-05", time: "14:00" });
  });
});
