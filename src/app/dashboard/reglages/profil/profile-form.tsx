"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { saveProfile } from "@/lib/barber/settings-actions";
import { SETTINGS_COPY, settingsError } from "@/lib/settings-copy";

type Profile = {
  publicName: string;
  salonName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  mapsUrl: string | null;
};

// Proposed copy — pending review.
const LABELS = {
  publicName: "Smiya",
  salonName: "Smiyt salon",
  phone: "Numero telephone",
  address: "Adresse",
  city: "Mdina",
  mapsUrl: "Lien Google Maps",
};

export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ""])) as Record<keyof Profile, string>,
  );
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string }>();
  const [pending, startTransition] = useTransition();

  const input = (key: keyof Profile, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field
      label={LABELS[key]}
      name={key}
      value={form[key]}
      onChange={(e) => {
        setForm((f) => ({ ...f, [key]: e.target.value }));
        setMessage(undefined);
      }}
      {...props}
    />
  );

  return (
    <form
      className="mt-section flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveProfile(form);
          if (result.ok) {
            setMessage({ tone: "info", text: SETTINGS_COPY.saved });
            router.refresh();
          } else setMessage({ tone: "error", text: settingsError(result.error) });
        });
      }}
    >
      {input("publicName", { maxLength: 60, autoComplete: "name" })}
      {input("salonName", { maxLength: 80 })}
      {input("phone", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
      {input("address", { maxLength: 200, autoComplete: "street-address" })}
      {input("city", { maxLength: 80 })}
      {input("mapsUrl", { type: "url", inputMode: "url", placeholder: "https://maps.app.goo.gl/…" })}
      <FormMessage message={message?.text} tone={message?.tone} />
      <Button type="submit" loading={pending}>
        {SETTINGS_COPY.save}
      </Button>
    </form>
  );
}
