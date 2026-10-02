import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { buildDemoData, DEMO_BARBER_ID } from "./demo-data";
import { MemoryStore } from "./memory-store";
import type { Appointment, Client } from "./types";

/**
 * Demo store: example data + the visitor's own bookings, which are kept in an
 * httpOnly cookie so they survive across serverless instances. Each visitor
 * only ever sees their own bookings on top of the example data.
 *
 * The Supabase-backed store replaces this when the database is connected.
 */
const COOKIE = "nizar_demo";
const MAX_APPOINTMENTS = 15;
const VISITOR_PREFIX = "v-";

type VisitorState = { clients: Client[]; appointments: Appointment[] };

function readState(raw: string | undefined): VisitorState {
  try {
    const parsed = JSON.parse(raw ?? "") as Partial<VisitorState>;
    const ok = (x: { id?: unknown }) => typeof x?.id === "string" && x.id.startsWith(VISITOR_PREFIX);
    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients.filter(ok) : [],
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments.filter(ok) : [],
    };
  } catch {
    return { clients: [], appointments: [] };
  }
}

export async function getBookingStore(now = Date.now()) {
  const jar = await cookies();
  const visitor = readState(jar.get(COOKIE)?.value);
  const data = buildDemoData(now);
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
      .map(({ barberId, ...a }) => a);
    const clientIds = new Set(appointments.map((a) => a.clientId));
    const clients = data.clients
      .filter((c) => c.id.startsWith(VISITOR_PREFIX) && clientIds.has(c.id))
      .map(({ barberId, ...c }) => c);
    jar.set(COOKIE, JSON.stringify({ clients, appointments }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return { store, commit };
}
