import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Keeps Nizar's session fresh and sends signed-out visitors of the private
 * area to /login. Optimistic only: the authoritative checks are
 * requireBarber() in the dashboard layout and RLS in the database.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (!user) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Public booking pages stay cookie-free; only the private area is matched.
  matcher: ["/dashboard/:path*"],
};
