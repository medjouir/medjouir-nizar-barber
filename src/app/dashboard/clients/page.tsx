import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";

export const metadata: Metadata = { title: "Clients — Nizar" };

// Built in a later phase.
export default function ClientsPage() {
  return (
    <BarberPage>
      <h1 className="text-title font-semibold">Clients</h1>
    </BarberPage>
  );
}
