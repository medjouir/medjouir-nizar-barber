"use client";

import type { ReactNode } from "react";
import { Check } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Large selectable card; selected = gold border with a small check. */
export function ChoiceCard({
  selected,
  disabled,
  onSelect,
  children,
  className,
}: {
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-center rounded-card border bg-surface p-card text-left",
        "transition-[border-color,background-color] duration-200 ease-smooth",
        selected ? "border-gold bg-gold/[0.06]" : "border-transparent active:bg-surface-raised",
        disabled && "cursor-not-allowed opacity-35",
        className,
      )}
    >
      {children}
      {selected && (
        <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-gold text-canvas">
          <Check width={12} height={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
