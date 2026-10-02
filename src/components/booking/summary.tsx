import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Appointment summary card: time large and gold, details below. */
export function AppointmentSummary({
  time,
  dateLabel,
  rows,
  className,
}: {
  time: string;
  dateLabel: string;
  rows: { label?: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-card bg-surface p-5", className)}>
      <p className="text-time font-semibold tabular-nums text-gold">{time}</p>
      <p className="mt-2 text-body text-fg">{dateLabel}</p>
      <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            {r.label && <dt className="text-secondary text-muted">{r.label}</dt>}
            <dd className={cn("text-body text-fg", !r.label && "w-full")}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Small context chips (date · service · duration). */
export function ContextChips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-surface px-3 py-1.5 text-secondary text-muted">
          {item}
        </li>
      ))}
    </ul>
  );
}
