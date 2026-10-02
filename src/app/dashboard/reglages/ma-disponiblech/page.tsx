import type { Metadata } from "next";
import { BarberPage } from "@/components/barber/barber-page";
import { SettingsHeader } from "@/components/barber/settings-header";
import { loadBarberWorkspace } from "@/lib/barber/data";
import { fullDateLabel } from "@/lib/format";
import { addDays, todayIn } from "@/lib/scheduling/time";
import { BlockForm } from "./block-form";

export const metadata: Metadata = { title: "Ma disponiblech — Nizar" };

async function load() {
  const now = Date.now();
  const ws = await loadBarberWorkspace(now);
  const today = todayIn(ws.barber.rules.timezone, now);
  const blocks = ws.schedule.exceptions
    .filter((e) => (e.type === "blocked" || e.type === "closed") && e.date >= today && e.id)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""))
    .map((e) => ({
      id: e.id!,
      dateLabel: fullDateLabel(e.date, today),
      range: e.start && e.end ? `${e.start.slice(0, 5)} → ${e.end.slice(0, 5)}` : null,
      reason: e.reason ?? null,
    }));
  const dates = Array.from({ length: 120 }, (_, i) => {
    const value = addDays(today, i);
    return { value, label: fullDateLabel(value, today) };
  });
  return { today, dates, blocks };
}

export default async function BlockPage() {
  const { today, dates, blocks } = await load();
  return (
    <BarberPage>
      <SettingsHeader title="Ma disponiblech" />
      <BlockForm today={today} dates={dates} blocks={blocks} />
    </BarberPage>
  );
}
