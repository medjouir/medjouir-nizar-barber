/**
 * Pure helpers for Nizar's client directory.
 */

import type { AppointmentStatus } from "@/lib/database.types";

export type ClientAppointment = {
  id: string;
  clientId: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  serviceName: string;
};

export type ClientSummary = {
  id: string;
  fullName: string;
  phone: string;
  /** Completed visits ("Tsalat") only. */
  visits: number;
  next: ClientAppointment | null;
};

/** One row per client with completed-visit count and next confirmed appointment. */
export function summarizeClients(
  clients: { id: string; fullName: string; phone: string }[],
  appointments: ClientAppointment[],
  now: number,
): ClientSummary[] {
  return clients
    .map((c) => {
      const own = appointments.filter((a) => a.clientId === c.id);
      return {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        visits: own.filter((a) => a.status === "completed").length,
        next: upcoming(own, now)[0] ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "fr", { sensitivity: "base" }));
}

/** Confirmed appointments not finished yet, soonest first. */
export function upcoming(appointments: ClientAppointment[], now: number): ClientAppointment[] {
  return appointments
    .filter((a) => a.status === "confirmed" && Date.parse(a.endAt) > now)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

/** Past visits (cancellations excluded), most recent first. */
export function history(appointments: ClientAppointment[], now: number): ClientAppointment[] {
  const isPast = (a: ClientAppointment) =>
    a.status === "completed" || a.status === "no_show" || (a.status === "confirmed" && Date.parse(a.endAt) <= now);
  return appointments.filter(isPast).sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Search by name (accent- and case-insensitive, any word order) or by phone
 * in any common format: "0612", "06 12", "+212612", "612…".
 */
export function searchClients<T extends { fullName: string; phone: string }>(clients: T[], query: string): T[] {
  const q = fold(query);
  if (!q) return clients;

  const digits = q.replace(/\D/g, "");
  const isPhoneQuery = digits.length >= 2 && /^[\d\s+().-]+$/.test(q);
  if (isPhoneQuery) {
    // Compare national significant digits. A query written with its prefix
    // ("06…", "+2126…") matches from the start; bare digits match anywhere.
    const prefixed = /^(\+|00)?212|^0/.test(q.replace(/[\s().-]/g, ""));
    const wanted = digits.replace(/^(00)?212/, "").replace(/^0/, "");
    return clients.filter((c) => {
      const national = c.phone.replace(/^\+212/, "");
      return prefixed ? national.startsWith(wanted) : national.includes(wanted);
    });
  }

  const words = q.split(/\s+/);
  return clients.filter((c) => {
    const name = fold(c.fullName);
    return words.every((w) => name.includes(w));
  });
}
