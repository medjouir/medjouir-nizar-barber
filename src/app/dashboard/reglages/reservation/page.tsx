import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";
import { SettingsHeader } from "@/components/barber/settings-header";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { RulesForm } from "./rules-form";

export const metadata: Metadata = { title: "Parametres reservation — Nizar" };

async function load() {
  const { barber } = await loadBarberWorkspace();
  const { slotIntervalMinutes, bufferMinutes, minimumNoticeMinutes, horizonDays } = barber.rules;
  return { slotIntervalMinutes, bufferMinutes, minimumNoticeMinutes, horizonDays };
}

export default async function RulesPage() {
  return (
    <BarberPage>
      <SettingsHeader title="Parametres reservation" />
      <RulesForm initial={await load()} />
    </BarberPage>
  );
}
