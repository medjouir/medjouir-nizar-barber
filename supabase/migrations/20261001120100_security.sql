-- Row Level Security and owner linking.
--
-- Model:
--   * anon (public visitors) has NO direct table access at all. Public booking
--     reads/writes go through the Next.js server, which validates input and uses
--     the service-role key with narrowly scoped queries.
--   * authenticated users only see rows of the barber account they own
--     (barbers.user_id = auth.uid()). Any other signed-in user sees nothing.

-- ---------------------------------------------------------------------------
-- Ownership helper
-- ---------------------------------------------------------------------------

create function private.owns_barber(p_barber_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.barbers b
    where b.id = p_barber_id and b.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_barber(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.owns_barber(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------

revoke all on public.barbers, public.services, public.business_hours,
  public.schedule_exceptions, public.clients, public.appointments from anon;

revoke all on public.barbers, public.services, public.business_hours,
  public.schedule_exceptions, public.clients, public.appointments from authenticated;

-- Nizar may read his profile and edit only non-identity columns.
grant select on public.barbers to authenticated;
grant update (public_name, salon_name, phone, avatar_url, address, city, maps_url,
  slot_interval_minutes, buffer_minutes, minimum_booking_notice_minutes, booking_horizon_days)
  on public.barbers to authenticated;

grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, insert, update, delete on public.schedule_exceptions to authenticated;
-- Clients and appointments are never hard-deleted (history, cancellations).
grant select, insert, update on public.clients to authenticated;
grant select, insert, update on public.appointments to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;

create policy "Owner reads own barber" on public.barbers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner updates own barber" on public.barbers
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Owner manages services" on public.services
  for all to authenticated
  using (private.owns_barber(barber_id)) with check (private.owns_barber(barber_id));

create policy "Owner manages business hours" on public.business_hours
  for all to authenticated
  using (private.owns_barber(barber_id)) with check (private.owns_barber(barber_id));

create policy "Owner manages schedule exceptions" on public.schedule_exceptions
  for all to authenticated
  using (private.owns_barber(barber_id)) with check (private.owns_barber(barber_id));

create policy "Owner reads clients" on public.clients
  for select to authenticated using (private.owns_barber(barber_id));
create policy "Owner creates clients" on public.clients
  for insert to authenticated with check (private.owns_barber(barber_id));
create policy "Owner updates clients" on public.clients
  for update to authenticated
  using (private.owns_barber(barber_id)) with check (private.owns_barber(barber_id));

create policy "Owner reads appointments" on public.appointments
  for select to authenticated using (private.owns_barber(barber_id));
create policy "Owner creates appointments" on public.appointments
  for insert to authenticated with check (private.owns_barber(barber_id));
create policy "Owner updates appointments" on public.appointments
  for update to authenticated
  using (private.owns_barber(barber_id)) with check (private.owns_barber(barber_id));

-- ---------------------------------------------------------------------------
-- Owner linking: a confirmed auth user whose email matches barbers.email
-- becomes that barber's owner. Only links an unowned barber, and only once the
-- email is confirmed, so an unconfirmed sign-up can never claim the account.
-- ---------------------------------------------------------------------------

create function private.link_barber_owner() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null then
    update public.barbers
    set user_id = new.id
    where email = lower(new.email) and user_id is null;
  end if;
  return new;
end;
$$;

revoke all on function private.link_barber_owner() from public;

create trigger on_auth_user_link_barber
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.link_barber_owner();

-- Link an owner that already exists (user created before this migration ran).
update public.barbers b
set user_id = u.id
from auth.users u
where b.user_id is null
  and u.email_confirmed_at is not null
  and lower(u.email) = b.email;
