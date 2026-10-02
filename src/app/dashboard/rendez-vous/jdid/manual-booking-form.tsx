"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarberPage } from "@/components/barber/barber-page";
import { ChoiceCard } from "@/components/booking/choice-card";
import { DateList, DateListSkeleton } from "@/components/booking/date-list";
import { StepHeader } from "@/components/booking/step-header";
import { TimeGrid, TimeGridSkeleton } from "@/components/booking/time-grid";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { createManualAppointment, fetchManualDates, fetchManualSlots } from "@/lib/barber/actions";
import type { DateChoice, SlotChoice } from "@/lib/booking/choices";
import { formatDuration } from "@/lib/format";
import { normalizeMoroccanPhone } from "@/lib/phone";

type Service = { id: string; name: string; durationMinutes: number };

const COPY = {
  // Approved copy.
  slotTaken: "Had lwe9t mab9ach disponible.",
  phoneInvalid: "Numero machi s7i7.",
  // Proposed copy — pending review.
  title: "Rendez-vous jdid",
  day: "Nhar",
  time: "Lwe9t",
  client: "Client",
  clientName: "Smit l client",
  nameRequired: "Ktb smit l client.",
  note: "Note",
  noSlots: "Ma b9a 7ta wa9t had nhar.",
  submit: "Zid rendez-vous",
  error: "Ma9dernach nzido rendez-vous. 3awed jereb.",
};

export function ManualBookingForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState<string>();
  const [dates, setDates] = useState<DateChoice[] | null>();
  const [date, setDate] = useState<string>();
  const [slots, setSlots] = useState<SlotChoice[] | null>();
  const [slot, setSlot] = useState<SlotChoice>();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [alternatives, setAlternatives] = useState<SlotChoice[]>();
  const [pending, startTransition] = useTransition();
  const submitted = useRef(false);

  useEffect(() => {
    if (serviceId) fetchManualDates(serviceId).then(setDates);
  }, [serviceId]);
  useEffect(() => {
    if (serviceId && date) fetchManualSlots(serviceId, date).then(setSlots);
  }, [serviceId, date]);

  const chooseService = (id: string) => {
    if (id === serviceId) return;
    setServiceId(id);
    setDates(undefined);
    setDate(undefined);
    setSlots(undefined);
    setSlot(undefined);
  };
  const chooseDate = (d: string) => {
    setDate(d);
    setSlots(undefined);
    setSlot(undefined);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !slot || submitted.current) return;
    const next = {
      name: fullName.trim() ? undefined : COPY.nameRequired,
      phone: normalizeMoroccanPhone(phone) ? undefined : COPY.phoneInvalid,
    };
    setErrors(next);
    if (next.name || next.phone) return;

    submitted.current = true;
    startTransition(async () => {
      const result = await createManualAppointment({ serviceId, startAt: slot.startAt, fullName, phone, note });
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      submitted.current = false;
      if (result.reason === "slot_taken") {
        setAlternatives(result.alternatives);
        setErrors({ form: COPY.slotTaken });
        if (date) fetchManualSlots(serviceId, date).then(setSlots);
      } else if (result.reason === "invalid_name") setErrors({ name: COPY.nameRequired });
      else if (result.reason === "invalid_phone") setErrors({ phone: COPY.phoneInvalid });
      else setErrors({ form: COPY.error });
    });
  };

  const sectionTitle = "text-section font-semibold";

  return (
    <BarberPage>
      <StepHeader onBack={() => router.push("/dashboard")} />
      <h1 className="text-title font-semibold">{COPY.title}</h1>

      <form onSubmit={submit} noValidate className="flex flex-col">
        <section className="mt-section flex flex-col gap-3">
          <h2 className={sectionTitle}>Services</h2>
          {services.map((s) => (
            <ChoiceCard key={s.id} selected={s.id === serviceId} onSelect={() => chooseService(s.id)} className="h-16">
              <span className="flex w-full items-baseline justify-between pr-8">
                <span className="text-body font-semibold">{s.name}</span>
                <span className="text-secondary text-muted">{formatDuration(s.durationMinutes)}</span>
              </span>
            </ChoiceCard>
          ))}
        </section>

        {serviceId && (
          <section className="mt-section animate-fade-in">
            <h2 className={`${sectionTitle} mb-3`}>{COPY.day}</h2>
            {dates === undefined ? <DateListSkeleton /> : dates === null ? <FormMessage message={COPY.error} /> : <DateList options={dates} selected={date} onSelect={chooseDate} />}
          </section>
        )}

        {serviceId && date && (
          <section className="mt-section animate-fade-in">
            <h2 className={`${sectionTitle} mb-3`}>{COPY.time}</h2>
            {slots === undefined ? (
              <TimeGridSkeleton />
            ) : !slots || slots.length === 0 ? (
              <p className="text-body text-muted">{COPY.noSlots}</p>
            ) : (
              <TimeGrid slots={slots} selected={slot?.startAt} onSelect={setSlot} />
            )}
          </section>
        )}

        {slot && (
          <section className="mt-section flex flex-col gap-5 animate-fade-in">
            <h2 className={sectionTitle}>{COPY.client}</h2>
            <Field
              label={COPY.clientName}
              name="name"
              autoComplete="off"
              autoCapitalize="words"
              maxLength={80}
              value={fullName}
              error={errors.name}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrors((x) => ({ ...x, name: undefined }));
              }}
            />
            <Field
              label="Numero telephone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="06 12 34 56 78"
              value={phone}
              error={errors.phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((x) => ({ ...x, phone: undefined }));
              }}
            />
            <div className="flex flex-col gap-2">
              <label htmlFor="note" className="flex items-baseline justify-between text-secondary text-muted">
                {COPY.note}
                <span className="text-subtle">Ikhtiyari</span>
              </label>
              <textarea
                id="note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full resize-none rounded-card border border-line bg-surface px-4 py-3 text-body text-fg transition-colors duration-200 focus:border-gold focus:outline-none"
              />
            </div>

            {errors.form && (
              <div className="flex flex-col gap-3">
                <FormMessage message={errors.form} />
                {alternatives && alternatives.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {alternatives.map((a) => (
                      <button
                        key={a.startAt}
                        type="button"
                        onClick={() => {
                          setSlot(a);
                          setDate(a.date);
                          setAlternatives(undefined);
                          setErrors({});
                        }}
                        className="flex h-16 flex-col items-center justify-center rounded-card bg-surface active:bg-surface-raised"
                      >
                        <span className="text-body font-medium tabular-nums">{a.time}</span>
                        <span className="text-secondary text-muted">{a.dateLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button type="submit" loading={pending} className="mt-2">
              {COPY.submit}
            </Button>
          </section>
        )}
      </form>
    </BarberPage>
  );
}
