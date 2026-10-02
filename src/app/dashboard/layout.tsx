import type { ReactNode } from "react";
import { BottomNav } from "@/components/barber/bottom-nav";
import { requireBarber } from "@/lib/auth";

// Authoritative server-side guard for the whole private area.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireBarber();
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
