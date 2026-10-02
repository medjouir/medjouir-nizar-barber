"use client";

import type { SlotChoice } from "@/lib/booking/actions";
import { cn } from "@/lib/cn";

export function TimeGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: SlotChoice[];
  selected?: string;
  onSelect: (slot: SlotChoice) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {slots.map((s) => (
        <button
          key={s.startAt}
          type="button"
          onClick={() => onSelect(s)}
          aria-pressed={selected === s.startAt}
          className={cn(
            "h-14 rounded-card border text-body font-medium tabular-nums",
            "transition-[border-color,background-color,color] duration-200 ease-smooth",
            selected === s.startAt
              ? "border-gold bg-gold text-canvas"
              : "border-transparent bg-surface text-fg active:bg-surface-raised",
          )}
        >
          {s.time}
        </button>
      ))}
    </div>
  );
}

export function TimeGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-card bg-surface" />
      ))}
    </div>
  );
}
