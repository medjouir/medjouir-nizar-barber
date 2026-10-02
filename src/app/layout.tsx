import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://medjouir-nizar-barber.vercel.app"),
  title: "Nizar — Barber",
  description: "7jez rendez-vous dyalk 3end Nizar.",
  robots: { index: false, follow: false },
  // Link preview when the booking URL is shared on WhatsApp.
  openGraph: {
    type: "website",
    siteName: "Nizar — Barber",
    title: "Nizar — Barber",
    description: "7jez rendez-vous dyalk 3end Nizar.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Moroccan Darija written in Latin script.
    <html lang="ary-Latn" dir="ltr" className={GeistSans.variable}>
      <body className="min-h-dvh bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}
