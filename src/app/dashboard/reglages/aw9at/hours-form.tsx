"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { StickyActions } from "@/components/ui/sticky-actions";
import { TimeSelect } from "@/components/ui/time-select";
import { Toggle } from "@/components/ui/toggle";
import { saveHours } from "@/lib/barber/settings-actions";
import { DARIJA_DAYS } from "@/lib/format";
import { SETTINGS_COPY, settingsError } from "@/lib/settings-copy";

type Interval = { start: string; end: string };
type Week = Record<number, Interval[]>;

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export function HoursForm({ initial }: { initial: { dayOfWeek: number; start: string; end: string }[] }) {
  const router = useRouter();
  const [week, setWeek] = useState<Week>(() => {
    const w: Week = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const h of initial) w[h.dayOfWeek]!.push({ start: h.start, end: h.end });
    return w;
  });
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string }>();
  const [pending, startTransition] = useTransition();

  const update = (day: number, intervals: Interval[]) => {
    setWeek((w) => ({ ...w, [day]: intervals }));
    setMessage(undefined);
  };

  const addInterval = (day: number) => {
    const list = week[day]!;
    const last = list.at(-1);
    const plusTwoHours = (t: string) => `${String(Math.min(Number(t.slice(0, 2)) + 2, 23)).padStart(2, "0")}${t.slice(2)}`;
    const next = last ? { start: last.end, end: last.end < "21:45" ? plusTwoHours(last.end) : "23:45" } : { start: "09:00", end: "13:00" };
    update(day, [...list, next]);
  };

  const save = () =>
    startTransition(async () => {
      const hours = ORDER.flatMap((d) => week[d]!.map((i) => ({ dayOfWeek: d, ...i })));
      const result = await saveHours(hours);
      if (result.ok) {
        setMessage({ tone: "info", text: SETTINGS_COPY.saved });
        router.refresh();
      } else setMessage({ tone: "error", text: settingsError(result.error) });
    });

  return (
    <>
      <ul className="mt-section flex flex-col gap-3 pb-4">
        {ORDER.map((day) => {
          const list = week[day]!;
          const open = list.length > 0;
          return (
            <li key={day} className="rounded-card bg-surface p-card">
              <div className="flex items-center justify-between">
                <span className="text-body font-semibold">{DARIJA_DAYS[day]}</span>
                <span className="flex items-center gap-3">
                  {!open && <span className="text-secondary text-muted">Ma khedamch</span>}
                  <Toggle
                    checked={open}
                    label={DARIJA_DAYS[day]!}
                    onChange={(next) => update(day, next ? [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "20:00" }] : [])}
                  />
                </span>
              </div>
              {open && (
                <div className="mt-3 flex flex-col gap-2">
                  {list.map((interval, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TimeSelect
                        aria-label={`${DARIJA_DAYS[day]} ${i + 1} — Mn`}
                        value={interval.start}
                        onChange={(e) => update(day, list.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                      />
                      <span className="text-muted" aria-hidden>
                        →
                      </span>
                      <TimeSelect
                        aria-label={`${DARIJA_DAYS[day]} ${i + 1} — Tal`}
                        value={interval.end}
                        onChange={(e) => update(day, list.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                      />
                      <button
                        type="button"
                        aria-label={SETTINGS_COPY.remove}
                        onClick={() => update(day, list.filter((_, j) => j !== i))}
                        className="grid size-12 shrink-0 place-items-center rounded-[12px] text-muted active:bg-surface-raised"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addInterval(day)} className="mt-1 flex h-10 items-center gap-1.5 self-start text-secondary text-gold">
                    <Plus width={16} height={16} />
                    Zid wa9t
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <StickyActions>
        <FormMessage message={message?.text} tone={message?.tone} />
        <Button loading={pending} onClick={save}>
          {SETTINGS_COPY.save}
        </Button>
      </StickyActions>
    </>
  );
}
