import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";
import { SettingsHeader } from "@/components/barber/settings-header";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil — Nizar" };

async function load() {
  const { barber } = await loadBarberWorkspace();
  const { publicName, salonName, phone, address, city, mapsUrl } = barber;
  return { publicName, salonName, phone, address, city, mapsUrl };
}

export default async function ProfilePage() {
  return (
    <BarberPage>
      <SettingsHeader title="Profil" />
      <ProfileForm initial={await load()} />
    </BarberPage>
  );
}
