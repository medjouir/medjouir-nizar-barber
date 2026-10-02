import { describe, expect, it } from "vitest";
import { history, searchClients, summarizeClients, upcoming, type ClientAppointment } from "./clients";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const clients = [
  { id: "c1", fullName: "Youssef El Amrani", phone: "+212612345678" },
  { id: "c2", fullName: "Hamza Bennani", phone: "+212700112233" },
  { id: "c3", fullName: "Amine Tazi", phone: "+212655443322" },
  { id: "c4", fullName: "Élias Chraïbi", phone: "+212611000000" },
];
const appt = (id: string, clientId: string, startAt: string, status: ClientAppointment["status"]): ClientAppointment => ({
  id,
  clientId,
  startAt,
  endAt: new Date(Date.parse(startAt) + 3600_000).toISOString(),
  durationMinutes: 60,
  status,
  serviceName: "Coupe",
});
const appointments = [
  appt("a1", "c1", "2026-06-01T10:00:00Z", "completed"),
  appt("a2", "c1", "2026-06-08T10:00:00Z", "completed"),
  appt("a3", "c1", "2026-06-10T10:00:00Z", "no_show"),
  appt("a4", "c1", "2026-06-12T10:00:00Z", "cancelled"),
  appt("a5", "c1", "2026-06-20T10:00:00Z", "confirmed"),
  appt("a6", "c1", "2026-06-18T10:00:00Z", "confirmed"),
  appt("a7", "c2", "2026-06-15T11:30:00Z", "confirmed"), // in progress
];

describe("summarizeClients", () => {
  it("counts completed visits only and finds the next confirmed appointment", () => {
    const rows = summarizeClients(clients, appointments, NOW);
    const youssef = rows.find((r) => r.id === "c1")!;
    expect(youssef.visits).toBe(2);
    expect(youssef.next?.id).toBe("a6");
    expect(rows.find((r) => r.id === "c2")!.next?.id).toBe("a7");
    expect(rows.find((r) => r.id === "c3")).toMatchObject({ visits: 0, next: null });
  });

  it("sorts by name, ignoring accents", () => {
    expect(summarizeClients(clients, [], NOW).map((r) => r.fullName)).toEqual([
      "Amine Tazi",
      "Élias Chraïbi",
      "Hamza Bennani",
      "Youssef El Amrani",
    ]);
  });
});

describe("history and upcoming", () => {
  it("lists past visits newest first without cancellations", () => {
    const own = appointments.filter((a) => a.clientId === "c1");
    expect(history(own, NOW).map((a) => a.id)).toEqual(["a3", "a2", "a1"]);
    expect(upcoming(own, NOW).map((a) => a.id)).toEqual(["a6", "a5"]);
  });
});

describe("searchClients", () => {
  it.each([
    ["youssef", ["c1"]],
    ["AMRANI youssef", ["c1"]],
    ["elias", ["c4"]],
    ["chraibi", ["c4"]],
    ["0612", ["c1"]],
    ["06 12 34", ["c1"]],
    ["+212612", ["c1"]],
    ["612345678", ["c1"]],
    ["07", ["c2"]],
    ["0611", ["c4"]],
    ["", ["c1", "c2", "c3", "c4"]],
    ["zzz", []],
  ])("%s", (query, ids) => {
    expect(searchClients(clients, query).map((c) => c.id)).toEqual(ids);
  });
});
