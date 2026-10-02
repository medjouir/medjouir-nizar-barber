import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getByToken } from "@/lib/booking/service";
import { getBookingStore } from "@/lib/booking/store";
import { formatDuration, fullDateLabel, localDateTime } from "@/lib/format";
import { todayIn } from "@/lib/scheduling/time";
import { ManageView } from "./manage-view";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ c?: string }> };

export const metadata: Metadata = { title: "Rendez-vous dyalk — Nizar", robots: { index: false, follow: false } };

async function load(token: string) {
  const now = Date.now();
  const { store } = await getBookingStore(now);
  return { now, managed: await getByToken(store, token, now) };
}

export default async function ManagePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { c } = await searchParams;
  const { now, managed } = await load(token);
  if (!managed) notFound();

  const { appointment, service, barber } = managed;
  const tz = barber.rules.timezone;
  const { date, time } = localDateTime(appointment.startAt, tz);

  return (
    <ManageView
      token={token}
      justConfirmed={c === "1" && appointment.status === "confirmed"}
      status={appointment.status}
      changeable={managed.changeable}
      barber={{ slug: barber.slug, name: barber.publicName, mapsUrl: barber.mapsUrl }}
      details={{
        serviceName: service.name,
        duration: formatDuration(appointment.durationMinutes),
        dateLabel: fullDateLabel(date, todayIn(tz, now)),
        time,
      }}
    />
  );
}
