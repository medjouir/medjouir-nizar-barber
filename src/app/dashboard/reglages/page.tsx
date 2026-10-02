import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";

export const metadata: Metadata = { title: "Reglages — Nizar" };

// Built in a later phase.
export default function ReglagesPage() {
  return (
    <BarberPage>
      <h1 className="text-title font-semibold">Reglages</h1>
    </BarberPage>
  );
}
