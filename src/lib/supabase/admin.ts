import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv, serviceRoleKey as readServiceRoleKey } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — server-only, used for narrowly scoped
 * public operations (availability, booking, token management) after validation.
 * Never import from client code.
 */
export function createAdminClient() {
  const serviceRoleKey = readServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. See .env.example.");
  }

  return createClient<Database>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
