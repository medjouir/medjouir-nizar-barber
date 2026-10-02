"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { saveRules } from "@/lib/barber/settings-actions";
import { formatDuration } from "@/lib/format";
import { RULE_CHOICES } from "@/lib/settings";
import { SETTINGS_COPY, settingsError } from "@/lib/settings-copy";

type Rules = { slotIntervalMinutes: number; bufferMinutes: number; minimumNoticeMinutes: number; horizonDays: number };

// Proposed copy — pending review.
const LABELS: Record<keyof Rules, string> = {
  slotIntervalMinutes: "L'aw9at kol chhal (slot)",
  bufferMinutes: "Wa9t bin rendez-vous w lakhor",
  minimumNoticeMinutes: "A9al wa9t 9bel reservation",
  horizonDays: "Ch7al mn nhar l9eddam",
};

const minutes = (m: number) => (m === 0 ? "0 min" : formatDuration(m));

export function RulesForm({ initial }: { initial: Rules }) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string }>();
  const [pending, startTransition] = useTransition();

  const field = (key: keyof Rules, label: (v: number) => string) => (
    <SelectField
      label={LABELS[key]}
      name={key}
      value={rules[key]}
      onChange={(e) => {
        setRules((r) => ({ ...r, [key]: Number(e.target.value) }));
        setMessage(undefined);
      }}
      options={RULE_CHOICES[key].map((v) => ({ value: v, label: label(v) }))}
    />
  );

  return (
    <form
      className="mt-section flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveRules(rules);
          if (result.ok) {
            setMessage({ tone: "info", text: SETTINGS_COPY.saved });
            router.refresh();
          } else setMessage({ tone: "error", text: settingsError(result.error) });
        });
      }}
    >
      {field("slotIntervalMinutes", minutes)}
      {field("bufferMinutes", minutes)}
      {field("minimumNoticeMinutes", minutes)}
      {field("horizonDays", (d) => `${d} nhar`)}
      <FormMessage message={message?.text} tone={message?.tone} />
      <Button type="submit" loading={pending}>
        {SETTINGS_COPY.save}
      </Button>
    </form>
  );
}
