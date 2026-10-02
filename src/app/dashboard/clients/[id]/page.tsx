import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarberPage } from "@/components/barber/barber-page";
import { ContactActions } from "@/components/barber/contact-actions";
import { ChevronLeft, Plus } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { history, upcoming } from "@/lib/clients";
import { formatDuration, fullDateLabel, localDateTime } from "@/lib/format";
import { formatMoroccanPhone } from "@/lib/phone";
import { todayIn } from "@/lib/scheduling/time";
import { visitsLabel } from "@/lib/visits";

export const metadata: Metadata = { title: "Client — Nizar" };

type Props = { params: Promise<{ id: string }> };

const STATUS = { completed: "Tsalat", no_show: "Ma jach" } as const;

// Proposed copy — pending review.
const COPY = { next: "Rendez-vous jay", history: "Historique", emptyHistory: "Mazal ma kayn walo." };

async function load(id: string) {
  const now = Date.now();
  const ws = await loadBarberWorkspace(now);
  const client = ws.clients.find((c) => c.id === id);
  if (!client) return null;
  const tz = ws.barber.rules.timezone;
  const today = todayIn(tz, now);
  const own = ws.clientAppointments.filter((a) => a.clientId === id);
  const describe = (a: (typeof own)[number]) => {
    const { date, time } = localDateTime(a.startAt, tz);
    return { ...a, time, dateLabel: fullDateLabel(date, today), duration: formatDuration(a.durationMinutes) };
  };
  return {
    client,
    visits: own.filter((a) => a.status === "completed").length,
    next: upcoming(own, now).map(describe)[0] ?? null,
    past: history(own, now).map(describe),
  };
}

export default async function ClientProfilePage({ params }: Props) {
  const data = await load(decodeURIComponent((await params).id));
  if (!data) notFound();
  const { client, visits, next, past } = data;

  return (
    <BarberPage>
      <div className="pb-4">
        <Link href="/dashboard/clients" aria-label="Rjo3" className="-ml-2 grid size-11 place-items-center rounded-full active:bg-surface">
          <ChevronLeft />
        </Link>
      </div>

      <h1 className="text-title font-semibold">{client.fullName}</h1>
      <p className="mt-1 text-body tabular-nums text-muted">{formatMoroccanPhone(client.phone)}</p>
      <div className="mt-5">
        <ContactActions phone={client.phone} />
      </div>

      <p className="mt-section text-section font-semibold">{visitsLabel(visits)}</p>

      {next && (
        <section className="mt-6" aria-labelledby="next-title">
          <h2 id="next-title" className="text-secondary text-muted">
            {COPY.next}
          </h2>
          <div className="mt-2 rounded-card bg-surface p-5">
            <p className="text-time font-semibold tabular-nums text-gold">{next.time}</p>
            <p className="mt-2 text-body">{next.dateLabel}</p>
            <p className="mt-1 text-body text-muted">
              {next.serviceName} · {next.duration}
            </p>
          </div>
        </section>
      )}

      <section className="mt-section" aria-labelledby="history-title">
        <h2 id="history-title" className="text-section font-semibold">
          {COPY.history}
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 text-body text-muted">{COPY.emptyHistory}</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {past.map((a) => {
              const status = a.status === "completed" || a.status === "no_show" ? STATUS[a.status] : null;
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-card bg-surface p-card">
                  <span className="min-w-0">
                    <span className="block text-body">
                      {a.dateLabel} · <span className="tabular-nums">{a.time}</span>
                    </span>
                    <span className="block text-secondary text-muted">
                      {a.serviceName} · {a.duration}
                    </span>
                  </span>
                  {status && (
                    <span
                      className={
                        a.status === "completed"
                          ? "shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-[12px] text-gold"
                          : "shrink-0 rounded-full bg-surface-raised px-2.5 py-1 text-[12px] text-muted"
                      }
                    >
                      {status}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-section">
        <Link href={`/dashboard/rendez-vous/jdid?client=${encodeURIComponent(client.id)}`} className={buttonClasses("primary")}>
          <Plus width={20} height={20} strokeWidth={2.25} />
          Zid rendez-vous
        </Link>
      </div>
    </BarberPage>
  );
}
