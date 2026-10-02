import type { ReactNode } from "react";

/** Keeps the main actions at the bottom of the screen, within thumb reach. */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-page mt-auto flex flex-col gap-2 bg-gradient-to-t from-canvas from-70% to-transparent px-page pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-6">
      {children}
    </div>
  );
}
