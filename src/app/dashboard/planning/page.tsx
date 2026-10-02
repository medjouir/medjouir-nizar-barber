import type { Metadata } from "next";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { DARIJA_DAYS, dayName, formatDuration, fullDateLabel, localDateTime, shortDate } from "@/lib/format";
import { blockedSpans, visibleRange, weekDates } from "@/lib/planning";
import { openWindows } from "@/lib/scheduling/availability";
import { addDays, dayOfWeek, instantToZoned, isLocalDate, todayIn } from "@/lib/scheduling/time";
import { PlanningView, type DayColumn, type PlanItem } from "./planning-view";

export const metadata: Metadata = { title: "Planning — Nizar" };

type Props = { searchParams: Promise<{ view?: string; date?: string }> };

async function load(viewParam?: string, dateParam?: string) {
  const now = Date.now();
  const ws = await loadBarberWorkspace(now);
  const tz = ws.barber.rules.timezone;
  const today = todayIn(tz, now);
  const view = viewParam === "simana" ? "simana" : "nhar";
  const date = isLocalDate(dateParam) ? dateParam : today;
  const dates = view === "simana" ? weekDates(date) : [date];

  const visible = ws.appointments.filter((a) => a.status !== "cancelled");
  const range = visibleRange({ dates, hours: ws.schedule.hours, exceptions: ws.schedule.exceptions, appointments: visible, timeZone: tz });

  const days: DayColumn[] = dates.map((d) => {
    const items: PlanItem[] = visible
      .filter((a) => instantToZoned(Date.parse(a.startAt), tz).date === d)
      .map((a) => {
        const s = localDateTime(a.startAt, tz);
        const e = localDateTime(a.endAt, tz);
        const startMin = instantToZoned(Date.parse(a.startAt), tz).minutes;
        return {
          id: a.id,
          startMin,
          endMin: startMin + a.durationMinutes,
          start: s.time,
          end: e.time,
          dateLabel: fullDateLabel(d, today),
          clientName: a.clientName,
          clientPhone: a.clientPhone,
          serviceName: a.serviceName,
          duration: formatDuration(a.durationMinutes),
          note: a.note,
          status: a.status,
        };
      });
    const windows = openWindows(d, ws.schedule.hours, ws.schedule.exceptions);
    return {
      date: d,
      name: dayName(d, today),
      weekday: DARIJA_DAYS[dayOfWeek(d)]!,
      short: shortDate(d),
      isToday: d === today,
      windows,
      blocks: blockedSpans(d, ws.schedule.exceptions, range),
      items,
    };
  });

  const step = view === "simana" ? 7 : 1;
  const label =
    view === "simana" ? `${shortDate(dates[0]!)} → ${shortDate(dates[6]!)}` : fullDateLabel(date, today);

  return {
    view,
    date,
    label,
    prevDate: addDays(date, -step),
    nextDate: addDays(date, step),
    today,
    range,
    days,
    nowMin: dates.includes(today) ? instantToZoned(now, tz).minutes : null,
  } as const;
}

export default async function PlanningPage({ searchParams }: Props) {
  const { view, date } = await searchParams;
  return <PlanningView {...await load(view, date)} />;
}
