import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Mobile-first page column: 20px gutters, safe-area aware, centred and
 * width-capped on larger screens so the phone layout stays intact.
 */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-md flex-col px-page",
        "pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]",
        className,
      )}
    >
      {children}
    </main>
  );
}
