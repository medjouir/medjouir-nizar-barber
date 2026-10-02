# Architecture & key decisions

## Data model

See `supabase/migrations/`. Tables: `barbers`, `services`, `business_hours`,
`schedule_exceptions`, `clients`, `appointments`. No price columns (V0.1).

- Times: `appointments.start_at/end_at` are `timestamptz` (absolute instants).
  `business_hours` and `schedule_exceptions` hold wall-clock `time`/`date`
  values interpreted in `barbers.timezone` (`Africa/Casablanca`). No UTC offset
  is ever hardcoded — Morocco's offset changes around Ramadan.
- `day_of_week`: 0 = Sunday … 6 = Saturday.
- Several `business_hours` rows per day are allowed (split days); active
  intervals of the same day cannot overlap (exclusion constraint).
- `schedule_exceptions`: `closed` = whole day off; `blocked` = private
  unavailability (whole day when times are null); `available` = extra opening
  with times. `reason` is private.
- `clients` are unique per `(barber_id, phone)`; phones are stored normalized
  in E.164 (`+2126…`). Booking with a known phone reuses the client.
- `appointments.duration_snapshot` freezes the service duration at booking time,
  and a CHECK keeps `end_at = start_at + duration_snapshot`.
- Composite foreign keys guarantee an appointment's client and service belong to
  the same barber as the appointment.
- `public_token`: 256 random bits (64 hex chars) from `gen_random_bytes`, unique.
  Used only for `/manage/[token]`; ids are UUIDs and never exposed publicly.
- Appointments and clients are never hard-deleted. Cancelling sets
  `status = 'cancelled'` and `cancelled_at`.

## Availability engine

`src/lib/scheduling/availability.ts` is pure and I/O-free. For a barber, service
and date it offers start times on the slot grid (multiples of
`slot_interval_minutes` from local midnight) where:

1. the whole service fits inside one open window — regular hours plus
   `available` exceptions, minus `blocked` intervals; `closed` (or a whole-day
   block) removes the day;
2. it keeps `buffer_minutes` of clearance before and after every confirmed or
   completed appointment;
3. it starts at least `minimum_booking_notice_minutes` after now;
4. its date is between today and today + `booking_horizon_days` − 1.

Wall-clock values are converted with `Intl` (`src/lib/scheduling/time.ts`)
using the runtime's IANA tz data — no offset is ever hardcoded. This matters:
tzdata 2026c records Morocco's move from GMT+1 (with Ramadan GMT+0) to
permanent GMT+0 on 2026-09-20. Older runtimes (e.g. Node 22 with tzdata 2025b)
still apply GMT+1, so production must run a current Node (24.x, pinned in
`.nvmrc` and `engines`), and Node should be kept updated to receive tz changes. Rescheduling passes `excludeAppointmentId` so an appointment never
collides with itself and keeps its original duration.

`src/lib/booking/service.ts` wraps the engine for the use cases (create,
reschedule, cancel, token lookup) behind a `BookingStore` interface. Every write
recomputes availability server-side first; when the slot is gone the client gets
"Had lwe9t mab9ach disponible." with the nearest alternatives.

## Double-booking protection

1. **Database guarantee (always on).** `appointments_no_overlap` is a GiST
   exclusion constraint on `(barber_id, tstzrange(start_at, end_at, '[)'))` for
   rows with status `confirmed` or `completed`. PostgreSQL rejects any
   overlapping pair atomically, even for simultaneous transactions, whatever the
   application code does. Cancelled and no-show rows don't occupy time, so a
   cancellation immediately reopens the slot. `[)` lets back-to-back
   appointments (10:00–11:00, 11:00–12:00) coexist.
2. **Server-side recheck.** On confirmation the server recomputes availability
   (hours, exceptions, buffer, notice, horizon) and only then inserts. With
   Supabase this runs in one transaction serialized per barber. If the constraint still
   fires (lost race), the client gets "Had lwe9t mab9ach disponible." with
   nearby alternatives.

The frontend's availability state is never trusted.

## Security

- **RLS on every table.** `anon` has no table privileges at all. Public booking
  reads and writes run on the Next.js server, which validates input and uses
  the service-role key (server-only, never `NEXT_PUBLIC_`) with narrowly scoped
  queries. Public responses never include clients, other appointments or
  exception reasons.
- **Authenticated** users only see rows of the barber they own
  (`barbers.user_id = auth.uid()`, via `private.owns_barber`). A signed-in
  stranger sees nothing.
- Nizar can update only non-identity barber columns (not `user_id`, `slug`,
  `email`, `timezone`) and cannot delete appointments or clients.
- **Owner linking.** A confirmed auth user whose email equals `barbers.email`
  becomes the owner (trigger on `auth.users`). Unconfirmed sign-ups never link.
- **Barber routes.** `src/proxy.ts` refreshes the session and sends signed-out
  visitors from `/dashboard/*` to `/login` (optimistic). The authoritative check
  is `requireBarber()` in `src/app/dashboard/layout.tsx` (revalidates the user
  with Supabase and requires an owned barber row), backed by RLS.
- Sign-in returns the same generic error for wrong credentials and for accounts
  that don't own a barber. Password reset always answers the same way.
- `/auth/confirm` only redirects to same-site relative paths. Sign-out is POST-only.

## Booking settings defaults

`slot_interval_minutes` 15, `buffer_minutes` 0, `minimum_booking_notice_minutes`
30, `booking_horizon_days` 30 — stored per barber, editable later.
