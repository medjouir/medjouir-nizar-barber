import type { Metadata } from "next";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { ManualBookingForm } from "./manual-booking-form";

export const metadata: Metadata = { title: "Rendez-vous jdid — Nizar" };

async function load() {
  const { services } = await loadBarberWorkspace();
  return services.filter((s) => s.active).map(({ id, name, durationMinutes }) => ({ id, name, durationMinutes }));
}

export default async function NewAppointmentPage() {
  return <ManualBookingForm services={await load()} />;
}
