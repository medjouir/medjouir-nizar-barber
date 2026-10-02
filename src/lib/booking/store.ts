import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { validateHours, validateProfile, validateRules, validateService } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateException } from "@/lib/scheduling/availability";
import { isLocalDate } from "@/lib/scheduling/time";
import { buildDemoData, DEMO_BARBER_ID } from "./demo-data";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { Appointment, BookingStore, Client } from "./types";

/**
 * Demo store: example data + the visitor's own bookings (and changes made to
 * example appointments), kept in an httpOnly cookie so they survive across
 * serverless instances. Each visitor only ever sees their own changes on top
 * of the example data.
 *
 * The Supabase-backed store replaces this when the database is connected.
 */
const COOKIE = "nizar_demo";
const CONFIG_COOKIE = "nizar_demo_cfg";
// Browsers drop cookies over 4 KB: keep the newest bookings and short notes.
const MAX_APPOINTMENTS = 6;
const MAX_NOTE = 140;
const VISITOR_PREFIX = "v-";

/** Changed fields of an example (seed) appointment. */
type Override = Pick<Appointment, "status" | "startAt" | "endAt" | "cancelledAt">;
type VisitorState = { clients: Client[]; appointments: Appointment[]; overrides: Record<string, Override> };

const STATUSES = new Set(["confirmed", "completed", "cancelled", "no_show"]);

function readState(raw: string | undefined): VisitorState {
  const empty = { clients: [], appointments: [], overrides: {} };
  try {
    const parsed = JSON.parse(raw ?? "") as Partial<VisitorState>;
    const ok = (x: { id?: unknown }) => typeof x?.id === "string" && x.id.startsWith(VISITOR_PREFIX);
    const overrides: Record<string, Override> = {};
    for (const [id, o] of Object.entries(parsed.overrides ?? {})) {
      if (o && STATUSES.has(o.status) && !Number.isNaN(Date.parse(o.startAt)) && !Number.isNaN(Date.parse(o.endAt))) {
        overrides[id] = { status: o.status, startAt: o.startAt, endAt: o.endAt, cancelledAt: o.cancelledAt ?? null };
      }
    }
    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients.filter(ok) : [],
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments.filter(ok) : [],
      overrides,
    };
  } catch {
    return empty;
  }
}

/** Settings changed by the visitor (services, hours, blocks, profile, rules). */
type DemoConfig = {
  services?: { id: string; name: string; durationMinutes: number; active: boolean }[];
  hours?: unknown;
  exceptions?: DateException[];
  barber?: Record<string, unknown>;
};

function applyConfig(data: ReturnType<typeof buildDemoData>, raw: string | undefined) {
  let config: DemoConfig;
  try {
    config = JSON.parse(raw ?? "") as DemoConfig;
  } catch {
    return;
  }
  const barber = data.barbers[0]!;
  const schedule = data.schedules[DEMO_BARBER_ID]!;
  for (const patch of Array.isArray(config.services) ? config.services : []) {
    const service = data.services.find((x) => x.id === patch?.id);
    const valid = validateService(patch ?? {});
    if (service && valid.ok) Object.assign(service, valid.value);
  }
  const hours = config.hours === undefined ? null : validateHours(config.hours);
  if (hours?.ok) schedule.hours = hours.value;
  if (Array.isArray(config.exceptions)) {
    schedule.exceptions = config.exceptions
      .filter((e) => e && isLocalDate(e.date) && (e.type === "blocked" || e.type === "closed") && typeof e.id === "string")
      .map((e) => ({ id: e.id, date: e.date, type: e.type, start: e.start ?? null, end: e.end ?? null, reason: e.reason ?? null }));
  }
  if (config.barber) {
    const profile = validateProfile(config.barber);
    if (profile.ok) Object.assign(barber, profile.value);
    const rules = validateRules((config.barber.rules ?? {}) as Record<string, unknown>, barber.rules);
    if (rules.ok) barber.rules = rules.value;
  }
}

/**
 * The app's data source: Supabase when it is configured (URL, anon key and
 * server-only service-role key), otherwise the demo store.
 */
export async function getBookingStore(now = Date.now()): Promise<{ store: BookingStore; commit: () => Promise<void> }> {
  if (isSupabaseConfigured()) {
    // Writes are already persisted by Supabase; nothing to commit.
    return { store: new SupabaseStore(createAdminClient()), commit: async () => {} };
  }
  return getDemoStore(now);
}

async function getDemoStore(now: number) {
  const jar = await cookies();
  const visitor = readState(jar.get(COOKIE)?.value);
  const data = buildDemoData(now);
  const pristine = JSON.stringify({ s: data.services, h: data.schedules, b: data.barbers });
  applyConfig(data, jar.get(CONFIG_COOKIE)?.value);
  const seed = new Map(data.appointments.map((a) => [a.id, { ...a }]));
  for (const a of data.appointments) Object.assign(a, visitor.overrides[a.id] ?? {});
  data.clients.push(...visitor.clients.map((c) => ({ ...c, barberId: DEMO_BARBER_ID })));
  data.appointments.push(...visitor.appointments.map((a) => ({ ...a, barberId: DEMO_BARBER_ID })));

  const store = new MemoryStore(data, {
    id: () => `${VISITOR_PREFIX}${randomUUID()}`,
    token: () => randomBytes(32).toString("hex"),
  });

  /** Persist the visitor's bookings. Only callable from Server Actions / Route Handlers. */
  async function commit() {
    const appointments = data.appointments
      .filter((a) => a.id.startsWith(VISITOR_PREFIX))
      .slice(-MAX_APPOINTMENTS)
      .map(({ barberId, ...a }) => ({ ...a, clientNote: a.clientNote?.slice(0, MAX_NOTE) ?? null }));
    const clientIds = new Set(appointments.map((a) => a.clientId));
    const clients = data.clients
      .filter((c) => c.id.startsWith(VISITOR_PREFIX) && clientIds.has(c.id))
      .map(({ barberId, ...c }) => c);
    const overrides: Record<string, Override> = {};
    for (const a of data.appointments) {
      const original = seed.get(a.id);
      if (!original) continue;
      if (a.status !== original.status || a.startAt !== original.startAt || a.endAt !== original.endAt) {
        overrides[a.id] = { status: a.status, startAt: a.startAt, endAt: a.endAt, cancelledAt: a.cancelledAt };
      }
    }
    const options = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    };
    jar.set(COOKIE, JSON.stringify({ clients, appointments, overrides }), options);

    // Settings: stored only once they differ from the example data.
    if (JSON.stringify({ s: data.services, h: data.schedules, b: data.barbers }) !== pristine) {
      const barber = data.barbers[0]!;
      const schedule = data.schedules[DEMO_BARBER_ID]!;
      const config: DemoConfig = {
        services: data.services.map(({ id, name, durationMinutes, active }) => ({ id, name, durationMinutes, active })),
        hours: schedule.hours,
        exceptions: schedule.exceptions.map((e) => ({ ...e, reason: e.reason?.slice(0, 80) ?? null })),
        barber: {
          publicName: barber.publicName,
          salonName: barber.salonName,
          phone: barber.phone,
          address: barber.address,
          city: barber.city,
          mapsUrl: barber.mapsUrl,
          rules: barber.rules,
        },
      };
      jar.set(CONFIG_COOKIE, JSON.stringify(config), options);
    }
  }

  return { store, commit };
}
