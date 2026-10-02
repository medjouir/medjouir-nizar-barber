"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ContactActions } from "@/components/barber/contact-actions";
import { DateList, DateListSkeleton } from "@/components/booking/date-list";
import { TimeGrid, TimeGridSkeleton } from "@/components/booking/time-grid";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { cancelAsBarber, fetchMoveDates, fetchMoveSlots, markAppointment, moveAsBarber } from "@/lib/barber/actions";
import type { DateChoice, SlotChoice } from "@/lib/booking/choices";
import { formatMoroccanPhone } from "@/lib/phone";
import { STATUS_LABEL, type PlanItem } from "./planning-view";

const COPY = {
  // Approved copy.
  slotTaken: "Had lwe9t mab9ach disponible.",
  confirmCancel: "Bghiti t annuler had rendez-vous?",
  yesCancel: "Ah, annuler",
  keep: "La, khlih",
  noSlots: "Ma b9a 7ta wa9t had nhar.",
  // Proposed copy — pending review.
  error: "Ma9dernach. 3awed jereb.",
  close: "Sedd",
};

/** Appointment details as a mobile bottom sheet. */
export function AppointmentSheet({ item, onClose }: { item: PlanItem; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"details" | "confirm-cancel" | "move">("details");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const run = (action: () => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (result.ok) {
        router.refresh();
        onClose();
      } else setError(COPY.error);
    });

  const confirmed = item.status === "confirmed";
  const status = STATUS_LABEL[item.status];

  // Portal to <body>: the page's animated container would otherwise trap the
  // sheet below the fixed bottom navigation.
  return createPortal(
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label={COPY.close} onClick={onClose} className="absolute inset-0 bg-black/70 animate-fade-in" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-md overflow-y-auto rounded-t-[24px] bg-surface px-page pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3 outline-none animate-sheet-up"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" aria-hidden />

        {mode === "move" ? (
          <MoveAppointment item={item} onDone={() => (router.refresh(), onClose())} onBack={() => setMode("details")} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="sheet-title" className="text-section font-semibold">
                  {item.clientName}
                </h2>
                {item.clientPhone && <p className="mt-1 text-body tabular-nums text-muted">{formatMoroccanPhone(item.clientPhone)}</p>}
              </div>
              {status && <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[12px] text-muted">{status}</span>}
            </div>
            <div className="mt-4">
              <ContactActions phone={item.clientPhone} />
            </div>

            <div className="mt-5 rounded-card bg-canvas/60 p-card">
              <p className="text-time font-semibold tabular-nums text-gold">
                {item.start} <span className="text-muted">→</span> {item.end}
              </p>
              <p className="mt-2 text-body">{item.dateLabel}</p>
              <p className="mt-1 text-body text-muted">
                {item.serviceName} · {item.duration}
              </p>
              {item.note && <p className="mt-4 border-t border-line pt-3 text-body text-fg">{item.note}</p>}
            </div>

            <div className="mt-3">
              <FormMessage message={error} />
            </div>

            {confirmed && mode === "details" && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button loading={pending} onClick={() => run(() => markAppointment(item.id, "completed"))}>
                    Tsalat
                  </Button>
                  <Button variant="secondary" disabled={pending} onClick={() => run(() => markAppointment(item.id, "no_show"))}>
                    Client ma jach
                  </Button>
                </div>
                <Button variant="secondary" disabled={pending} onClick={() => setMode("move")}>
                  Bdel rendez-vous
                </Button>
                <Button variant="danger" disabled={pending} onClick={() => setMode("confirm-cancel")}>
                  Annuler
                </Button>
              </div>
            )}

            {confirmed && mode === "confirm-cancel" && (
              <div role="alertdialog" aria-labelledby="cancel-q" className="mt-3 flex flex-col gap-2 animate-fade-in">
                <p id="cancel-q" className="text-body font-medium">
                  {COPY.confirmCancel}
                </p>
                <Button variant="danger" loading={pending} onClick={() => run(() => cancelAsBarber(item.id))}>
                  {COPY.yesCancel}
                </Button>
                <Button variant="text" disabled={pending} onClick={() => setMode("details")}>
                  {COPY.keep}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function MoveAppointment({ item, onDone, onBack }: { item: PlanItem; onDone: () => void; onBack: () => void }) {
  const [dates, setDates] = useState<DateChoice[] | null>();
  const [date, setDate] = useState<string>();
  const [slots, setSlots] = useState<SlotChoice[] | null>();
  const [slot, setSlot] = useState<SlotChoice>();
  const [error, setError] = useState<string>();
  const [alternatives, setAlternatives] = useState<SlotChoice[]>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchMoveDates(item.id).then(setDates);
  }, [item.id]);
  useEffect(() => {
    if (date) fetchMoveSlots(item.id, date).then(setSlots);
  }, [item.id, date]);

  const pickDate = (d: string) => {
    setDate(d);
    setSlots(undefined);
    setSlot(undefined);
    setError(undefined);
    setAlternatives(undefined);
  };

  const save = (target: SlotChoice) =>
    startTransition(async () => {
      setError(undefined);
      const result = await moveAsBarber(item.id, target.startAt);
      if (result.ok) return onDone();
      if (result.reason === "slot_taken") {
        setError(COPY.slotTaken);
        setAlternatives(result.alternatives);
      } else setError(COPY.error);
    });

  return (
    <div className="animate-fade-in">
      <h2 id="sheet-title" className="text-section font-semibold">
        Bdel rendez-vous
      </h2>
      <p className="mt-1 text-secondary text-muted">
        {item.clientName} · {item.serviceName} · {item.duration}
      </p>
      <div className="mt-5">
        {dates === undefined ? <DateListSkeleton /> : dates === null ? <FormMessage message={COPY.error} /> : <DateList options={dates} selected={date} onSelect={pickDate} />}
      </div>
      {date && (
        <div className="mt-5">
          {slots === undefined ? (
            <TimeGridSkeleton />
          ) : !slots || slots.length === 0 ? (
            <p className="text-body text-muted">{COPY.noSlots}</p>
          ) : (
            <TimeGrid slots={slots} selected={slot?.startAt} onSelect={setSlot} />
          )}
        </div>
      )}
      {error && (
        <div className="mt-4 flex flex-col gap-3">
          <FormMessage message={error} />
          {alternatives && alternatives.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {alternatives.map((a) => (
                <button key={a.startAt} type="button" onClick={() => save(a)} className="flex h-14 flex-col items-center justify-center rounded-card bg-canvas/60 active:bg-surface-raised">
                  <span className="text-body font-medium tabular-nums">{a.time}</span>
                  <span className="text-[11px] text-muted">{a.dateLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2">
        <Button disabled={!slot} loading={pending} onClick={() => slot && save(slot)}>
          Kmel
        </Button>
        <Button variant="text" disabled={pending} onClick={onBack}>
          {COPY.keep}
        </Button>
      </div>
    </div>
  );
}
