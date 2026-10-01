import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { BarberRow } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * The barber account owned by the signed-in user, or null.
 * The user is revalidated with Supabase (getUser), and the barber row is read
 * through RLS, so a signed-in user who does not own a barber gets null.
 */
export const getCurrentBarber = cache(async (): Promise<BarberRow | null> => {
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
