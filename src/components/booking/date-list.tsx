"use client";

import type { DateChoice } from "@/lib/booking/actions";
import { cn } from "@/lib/cn";

/** Lyouma / Gheda first as large cards, then upcoming days. Unavailable days are disabled. */
export function DateList({
  options,
  selected,
  onSelect,
}: {
  options: DateChoice[];
  selected?: string;
  onSelect: (date: string) => void;
}) {
  const [first, second, ...rest] = options;
  const day = (o: DateChoice, large: boolean) => (
    <button
      key={o.date}
      type="button"
      disabled={!o.available}
      onClick={() => onSelect(o.date)}
      aria-pressed={selected === o.date}
      className={cn(
        "flex flex-col items-start justify-center rounded-card border bg-surface px-4 text-left",
        "transition-[border-color,background-color] duration-200 ease-smooth",
        large ? "h-20" : "h-16",
        selected === o.date ? "border-gold bg-gold/[0.06]" : "border-transparent active:bg-surface-raised",
        !o.available && "cursor-not-allowed opacity-35",
      )}
    >
      <span className={cn("font-semibold", large ? "text-section" : "text-body")}>{o.name}</span>
      <span className={cn("text-secondary", o.available ? "text-muted" : "text-subtle line-through")}>{o.short}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {first && day(first, true)}
        {second && day(second, true)}
      </div>
      <div className="grid grid-cols-3 gap-3">{rest.map((o) => day(o, false))}</div>
    </div>
  );
}

export function DateListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-card bg-surface" />
        <div className="h-20 animate-pulse rounded-card bg-surface" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    </div>
  );
}
