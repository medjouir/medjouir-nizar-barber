"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { TimeSelect } from "@/components/ui/time-select";
import { Toggle } from "@/components/ui/toggle";
import { addBlock, removeBlock } from "@/lib/barber/settings-actions";
import { SETTINGS_COPY, settingsError } from "@/lib/settings-copy";

type Block = { id: string; dateLabel: string; range: string | null; reason: string | null };

export function BlockForm({
  today,
  dates,
  blocks,
}: {
  today: string;
  /** Upcoming days with Darija labels ("Lyouma, 2 oct", "Tnin 5 oct"…). */
  dates: { value: string; label: string }[];
  blocks: Block[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [wholeDay, setWholeDay] = useState(false);
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("16:00");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string }>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await addBlock({ date, wholeDay, start, end, reason });
      if (result.ok) {
        setMessage({ tone: "info", text: SETTINGS_COPY.saved });
        setReason("");
        router.refresh();
      } else setMessage({ tone: "error", text: settingsError(result.error) });
    });
  };

  return (
    <>
      <form onSubmit={submit} noValidate className="mt-section flex flex-col gap-5">
        <SelectField label="Nhar" name="date" value={date} onChange={(e) => setDate(e.target.value)} options={dates} />

        <div className="flex items-center justify-between rounded-card bg-surface px-card py-3">
          <span className="text-body">Nhar kamel</span>
          <Toggle checked={wholeDay} onChange={setWholeDay} label="Nhar kamel" />
        </div>

        {!wholeDay && (
          <div className="grid grid-cols-2 gap-3 animate-fade-in">
            <label className="flex flex-col gap-2 text-secondary text-muted">
              Mn
              <TimeSelect name="start" value={start} onChange={(e) => setStart(e.target.value)} className="h-control bg-surface" />
            </label>
            <label className="flex flex-col gap-2 text-secondary text-muted">
              Tal
              <TimeSelect name="end" value={end} onChange={(e) => setEnd(e.target.value)} className="h-control bg-surface" />
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="reason" className="flex items-baseline justify-between text-secondary text-muted">
            3lach?<span className="text-subtle">Ikhtiyari</span>
          </label>
          <textarea
            id="reason"
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded-card border border-line bg-surface px-4 py-3 text-body text-fg transition-colors duration-200 focus:border-gold focus:outline-none"
          />
          <p className="text-secondary text-subtle">Had l&apos;information ghir nta li ghadi tchofha.</p>
        </div>

        <FormMessage message={message?.text} tone={message?.tone} />
        <Button type="submit" loading={pending}>
          Bloquer
        </Button>
      </form>

      {blocks.length > 0 && (
        <ul className="mt-section flex flex-col gap-2">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} />
          ))}
        </ul>
      )}
    </>
  );
}

function BlockRow({ block }: { block: Block }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 rounded-card border border-line bg-blocked p-card">
      <span className="min-w-0">
        <span className="block text-body font-medium">{block.dateLabel}</span>
        <span className="block text-secondary tabular-nums text-muted">{block.range ?? "Nhar kamel"}</span>
        {block.reason && <span className="block truncate text-secondary text-subtle">{block.reason}</span>}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeBlock(block.id);
            if (result.ok) router.refresh();
          })
        }
        className="h-10 shrink-0 rounded-full border border-line px-4 text-secondary text-muted active:bg-surface-raised disabled:opacity-50"
      >
        {SETTINGS_COPY.remove}
      </button>
    </li>
  );
}
