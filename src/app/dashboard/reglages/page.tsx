import type { Metadata } from "next";
import Link from "next/link";
import { BarberPage } from "@/components/barber/barber-page";
import { ChevronLeft } from "@/components/icons";

export const metadata: Metadata = { title: "Reglages — Nizar" };

const ENTRIES = [
  { href: "profil", label: "Profil" },
  { href: "services", label: "Services" },
  { href: "aw9at", label: "Aw9at lkhedma" },
  { href: "ma-disponiblech", label: "Ma disponiblech" },
  { href: "reservation", label: "Parametres reservation" },
  { href: "lien", label: "Lien dyal reservation" },
  { href: "compte", label: "Compte" },
] as const;

export default function SettingsPage() {
  return (
    <BarberPage>
      <h1 className="text-title font-semibold">Reglages</h1>
      <ul className="mt-section overflow-hidden rounded-card bg-surface">
        {ENTRIES.map((e) => (
          <li key={e.href} className="border-b border-line last:border-b-0">
            <Link
              href={`/dashboard/reglages/${e.href}`}
              className="flex h-14 items-center justify-between px-card text-body transition-colors duration-200 active:bg-surface-raised"
            >
              {e.label}
              <ChevronLeft width={18} height={18} className="rotate-180 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </BarberPage>
  );
}
