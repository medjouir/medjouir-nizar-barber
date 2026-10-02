import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { BarberRow } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Example barber used while Supabase is not connected (demo mode, no login). */
const DEMO_BARBER: BarberRow = {
  id: "demo-barber-nizar",
  user_id: null,
  public_name: "Nizar",
  salon_name: null,
  slug: "nizar",
  email: "nizar@example.com",
  phone: null,
  avatar_url: null,
  address: "Casablanca",
  city: "Casablanca",
  maps_url: "https://maps.google.com/?q=Casablanca",
  timezone: "Africa/Casablanca",
  slot_interval_minutes: 15,
  buffer_minutes: 0,
  minimum_booking_notice_minutes: 30,
  booking_horizon_days: 30,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

/**
 * The barber account owned by the signed-in user, or null.
 * The user is revalidated with Supabase (getUser), and the barber row is read
 * through RLS, so a signed-in user who does not own a barber gets null.
 */
export const getCurrentBarber = cache(async (): Promise<BarberRow | null> => {
  if (!isSupabaseConfigured()) return DEMO_BARBER;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("barbers").select("*").eq("user_id", user.id).maybeSingle();
  return data;
});

/** Server-side guard for every barber page, action and route handler. */
export async function requireBarber(): Promise<BarberRow> {
  const barber = await getCurrentBarber();
  if (!barber) redirect("/login");
  return barber;
}
