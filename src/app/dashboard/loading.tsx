import { BarberPage } from "@/components/barber/barber-page";

/** Skeleton while Nizar's screens load — never an empty screen. */
export default function DashboardLoading() {
  return (
    <BarberPage>
      <div aria-hidden className="flex flex-col gap-3">
        <div className="h-9 w-48 animate-pulse rounded-[10px] bg-surface" />
        <div className="h-5 w-40 animate-pulse rounded-[8px] bg-surface" />
        <div className="mt-6 h-40 animate-pulse rounded-card bg-surface" />
        <div className="h-16 animate-pulse rounded-card bg-surface" />
        <div className="h-16 animate-pulse rounded-card bg-surface" />
        <div className="h-16 animate-pulse rounded-card bg-surface" />
      </div>
      <p role="status" className="sr-only">
        Loading
      </p>
    </BarberPage>
  );
}
