import type { Metadata } from "next";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { summarizeClients } from "@/lib/clients";
import { ClientsList } from "./clients-list";

export const metadata: Metadata = { title: "Clients — Nizar" };

async function load() {
  const ws = await loadBarberWorkspace();
  return summarizeClients(ws.clients, ws.clientAppointments, Date.now()).map(({ id, fullName, phone, visits }) => ({
    id,
    fullName,
    phone,
    visits,
  }));
}

export default async function ClientsPage() {
  return <ClientsList clients={await load()} />;
}
