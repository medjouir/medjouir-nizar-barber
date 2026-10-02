import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** 24h times on a 15-minute grid, independent of the phone's locale (no AM/PM). */
export const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
);

export function TimeSelect({ value, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { value: string }) {
  const options = QUARTER_HOURS.includes(value) ? QUARTER_HOURS : [...QUARTER_HOURS, value].sort();
  return (
    <select
      value={value}
      className={cn(
        "h-12 w-full appearance-none rounded-[12px] border border-line bg-canvas/50 px-3 text-center text-body tabular-nums text-fg",
        "transition-colors duration-200 focus:border-gold focus:outline-none",
        className,
      )}
      {...props}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
