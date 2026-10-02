"use client";

import { useState } from "react";
import Link from "next/link";
import { BarberPage } from "@/components/barber/barber-page";
import { ChevronLeft } from "@/components/icons";
import type { AppointmentStatus } from "@/lib/database.types";
import { cn } from "@/lib/cn";
import { place, type Span } from "@/lib/planning";
import { AppointmentSheet } from "./appointment-sheet";

export type PlanItem = {
  id: string;
  startMin: number;
  endMin: number;
  start: string;
  end: string;
  dateLabel: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  duration: string;
  note: string | null;
  status: AppointmentStatus;
};

export type DayColumn = {
  date: string;
  name: string;
  weekday: string;
  short: string;
  isToday: boolean;
  windows: Span[];
  blocks: (Span & { reason: string | null; wholeDay: boolean })[];
  items: PlanItem[];
};

type Props = {
  view: "nhar" | "simana";
  date: string;
  label: string;
  prevDate: string;
  nextDate: string;
  today: string;
  range: Span;
  days: DayColumn[];
  nowMin: number | null;
};

export const STATUS_LABEL: Partial<Record<AppointmentStatus, string>> = { completed: "Tsalat", no_show: "Ma jach" };

const href = (view: string, date: string) => `/dashboard/planning?view=${view}&date=${date}`;

export function PlanningView(props: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = props.days.flatMap((d) => d.items).find((i) => i.id === openId) ?? null;

  return (
    <BarberPage>
      <h1 className="text-title font-semibold">Planning</h1>

      <div role="tablist" className="mt-5 grid grid-cols-2 rounded-card bg-surface p-1">
        {(["nhar", "simana"] as const).map((v) => (
          <Link
            key={v}
            role="tab"
            aria-selected={props.view === v}
            href={href(v, props.date)}
            className={cn(
              "flex h-10 items-center justify-center rounded-[12px] text-body font-medium transition-colors duration-200",
              props.view === v ? "bg-gold text-canvas" : "text-muted",
            )}
          >
            {v === "nhar" ? "Nhar" : "Simana"}
          </Link>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Link href={href(props.view, props.prevDate)} aria-label="Lor" className="grid size-11 place-items-center rounded-full active:bg-surface">
          <ChevronLeft />
        </Link>
        <p className="text-section font-semibold">{props.label}</p>
        <Link href={href(props.view, props.nextDate)} aria-label="Gddam" className="grid size-11 place-items-center rounded-full active:bg-surface">
          <ChevronLeft className="rotate-180" />
        </Link>
      </div>

      <div key={`${props.view}-${props.date}`} className="mt-4 animate-fade-in">
        {props.view === "nhar" ? (
          <DayTimeline day={props.days[0]!} range={props.range} nowMin={props.nowMin} onOpen={setOpenId} />
        ) : (
          <WeekTimeline days={props.days} range={props.range} onOpen={setOpenId} />
        )}
      </div>

      {open && <AppointmentSheet item={open} onClose={() => setOpenId(null)} />}
    </BarberPage>
  );
}

const hoursOf = (range: Span) =>
  Array.from({ length: (range.end - range.start) / 60 + 1 }, (_, i) => range.start + i * 60);
const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:00`;

function DayTimeline({ day, range, nowMin, onOpen }: { day: DayColumn; range: Span; nowMin: number | null; onOpen: (id: string) => void }) {
  const px = 1.2; // 1h = 72px, 1h30 = 108px, 2h = 144px
  const height = (range.end - range.start) * px;
  const wholeDay = day.blocks.find((b) => b.wholeDay);

  if ((day.windows.length === 0 || wholeDay) && day.items.length === 0) {
    return (
      <div className={cn("rounded-card p-5", wholeDay ? "bg-blocked border border-line" : "bg-surface")}>
        <p className="text-body font-medium">{wholeDay ? "Ma disponiblech" : "Ma khedamch"}</p>
        {wholeDay?.reason && <p className="mt-1 text-secondary text-muted">{wholeDay.reason}</p>}
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      {hoursOf(range).map((m) => (
        <div key={m} className="absolute inset-x-0 flex items-start" style={{ top: (m - range.start) * px }}>
          <span className="-mt-2 w-12 shrink-0 text-[11px] tabular-nums text-subtle">{hh(m)}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      ))}

      <div className="absolute inset-y-0 left-12 right-0">
        {day.windows.map((w) => (
          <div key={`w${w.start}`} className="absolute inset-x-0 rounded-[10px] bg-surface/40" style={place(w, range, px)} />
        ))}
        {day.blocks.map((b) => (
          <div
            key={`b${b.start}`}
            className="absolute inset-x-0 overflow-hidden rounded-[10px] border border-line bg-blocked px-3 py-1.5"
            style={place(b, range, px)}
          >
            <p className="text-secondary font-medium text-muted">Ma disponiblech</p>
            {b.reason && <p className="truncate text-[12px] text-subtle">{b.reason}</p>}
          </div>
        ))}
        {day.items.map((item) => {
          const box = place({ start: item.startMin, end: item.endMin }, range, px);
          const compact = box.height < 64; // under ~55 min: one line
          const status = STATUS_LABEL[item.status];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className={cn(
                "absolute inset-x-0 overflow-hidden rounded-[10px] border-l-[3px] bg-surface px-3 text-left transition-colors duration-200 active:bg-surface-raised",
                item.status === "confirmed" ? "border-gold" : "border-subtle",
                item.status === "no_show" && "line-through decoration-subtle",
                compact ? "flex items-center gap-2 py-1" : "py-1.5",
              )}
              style={{ top: box.top + 1, height: box.height - 2 }}
            >
              <span className={cn("block text-[12px] leading-4 tabular-nums", item.status === "confirmed" ? "text-gold" : "text-muted")}>
                {item.start}
                {!compact && ` → ${item.end}`}
              </span>
              <span className={cn("block truncate font-medium", compact ? "text-secondary" : "mt-0.5 text-body leading-5")}>{item.clientName}</span>
              {!compact && (
                <span className="block truncate text-[12px] leading-4 text-muted">
                  {item.serviceName} · {item.duration}
                </span>
              )}
              {status && <span className="absolute right-2 top-2 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-muted">{status}</span>}
            </button>
          );
        })}
        {nowMin !== null && nowMin >= range.start && nowMin <= range.end && (
          <div className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: (nowMin - range.start) * px }}>
            <span className="-ml-1 size-2 rounded-full bg-gold" />
            <span className="h-px flex-1 bg-gold" />
          </div>
        )}
      </div>
    </div>
  );
}

function WeekTimeline({ days, range, onOpen }: { days: DayColumn[]; range: Span; onOpen: (id: string) => void }) {
  const px = 0.6;
  const height = (range.end - range.start) * px;
  return (
    <div>
      <div className="ml-7 grid grid-cols-7 gap-1 pb-2">
        {days.map((d) => (
          <Link
            key={d.date}
            href={href("nhar", d.date)}
            className={cn("flex flex-col items-center rounded-[10px] py-1.5 active:bg-surface", d.isToday ? "text-gold" : "text-fg")}
          >
            <span className="text-[11px] font-medium">{d.weekday}</span>
            <span className={cn("text-[11px]", d.isToday ? "text-gold" : "text-subtle")}>{d.short.split(" ")[0]}</span>
          </Link>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        {hoursOf(range)
          .filter((m) => (m - range.start) % 120 === 0)
          .map((m) => (
            <div key={m} className="absolute inset-x-0 flex items-start" style={{ top: (m - range.start) * px }}>
              <span className="-mt-1.5 w-7 shrink-0 text-[10px] tabular-nums text-subtle">{hh(m).slice(0, 2)}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          ))}
        <div className="absolute inset-y-0 left-7 right-0 grid grid-cols-7 gap-1">
          {days.map((d) => (
            <div key={d.date} className="relative">
              {d.windows.map((w) => (
                <div key={`w${w.start}`} className="absolute inset-x-0 rounded-[6px] bg-surface/50" style={place(w, range, px)} />
              ))}
              {d.blocks.map((b) => (
                <div key={`b${b.start}`} role="img" aria-label="Ma disponiblech" className="absolute inset-x-0 rounded-[6px] border border-line bg-blocked" style={place(b, range, px)} />
              ))}
              {d.items.map((item) => {
                const box = place({ start: item.startMin, end: item.endMin }, range, px);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpen(item.id)}
                    aria-label={`${item.start} ${item.clientName}`}
                    className={cn(
                      "absolute inset-x-0 overflow-hidden rounded-[6px] px-1 pt-0.5 text-left text-[10px] tabular-nums",
                      item.status === "confirmed" ? "bg-gold/25 text-gold" : "bg-surface-raised text-muted",
                      item.status === "no_show" && "line-through decoration-subtle",
                    )}
                    style={{ top: box.top + 1, height: box.height - 2 }}
                  >
                    {item.start}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
