"use client";

import { cn } from "@/lib/cn";

/** Accessible on/off switch (gold when on). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ease-smooth disabled:opacity-50",
        checked ? "bg-gold" : "bg-surface-raised",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1 size-6 rounded-full bg-fg shadow transition-transform duration-200 ease-smooth",
          checked ? "translate-x-[24px] bg-canvas" : "translate-x-1",
        )}
      />
    </button>
  );
}
