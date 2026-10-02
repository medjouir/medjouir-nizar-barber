import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page column for Nizar's area, leaving room for the bottom navigation. */
export function BarberPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-md flex-col px-page pt-[max(env(safe-area-inset-top),1.5rem)]",
        "pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+6rem)] animate-fade-in",
        className,
      )}
    >
      {children}
    </main>
  );
}
