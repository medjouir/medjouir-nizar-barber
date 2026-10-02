"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateList, DateListSkeleton } from "@/components/booking/date-list";
import { StepHeader } from "@/components/booking/step-header";
import { AppointmentSummary } from "@/components/booking/summary";
import { TimeGrid, TimeGridSkeleton } from "@/components/booking/time-grid";
import { CalendarPlus, MapPin, SuccessMark } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { PageShell } from "@/components/ui/page-shell";
import { StickyActions } from "@/components/ui/sticky-actions";
import {
  cancelAppointment,
  fetchRescheduleDates,
  fetchRescheduleSlots,
  rescheduleAppointment,
  type DateChoice,
  type SlotChoice,
} from "@/lib/booking/actions";
import type { AppointmentStatus } from "@/lib/database.types";

type Details = { serviceName: string; duration: string; dateLabel: string; time: string };
type Barber = { slug: string; name: string; mapsUrl: string | null };

const COPY = {
  // Approved copy.
  slotTaken: "Had lwe9t mab9ach disponible.",
  serverError: "Ma9dernach nconfirmiw reservation. 3awed jereb.",
  // Proposed copy — pending review.
  confirmCancel: "Bghiti t annuler had rendez-vous?",
  yesCancel: "Ah, annuler",
  keep: "La, khlih",
  cancelled: "Had rendez-vous tannula.",
  past: "Had rendez-vous fat.",
};

export function ManageView(props: {
  token: string;
  justConfirmed: boolean;
  status: AppointmentStatus;
  changeable: boolean;
  barber: Barber;
  details: Details;
}) {
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  if (props.justConfirmed) return <Confirmation {...props} />;
  if (mode === "reschedule") return <Reschedule {...props} onClose={() => setMode("view")} />;
  return <Manage {...props} onReschedule={() => setMode("reschedule")} />;
}

function Confirmation({ token, barber, details }: { token: string; barber: Barber; details: Details }) {
  return (
    <PageShell className="animate-fade-in">
      <div className="flex flex-col items-center pt-12 text-center">
        <SuccessMark />
        <h1 className="mt-6 text-title font-semibold">Rendez-vous dyalk tconfirmat.</h1>
      </div>
      <AppointmentSummary
        className="mt-section"
        time={details.time}
        dateLabel={details.dateLabel}
        rows={[{ value: details.serviceName }, { value: `M3a ${barber.name}` }]}
      />
      <StickyActions>
        <ButtonLink href={`/manage/${token}/calendar`} download>
          <CalendarPlus width={20} height={20} />
          Zidha l calendrier
        </ButtonLink>
        {barber.mapsUrl && (
          <ButtonLink href={barber.mapsUrl} external variant="secondary">
            <MapPin width={18} height={18} />
            Chof localisation
          </ButtonLink>
        )}
        <ButtonLink href={`/manage/${token}`} variant="text">
          Gerer rendez-vous
        </ButtonLink>
      </StickyActions>
    </PageShell>
  );
}

function Manage({
  token,
  status,
  changeable,
  barber,
  details,
  onReschedule,
}: {
  token: string;
  status: AppointmentStatus;
  changeable: boolean;
  barber: Barber;
  details: Details;
  onReschedule: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelAppointment(token);
      if (result.ok) router.refresh();
      else setError(COPY.serverError);
      setConfirming(false);
    });

  return (
    <PageShell className="animate-fade-in">
      <h1 className="pt-8 text-title font-semibold">Rendez-vous dyalk</h1>
      <AppointmentSummary
        className={`mt-section ${status === "cancelled" ? "opacity-50" : ""}`}
        time={details.time}
        dateLabel={details.dateLabel}
        rows={[
          { value: <span className="flex justify-between"><span>{details.serviceName}</span><span className="text-muted">{details.duration}</span></span> },
          { value: `M3a ${barber.name}` },
        ]}
      />
      {status === "cancelled" && <p className="mt-5 text-body text-muted">{COPY.cancelled}</p>}
      {status !== "cancelled" && !changeable && <p className="mt-5 text-body text-muted">{COPY.past}</p>}
      <div className="mt-4">
        <FormMessage message={error} />
      </div>

      <StickyActions>
        {changeable && !confirming && (
          <>
            <Button onClick={onReschedule}>Bdel lwe9t</Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Annuler rendez-vous
            </Button>
          </>
        )}
        {changeable && confirming && (
          <div role="alertdialog" aria-labelledby="cancel-title" className="flex flex-col gap-3 rounded-card bg-surface p-card animate-fade-in">
            <p id="cancel-title" className="text-body font-medium">
              {COPY.confirmCancel}
            </p>
            <Button variant="danger" loading={pending} onClick={cancel}>
              {COPY.yesCancel}
            </Button>
            <Button variant="text" disabled={pending} onClick={() => setConfirming(false)}>
              {COPY.keep}
            </Button>
          </div>
        )}
        {status === "cancelled" && <ButtonLink href={`/${barber.slug}/7jez`}>7jez daba</ButtonLink>}
      </StickyActions>
    </PageShell>
  );
}

function Reschedule({ token, details, onClose }: { token: string; details: Details; onClose: () => void }) {
  const router = useRouter();
  const [dates, setDates] = useState<DateChoice[] | null>();
  const [date, setDate] = useState<string>();
  const [slots, setSlots] = useState<SlotChoice[] | null>();
  const [slot, setSlot] = useState<SlotChoice>();
  const [error, setError] = useState<string>();
  const [alternatives, setAlternatives] = useState<SlotChoice[]>();
  const [pending, startTransition] = useTransition();
  const submitted = useRef(false);

  useEffect(() => {
    fetchRescheduleDates(token).then(setDates);
  }, [token]);
  useEffect(() => {
    if (date) fetchRescheduleSlots(token, date).then(setSlots);
  }, [token, date]);

  const selectDate = (next: string | undefined) => {
    setSlots(undefined);
    setSlot(undefined);
    setError(undefined);
    setAlternatives(undefined);
    setDate(next);
  };

  const save = (target: SlotChoice) => {
    if (submitted.current) return;
    submitted.current = true;
    setError(undefined);
    startTransition(async () => {
      const result = await rescheduleAppointment(token, target.startAt);
      if (result.ok) {
        router.replace(`/manage/${token}?c=1`);
        router.refresh();
        return;
      }
      submitted.current = false;
      if (result.reason === "slot_taken") {
        setError(COPY.slotTaken);
        setAlternatives(result.alternatives);
        if (date) fetchRescheduleSlots(token, date).then(setSlots);
      } else setError(COPY.serverError);
    });
  };

  return (
    <PageShell>
      <StepHeader onBack={date ? () => selectDate(undefined) : onClose} />
      {!date ? (
        <div key="date" className="flex flex-1 flex-col animate-enter-forward">
          <h1 className="text-title font-semibold">Imta bghiti tji?</h1>
          <div className="mt-section pb-6">
            {dates === undefined ? (
              <DateListSkeleton />
            ) : dates === null ? (
              <FormMessage message={COPY.serverError} />
            ) : (
              <DateList options={dates} onSelect={selectDate} />
            )}
          </div>
        </div>
      ) : (
        <div key="time" className="flex flex-1 flex-col animate-enter-forward">
          {slots && slots.length === 0 ? (
            <>
              <h1 className="text-title font-semibold">Ma b9a 7ta wa9t had nhar.</h1>
              <p className="mt-3 text-body text-muted">Jereb nhar akhor.</p>
              <StickyActions>
                <Button onClick={() => selectDate(undefined)}>Chof nhar akhor</Button>
              </StickyActions>
            </>
          ) : (
            <>
              <h1 className="text-title font-semibold">Khtar lwe9t li ynasbek</h1>
              <p className="mt-3 text-body text-muted">Had l&apos;aw9at ba9yin disponible.</p>
              <p className="mt-2 text-secondary text-subtle">
                {details.serviceName} · {details.duration}
              </p>
              <div className="mt-6 pb-6">
                {slots === undefined ? (
                  <TimeGridSkeleton />
                ) : slots === null ? (
                  <FormMessage message={COPY.serverError} />
                ) : (
                  <TimeGrid slots={slots} selected={slot?.startAt} onSelect={setSlot} />
                )}
              </div>
              {error && (
                <div className="flex flex-col gap-3 pb-4">
                  <FormMessage message={error} />
                  {alternatives && alternatives.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {alternatives.map((a) => (
                        <button
                          key={a.startAt}
                          type="button"
                          onClick={() => save(a)}
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
                <Button disabled={!slot} loading={pending} onClick={() => slot && save(slot)}>
                  Kmel
                </Button>
              </StickyActions>
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}
