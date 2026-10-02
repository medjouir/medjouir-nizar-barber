"use client";

import { ChevronLeft } from "@/components/icons";
import { Progress } from "@/components/ui/progress";

/** Back button + subtle progress. No "step X of Y" wording on purpose. */
export function StepHeader({ progress, onBack, backLabel = "Rjo3" }: { progress?: number; onBack: () => void; backLabel?: string }) {
  return (
    <div className="flex items-center gap-3 pb-6">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-fg transition-colors duration-200 active:bg-surface"
      >
        <ChevronLeft />
      </button>
      {progress !== undefined && <Progress value={progress} className="flex-1" />}
    </div>
  );
}
