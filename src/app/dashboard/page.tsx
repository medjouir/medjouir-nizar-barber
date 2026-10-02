import type { Metadata } from "next";
import Link from "next/link";
import { BarberPage } from "@/components/barber/barber-page";
import { ContactActions } from "@/components/barber/contact-actions";
import { Plus } from "@/components/icons";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { appointmentsOn, buildDayProgram, nextAppointment, type ProgramItem } from "@/lib/dashboard";
import { formatDuration, fullDateLabel, localDateTime } from "@/lib/format";
import { todayIn } from "@/lib/scheduling/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Lyouma — Nizar" };

const STATUS_LABEL = { completed: "Tsalat", no_show: "Ma jach" } as const;

// Proposed copy — pending review.
const EMPTY = { next: "Ma kayn 7ta rendez-vous jay.", day: "Ma kayn 7ta rendez-vous lyouma." };

async function load() {
  const now = Date.now();
  const ws = await loadBarberWorkspace(now);
  const tz = ws.barber.rules.timezone;
  const today = todayIn(tz, now);
  return {
    name: ws.barber.publicName,
    tz,
    today,
    count: appointmentsOn(today, tz, ws.appointments).length,
    next: nextAppointment(ws.appointments, now),
    program: buildDayProgram({
      date: today,
      timeZone: tz,
      now,
      hours: ws.schedule.hours,
      exceptions: ws.schedule.exceptions,
      appointments: ws.appointments,
      slotIntervalMinutes: ws.barber.rules.slotIntervalMinutes,
    }),
  };
}

export default async function TodayPage() {
  const { name, tz, today, count, next, program } = await load();
  const nextAt = next && localDateTime(next.startAt, tz);

  return (
    <BarberPage>
      <header>
        <h1 className="text-title font-semibold">Salam {name} 👋</h1>
        <p className="mt-2 text-body text-muted">3endek {count} rendez-vous lyouma.</p>
      </header>

      <section className="mt-section" aria-labelledby="next-title">
        <h2 id="next-title" className="text-section font-semibold">
          Jay mn b3d
        </h2>
        {next && nextAt ? (
          <div className="mt-3 rounded-card bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-time font-semibold tabular-nums text-gold">{nextAt.time}</p>
              {nextAt.date !== today && <p className="text-secondary text-muted">{fullDateLabel(nextAt.date, today)}</p>}
            </div>
            <p className="mt-3 text-section font-semibold">{next.clientName}</p>
            <p className="mt-1 text-body text-muted">
              {next.serviceName} · {formatDuration(next.durationMinutes)}
            </p>
            <div className="mt-5">
              <ContactActions phone={next.clientPhone} />
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-card bg-surface p-5 text-body text-muted">{EMPTY.next}</p>
        )}
      </section>

      <section className="mt-section" aria-labelledby="program-title">
        <h2 id="program-title" className="text-section font-semibold">
          Programme dyal lyouma
        </h2>
        {program.length === 0 ? (
          <p className="mt-3 text-body text-muted">{EMPTY.day}</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {program.map((item) => (
              <ProgramRow key={item.kind === "free" ? `free-${item.start}` : item.appointment.id} item={item} />
            ))}
          </ol>
        )}
      </section>

      <Link
        href="/dashboard/rendez-vous/jdid"
        className="fixed bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+1rem)] right-[max(1.25rem,calc(50vw-14rem+1.25rem))] z-10 inline-flex h-14 items-center gap-2 rounded-full bg-gold px-5 text-body font-semibold text-canvas shadow-[0_8px_24px_rgb(0_0_0/0.5)] transition-colors duration-200 active:bg-gold-pressed"
      >
        <Plus width={20} height={20} strokeWidth={2.25} />
        Rendez-vous
      </Link>
    </BarberPage>
  );
}

function ProgramRow({ item }: { item: ProgramItem }) {
  if (item.kind === "free") {
    return (
      <li className="flex items-center justify-between rounded-card border border-dashed border-line-strong px-4 py-3">
        <span className="text-body text-muted">Libre</span>
        <span className="text-secondary tabular-nums text-subtle">
          {item.start} → {item.end}
        </span>
      </li>
    );
  }
  const a = item.appointment;
  const status = a.status === "completed" || a.status === "no_show" ? STATUS_LABEL[a.status] : null;
  return (
    <li className={cn("flex gap-4 rounded-card bg-surface p-card", a.status === "no_show" && "opacity-60")}>
      <div className="w-14 shrink-0 tabular-nums">
        <p className="text-body font-semibold">{item.start}</p>
        <p className="text-secondary text-subtle">{item.end}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium">{a.clientName}</p>
        <p className="text-secondary text-muted">
          {a.serviceName} · {formatDuration(a.durationMinutes)}
        </p>
      </div>
      {status && <span className="self-start rounded-full bg-surface-raised px-2.5 py-1 text-[12px] text-muted">{status}</span>}
    </li>
  );
}
