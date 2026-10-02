import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";

export const metadata: Metadata = { title: "Planning — Nizar" };

// Built in a later phase.
export default function PlanningPage() {
  return (
    <BarberPage>
      <h1 className="text-title font-semibold">Planning</h1>
    </BarberPage>
  );
}
