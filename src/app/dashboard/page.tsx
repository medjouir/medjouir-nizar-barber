import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { requireBarber } from "@/lib/auth";

export const metadata: Metadata = { title: "Lyouma — Nizar" };

// Today's view; programme, next appointment and navigation land in Phase 6.
export default async function DashboardPage() {
  const barber = await requireBarber();

  return (
    <PageShell className="gap-section">
      <h1 className="text-title font-semibold">Salam {barber.public_name} 👋</h1>
    </PageShell>
  );
}
