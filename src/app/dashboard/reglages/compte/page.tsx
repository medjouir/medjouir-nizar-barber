import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";
import { SettingsHeader } from "@/components/barber/settings-header";
import { buttonClasses } from "@/components/ui/button";
import { requireBarber } from "@/lib/auth";

export const metadata: Metadata = { title: "Compte — Nizar" };

export default async function AccountPage() {
  const account = await requireBarber();
  return (
    <BarberPage>
      <SettingsHeader title="Compte" />
      <div className="mt-section rounded-card bg-surface p-card">
        <p className="text-secondary text-muted">Email</p>
        <p className="mt-1 break-all text-body">{account.email}</p>
      </div>
      {/* POST only: a link or image elsewhere cannot sign Nizar out. */}
      <form action="/auth/signout" method="post" className="mt-section">
        {/* Proposed copy — pending review. */}
        <button type="submit" className={buttonClasses("danger")}>
          Khroj
        </button>
      </form>
    </BarberPage>
  );
}
