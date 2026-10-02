import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";
import { SettingsHeader } from "@/components/barber/settings-header";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { ServicesForm } from "./services-form";

export const metadata: Metadata = { title: "Services — Nizar" };

async function load() {
  const { services } = await loadBarberWorkspace();
  return services.map(({ id, name, durationMinutes, active }) => ({ id, name, durationMinutes, active }));
}

export default async function ServicesSettingsPage() {
  return (
    <BarberPage>
      <SettingsHeader title="Services" />
      <ServicesForm services={await load()} />
    </BarberPage>
  );
}
