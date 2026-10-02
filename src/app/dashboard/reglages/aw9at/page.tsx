import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";
import { SettingsHeader } from "@/components/barber/settings-header";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { HoursForm } from "./hours-form";

export const metadata: Metadata = { title: "Aw9at lkhedma — Nizar" };

async function load() {
  const { schedule } = await loadBarberWorkspace();
  return schedule.hours
    .filter((h) => h.active !== false)
    .map(({ dayOfWeek, start, end }) => ({ dayOfWeek, start: start.slice(0, 5), end: end.slice(0, 5) }));
}

export default async function HoursPage() {
  return (
    <BarberPage>
      <SettingsHeader title="Aw9at lkhedma" />
      <HoursForm initial={await load()} />
    </BarberPage>
  );
}
