import type { Metadata } from "next";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { formatMoroccanPhone } from "@/lib/phone";
import { ManualBookingForm } from "./manual-booking-form";

export const metadata: Metadata = { title: "Rendez-vous jdid — Nizar" };

type Props = { searchParams: Promise<{ client?: string }> };

async function load(clientId?: string) {
  const { services, clients } = await loadBarberWorkspace();
  const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
  return {
    services: services.filter((s) => s.active).map(({ id, name, durationMinutes }) => ({ id, name, durationMinutes })),
    initialClient: client ? { fullName: client.fullName, phone: formatMoroccanPhone(client.phone) } : undefined,
  };
}

export default async function NewAppointmentPage({ searchParams }: Props) {
  const { client } = await searchParams;
  const data = await load(client);
  return <ManualBookingForm services={data.services} initialClient={data.initialClient} />;
}
