import { getByToken } from "@/lib/booking/service";
import { getBookingStore } from "@/lib/booking/store";

/** "Zidha l calendrier": an .ics file for the appointment (token-protected). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const now = Date.now();
  const { store } = await getBookingStore(now);
  const managed = await getByToken(store, token, now);
  if (!managed || managed.appointment.status === "cancelled") return new Response("Not found", { status: 404 });

  const { appointment, service, barber } = managed;
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nizar Barber//Booking//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@nizar-barber`,
    `DTSTAMP:${stamp(new Date(now).toISOString())}`,
    `DTSTART:${stamp(appointment.startAt)}`,
    `DTEND:${stamp(appointment.endAt)}`,
    `SUMMARY:${escape(`${service.name} — ${barber.publicName}`)}`,
    barber.address ? `LOCATION:${escape(barber.address)}` : null,
    barber.mapsUrl ? `URL:${barber.mapsUrl}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rendez-vous-nizar.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
