-- Nizar Barber Booking — core schema (V0.1).
-- No price columns on purpose: V0.1 has no prices or payments.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.appointment_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');

-- available = extra opening on a date, blocked = private unavailability,
-- closed = whole day off.
create type public.schedule_exception_type as enum ('available', 'blocked', 'closed');

-- Wall-clock time range, used to forbid overlapping business-hour intervals.
create type public.timerange as range (subtype = time);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Rejects unknown IANA timezone names (a CHECK cannot do this: not immutable).
create function private.validate_timezone() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception when others then
  raise exception 'Invalid timezone: %', new.timezone using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- barbers
-- ---------------------------------------------------------------------------

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  public_name text not null check (char_length(public_name) between 1 and 60),
  salon_name text check (char_length(salon_name) <= 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    -- Top-level app routes that a public slug must never shadow.
    check (slug not in ('login', 'dashboard', 'manage', 'auth', 'api')),
  email text not null unique check (email = lower(email)),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_url text,
  address text,
  city text,
  maps_url text,
  timezone text not null default 'Africa/Casablanca',
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 120),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 120),
  minimum_booking_notice_minutes integer not null default 30 check (minimum_booking_notice_minutes between 0 and 10080),
  booking_horizon_days integer not null default 30 check (booking_horizon_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger barbers_set_updated_at before update on public.barbers
  for each row execute function private.set_updated_at();
create trigger barbers_validate_timezone before insert or update of timezone on public.barbers
  for each row execute function private.validate_timezone();

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite FK from appointments (same-barber guarantee).
  unique (id, barber_id)
);

create index services_barber_order_idx on public.services (barber_id, display_order);
create trigger services_set_updated_at before update on public.services
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- business_hours — several intervals per day allowed (e.g. 09–13 and 14–20)
-- ---------------------------------------------------------------------------

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers (id) on delete cascade,
  -- 0 = Sunday … 6 = Saturday (same as JS Date#getDay and Postgres extract(dow)).
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  check (end_time > start_time),
  -- Active intervals of the same day may not overlap.
  constraint business_hours_no_overlap exclude using gist (
    barber_id with =,
    day_of_week with =,
    public.timerange(start_time, end_time, '[)') with &&
  ) where (active)
);

-- ---------------------------------------------------------------------------
-- schedule_exceptions — date-specific openings, blocks and closures
-- ---------------------------------------------------------------------------

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers (id) on delete cascade,
  date date not null,
  type public.schedule_exception_type not null,
  -- Both null = the whole day.
  start_time time,
  end_time time,
  -- Private: only Nizar sees it. Never exposed to public clients.
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check ((start_time is null) = (end_time is null)),
  check (start_time is null or end_time > start_time),
  check (type <> 'closed' or start_time is null),
  check (type <> 'available' or start_time is not null)
);

create index schedule_exceptions_barber_date_idx on public.schedule_exceptions (barber_id, date);

-- ---------------------------------------------------------------------------
-- clients — no accounts; deduplicated per barber by normalized phone (E.164)
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barber_id, phone),
  unique (id, barber_id)
);

create index clients_barber_name_idx on public.clients (barber_id, lower(full_name));
create trigger clients_set_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers (id) on delete cascade,
  client_id uuid not null,
  service_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- Service duration at booking time; later service edits never move it.
  duration_snapshot integer not null check (duration_snapshot between 5 and 480),
  status public.appointment_status not null default 'confirmed',
  client_note text check (char_length(client_note) <= 500),
  -- 256-bit random secret for /manage/[token]. Never sequential, never guessable.
  public_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  -- Client and service must belong to the same barber as the appointment.
  foreign key (client_id, barber_id) references public.clients (id, barber_id) on delete restrict,
  foreign key (service_id, barber_id) references public.services (id, barber_id) on delete restrict,
  check (end_at > start_at),
  check (end_at = start_at + make_interval(mins => duration_snapshot)),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  -- Double-booking guard of last resort: two time-occupying appointments of the
  -- same barber can never overlap, whatever the application does. Cancelled
  -- and no-show rows free their slot. '[)' lets 10:00–11:00 and 11:00–12:00 coexist.
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('confirmed', 'completed'))
);

create index appointments_barber_start_idx on public.appointments (barber_id, start_at);
create index appointments_client_start_idx on public.appointments (client_id, start_at);
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();
