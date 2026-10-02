import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** POST only, so a third-party link or image cannot sign Nizar out. */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
