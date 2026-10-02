"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { Toggle } from "@/components/ui/toggle";
import { saveService } from "@/lib/barber/settings-actions";
import { formatDuration } from "@/lib/format";
import { DURATION_CHOICES } from "@/lib/settings";
import { SETTINGS_COPY, settingsError } from "@/lib/settings-copy";

type Service = { id: string; name: string; durationMinutes: number; active: boolean };

// Proposed copy — pending review.
const LABELS = { name: "Smiya", duration: "Lmodda", active: "Disponible", edit: "Bdel" };

export function ServicesForm({ services }: { services: Service[] }) {
  return (
    <ul className="mt-section flex flex-col gap-3">
      {services.map((s) => (
        <ServiceRow key={s.id} service={s} />
      ))}
    </ul>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(service.durationMinutes);
  const [active, setActive] = useState(service.active);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string }>();
  const [pending, startTransition] = useTransition();

  const save = (next: Service) =>
    startTransition(async () => {
      const result = await saveService(service.id, next);
      if (result.ok) {
        setMessage({ tone: "info", text: SETTINGS_COPY.saved });
        setEditing(false);
        router.refresh();
      } else setMessage({ tone: "error", text: settingsError(result.error) });
    });

  const durations = Array.from(new Set([...DURATION_CHOICES, service.durationMinutes])).sort((a, b) => a - b);

  return (
    <li className={`rounded-card bg-surface p-card transition-opacity duration-200 ${active ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => setEditing((e) => !e)} className="min-w-0 flex-1 text-left" aria-expanded={editing}>
          <span className="block truncate text-body font-semibold">{service.name}</span>
          <span className="block text-secondary text-muted">{formatDuration(service.durationMinutes)}</span>
        </button>
        <Toggle
          checked={active}
          label={`${LABELS.active}: ${service.name}`}
          disabled={pending}
          onChange={(next) => {
            setActive(next);
            save({ ...service, active: next });
          }}
        />
      </div>

      {!editing && (
        <button type="button" onClick={() => setEditing(true)} className="mt-2 text-secondary text-gold">
          {LABELS.edit}
        </button>
      )}

      {editing && (
        <form
          className="mt-4 flex flex-col gap-4 animate-fade-in"
          onSubmit={(e) => {
            e.preventDefault();
            save({ id: service.id, name, durationMinutes: duration, active });
          }}
        >
          <Field label={LABELS.name} name={`name-${service.id}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <SelectField
            label={LABELS.duration}
            name={`duration-${service.id}`}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            options={durations.map((d) => ({ value: d, label: formatDuration(d) }))}
          />
          <Button type="submit" loading={pending}>
            {SETTINGS_COPY.save}
          </Button>
        </form>
      )}
      {message && (
        <div className="mt-3">
          <FormMessage message={message.text} tone={message.tone} />
        </div>
      )}
    </li>
  );
}
