import { cn } from "@/lib/cn";

/** Subtle booking progress bar — no "step X of Y" wording on purpose. */
export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-0.5 w-full overflow-hidden rounded-full bg-line", className)}
    >
      <div
        className="h-full rounded-full bg-gold transition-[width] duration-200 ease-smooth"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
