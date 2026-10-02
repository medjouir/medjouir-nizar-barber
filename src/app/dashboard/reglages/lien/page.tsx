import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { BarberPage } from "@/components/barber/barber-page";
import { SettingsHeader } from "@/components/barber/settings-header";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { ShareActions } from "./share-actions";

export const metadata: Metadata = { title: "Lien dyal reservation — Nizar" };

async function load() {
  const { barber } = await loadBarberWorkspace();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "");
  const url = `${origin.replace(/\/$/, "")}/${barber.slug}`;
  // Dark modules on white: the most reliable contrast for phone cameras.
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
  return { url, qr, name: barber.publicName };
}

export default async function BookingLinkPage() {
  const { url, qr, name } = await load();
  return (
    <BarberPage>
      <SettingsHeader title="Lien dyal reservation" />
      <p className="mt-3 text-body text-muted">Clients dyalk y9dro y7ezo direct mn had lien.</p>

      <div className="mt-section rounded-card bg-surface p-5">
        <p className="break-all text-body font-medium text-gold">{url.replace(/^https?:\/\//, "")}</p>
        <div
          role="img"
          aria-label={`QR code: ${url}`}
          className="mx-auto mt-5 w-56 overflow-hidden rounded-[12px] bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
          // Generated server-side by the qrcode library from our own URL.
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </div>

      <div className="mt-5">
        <ShareActions url={url} message={`7jez rendez-vous dyalk 3end ${name}: ${url}`} />
      </div>
    </BarberPage>
  );
}
