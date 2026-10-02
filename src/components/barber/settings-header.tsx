import Link from "next/link";
import { ChevronLeft } from "@/components/icons";

/** Back to Reglages + screen title. */
export function SettingsHeader({ title, back = "/dashboard/reglages" }: { title: string; back?: string }) {
  return (
    <>
      <div className="pb-4">
        <Link href={back} aria-label="Rjo3" className="-ml-2 grid size-11 place-items-center rounded-full active:bg-surface">
          <ChevronLeft />
        </Link>
      </div>
      <h1 className="text-title font-semibold">{title}</h1>
    </>
  );
}
