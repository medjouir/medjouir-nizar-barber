/**
 * Typed access to environment variables.
 * NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. See .env.example.`);
  }
  return value;
}

// The Vercel Supabase integration may inject either the legacy key names or the
// newer publishable/secret ones; both work.
function anonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

/** Server-only key. Never prefix with NEXT_PUBLIC_. */
export function serviceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
}

export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey());
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
};

/**
 * Supabase is wired only when its URL and both keys are set. Until then the app
 * runs on built-in example data (demo mode) and the barber area needs no login.
 * Requiring all three avoids a half state (login enforced but demo data shown).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && anonKey() && serviceRoleKey());
}
