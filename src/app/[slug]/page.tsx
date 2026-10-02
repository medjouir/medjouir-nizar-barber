import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { MapPin } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import { getBookingStore } from "@/lib/booking/store";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await getBookingStore();
  const barber = await store.getBarberBySlug(slug);
  return barber ? { title: `${barber.publicName} — Barber`, description: `7jez rendez-vous dyalk 3end ${barber.publicName}.` } : {};
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const { store } = await getBookingStore();
  const barber = await store.getBarberBySlug(slug);
  if (!barber) notFound();

  return (
    <PageShell className="animate-fade-in">
      <div className="pt-8">
        <BrandMark />
      </div>

      <div className="mt-auto pb-section">
        <h1 className="text-hero font-semibold">7jez rendez-vous dyalk 3end {barber.publicName}.</h1>
        <p className="mt-4 text-body text-muted">Chof lwa9t li kayn w khtar li ynasbek.</p>
      </div>

      <div className="flex flex-col gap-3 pb-2">
        <ButtonLink href={`/${barber.slug}/7jez`}>7jez daba</ButtonLink>
        {barber.mapsUrl && (
          <ButtonLink href={barber.mapsUrl} external variant="text">
            <MapPin width={18} height={18} />
            Chof localisation
          </ButtonLink>
        )}
      </div>
    </PageShell>
  );
}
