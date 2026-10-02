"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChoiceCard } from "@/components/booking/choice-card";
import { DateList, DateListSkeleton } from "@/components/booking/date-list";
import { StepHeader } from "@/components/booking/step-header";
import { AppointmentSummary, ContextChips } from "@/components/booking/summary";
import { TimeGrid, TimeGridSkeleton } from "@/components/booking/time-grid";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { PageShell } from "@/components/ui/page-shell";
import { StickyActions } from "@/components/ui/sticky-actions";
import {
  fetchDateOptions,
  fetchSlots,
  submitBooking,
  type DateChoice,
  type SlotChoice,
} from "@/lib/booking/actions";
import { formatDuration } from "@/lib/format";
import { formatMoroccanPhone, normalizeMoroccanPhone } from "@/lib/phone";

type Service = { id: string; name: string; durationMinutes: number };
type Step = "service" | "date" | "time" | "info" | "review";
const STEPS: Step[] = ["service", "date", "time", "info", "review"];

const COPY = {
  // Approved copy.
  slotTaken: "Had lwe9t mab9ach disponible.",
  serverError: "Ma9dernach nconfirmiw reservation. 3awed jereb.",
  // Proposed copy — pending review.
  nameRequired: "Ktb smitk.",
  phoneInvalid: "Numero machi s7i7.",
};

export function BookingFlow({ slug, barberName, services }: { slug: string; barberName: string; services: Service[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = (params.get("step") as Step | null) ?? "service";

  const [serviceId, setServiceId] = useState<string>();
  const [dates, setDates] = useState<Record<string, DateChoice[] | null>>({});
  const [date, setDate] = useState<string>();
  const [slots, setSlots] = useState<Record<string, SlotChoice[] | null>>({});
  const [slot, setSlot] = useState<SlotChoice>();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [infoErrors, setInfoErrors] = useState<{ name?: string; phone?: string }>({});

  const service = services.find((s) => s.id === serviceId);
  const normalizedPhone = normalizeMoroccanPhone(phone);

  // The URL drives the step (browser back works); missing prerequisites fall back.
  const ready: Record<Step, boolean> = {
    service: true,
    date: Boolean(service),
    time: Boolean(service && date),
    info: Boolean(service && slot),
    review: Boolean(service && slot && fullName.trim() && normalizedPhone),
  };
  const step = STEPS.includes(requested) && ready[requested] ? requested : (STEPS.findLast((s, i) => i <= STEPS.indexOf(requested) && ready[s]) ?? "service");

  useEffect(() => {
    if (step !== requested) window.history.replaceState(null, "", step === "service" ? window.location.pathname : `?step=${step}`);
  }, [step, requested]);

  // Slide forward or back depending on where the step moved (derived state).
  const [shownStep, setShownStep] = useState(step);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  if (shownStep !== step) {
    setDirection(STEPS.indexOf(step) >= STEPS.indexOf(shownStep) ? "forward" : "back");
    setShownStep(step);
  }

  const go = useCallback((next: Step) => window.history.pushState(null, "", `?step=${next}`), []);
  const back = () => (step === "service" ? router.push(`/${slug}`) : window.history.back());

  // Data loading per selection.
  const dateKey = serviceId ?? "";
  const slotKey = `${serviceId}|${date}`;
  useEffect(() => {
    if (step !== "date" || !serviceId || dateKey in dates) return;
    fetchDateOptions(slug, serviceId).then((d) => setDates((m) => ({ ...m, [dateKey]: d })));
  }, [step, serviceId, dateKey, dates, slug]);
  useEffect(() => {
    if (step !== "time" || !serviceId || !date || slotKey in slots) return;
    fetchSlots(slug, serviceId, date).then((s) => setSlots((m) => ({ ...m, [slotKey]: s })));
  }, [step, serviceId, date, slotKey, slots, slug]);

  const refreshAvailability = () => {
    setDates({});
    setSlots({});
  };

  // Move focus to the new screen title for screen readers.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), [step]);
  const title = (text: string) => (
    <h1 ref={titleRef} tabIndex={-1} className="text-title font-semibold outline-none">
      {text}
    </h1>
  );

  let body: ReactNode;

  if (step === "service") {
    body = (
      <>
        {title("Chno bghiti dir?")}
        <div className="mt-section flex flex-col gap-3">
          {services.map((s) => (
            <ChoiceCard
              key={s.id}
              selected={s.id === serviceId}
              onSelect={() => {
                if (s.id !== serviceId) {
                  setServiceId(s.id);
                  setDate(undefined);
                  setSlot(undefined);
                }
              }}
              className="h-20"
            >
              <span className="flex flex-col">
                <span className="text-section font-semibold">{s.name}</span>
                <span className="text-secondary text-muted">{formatDuration(s.durationMinutes)}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
        <StickyActions>
          <Button disabled={!service} onClick={() => go("date")}>
            Kmel
          </Button>
        </StickyActions>
      </>
    );
  } else if (step === "date") {
    const options = dates[dateKey];
    body = (
      <>
        {title("Imta bghiti tji?")}
        <div className="mt-section pb-6">
          {options === undefined ? (
            <DateListSkeleton />
          ) : options === null ? (
            <FormMessage message={COPY.serverError} />
          ) : (
            <DateList
              options={options}
              selected={date}
              onSelect={(d) => {
                if (d !== date) setSlot(undefined);
                setDate(d);
                go("time");
              }}
            />
          )}
        </div>
      </>
    );
  } else if (step === "time") {
    const list = slots[slotKey];
    const dateChoice = dates[dateKey]?.find((d) => d.date === date);
    const dateLabel = dateChoice ? `${dateChoice.name} ${dateChoice.short}` : "";
    body =
      list && list.length === 0 ? (
        <>
          {title("Ma b9a 7ta wa9t had nhar.")}
          <p className="mt-3 text-body text-muted">Jereb nhar akhor.</p>
          <StickyActions>
            <Button
              onClick={() => {
                refreshAvailability();
                window.history.back();
              }}
            >
              Chof nhar akhor
            </Button>
          </StickyActions>
        </>
      ) : (
        <>
          {title("Khtar lwe9t li ynasbek")}
          <p className="mt-3 text-body text-muted">Had l&apos;aw9at ba9yin disponible.</p>
          <div className="mt-5">
            <ContextChips items={[dateLabel, service!.name, formatDuration(service!.durationMinutes)].filter(Boolean)} />
          </div>
          <div className="mt-6 pb-6">
            {list === undefined ? (
              <TimeGridSkeleton />
            ) : list === null ? (
              <FormMessage message={COPY.serverError} />
            ) : (
              <TimeGrid slots={list} selected={slot?.startAt} onSelect={setSlot} />
            )}
          </div>
          <StickyActions>
            <Button disabled={!slot} onClick={() => go("info")}>
              Kmel
            </Button>
          </StickyActions>
        </>
      );
  } else if (step === "info") {
    const submitInfo = (e: React.FormEvent) => {
      e.preventDefault();
      const errors = {
        name: fullName.trim() ? undefined : COPY.nameRequired,
        phone: normalizedPhone ? undefined : COPY.phoneInvalid,
      };
      setInfoErrors(errors);
      if (!errors.name && !errors.phone) go("review");
    };
    body = (
      <form onSubmit={submitInfo} noValidate className="flex flex-1 flex-col">
        {title("B9a ghir n3rfo chkoun nta.")}
        <div className="mt-section flex flex-col gap-5 pb-6">
          <Field
            label="Smitk"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={80}
            value={fullName}
            error={infoErrors.name}
            onChange={(e) => {
              setFullName(e.target.value);
              setInfoErrors((x) => ({ ...x, name: undefined }));
            }}
          />
          <Field
            label="Numero telephone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
            value={phone}
            error={infoErrors.phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setInfoErrors((x) => ({ ...x, phone: undefined }));
            }}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="note" className="flex items-baseline justify-between text-secondary text-muted">
              Chi note l {barberName}?<span className="text-subtle">Ikhtiyari</span>
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-card border border-line bg-surface px-4 py-3 text-body text-fg transition-colors duration-200 focus:border-gold focus:outline-none"
            />
          </div>
        </div>
        <StickyActions>
          <Button type="submit">Chof reservation</Button>
        </StickyActions>
      </form>
    );
  } else {
    body = (
      <ReviewStep
        title={title("Kolchi mzyan?")}
        slug={slug}
        barberName={barberName}
        service={service!}
        slot={slot!}
        fullName={fullName.trim()}
        phone={normalizedPhone!}
        note={note}
        onChangeSlot={setSlot}
        onEdit={() => go("service")}
        onInvalidInfo={(field) => {
          setInfoErrors(field === "name" ? { name: COPY.nameRequired } : { phone: COPY.phoneInvalid });
          go("info");
        }}
        onTaken={refreshAvailability}
        onBooked={(token) => router.replace(`/manage/${token}?c=1`)}
      />
    );
  }

  return (
    <PageShell>
      <StepHeader progress={(STEPS.indexOf(step) + 1) / STEPS.length} onBack={back} />
      <div key={step} className={`flex flex-1 flex-col ${direction === "forward" ? "animate-enter-forward" : "animate-enter-back"}`}>
        {body}
      </div>
    </PageShell>
  );
}

function ReviewStep(props: {
  title: ReactNode;
  slug: string;
  barberName: string;
  service: Service;
  slot: SlotChoice;
  fullName: string;
  phone: string;
  note: string;
  onChangeSlot: (slot: SlotChoice) => void;
  onEdit: () => void;
  onInvalidInfo: (field: "name" | "phone") => void;
  onTaken: () => void;
  onBooked: (token: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [alternatives, setAlternatives] = useState<SlotChoice[]>();
  const submitted = useRef(false);

  const confirm = () => {
    if (submitted.current) return; // guard against double taps
    submitted.current = true;
    setError(undefined);
    startTransition(async () => {
      const result = await submitBooking({
        slug: props.slug,
        serviceId: props.service.id,
        startAt: props.slot.startAt,
        fullName: props.fullName,
        phone: props.phone,
        note: props.note,
      });
      if (result.ok) {
        props.onBooked(result.token);
        return; // keep the button busy while navigating
      }
      submitted.current = false;
      if (result.reason === "slot_taken") {
        props.onTaken();
        setAlternatives(result.alternatives);
        setError(COPY.slotTaken);
      } else if (result.reason === "invalid_name" || result.reason === "invalid_phone") {
        props.onInvalidInfo(result.reason === "invalid_name" ? "name" : "phone");
      } else {
        setError(COPY.serverError);
      }
    });
  };

  return (
    <>
      {props.title}
      <AppointmentSummary
        className="mt-section"
        time={props.slot.time}
        dateLabel={props.slot.dateLabel}
        rows={[
          { value: <span className="flex justify-between"><span>{props.service.name}</span><span className="text-muted">{formatDuration(props.service.durationMinutes)}</span></span> },
          { value: `M3a ${props.barberName}` },
          { value: <span className="flex justify-between gap-4"><span>{props.fullName}</span><span className="text-muted tabular-nums">{formatMoroccanPhone(props.phone)}</span></span> },
        ]}
      />

      {error && (
        <div className="mt-5 flex flex-col gap-3">
          <FormMessage message={error} />
          {alternatives && alternatives.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {alternatives.map((a) => (
                <button
                  key={a.startAt}
                  type="button"
                  onClick={() => {
                    props.onChangeSlot(a);
                    setAlternatives(undefined);
                    setError(undefined);
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

      <StickyActions>
        <Button loading={pending} disabled={Boolean(alternatives)} onClick={confirm}>
          T2ked reservation
        </Button>
        <Button variant="text" disabled={pending} onClick={props.onEdit}>
          Bdel chi haja
        </Button>
      </StickyActions>
    </>
  );
}
