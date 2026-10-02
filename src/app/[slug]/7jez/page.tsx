import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingStore } from "@/lib/booking/store";
import { BookingFlow } from "./booking-flow";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "7jez — Nizar" };

export default async function BookingPage({ params }: Props) {
  const { slug } = await params;
  const { store } = await getBookingStore();
  const barber = await store.getBarberBySlug(slug);
  if (!barber) notFound();
  const services = (await store.listServices(barber.id))
    .filter((s) => s.active)
    .map(({ id, name, durationMinutes }) => ({ id, name, durationMinutes }));

  return <BookingFlow slug={barber.slug} barberName={barber.publicName} services={services} />;
}
