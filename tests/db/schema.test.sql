-- Database tests: constraints, double-booking protection, RLS, owner linking.
-- Run with tests/db/run.sh. Every block raises on failure (ON_ERROR_STOP).

\set QUIET on
\echo '--- seed shape'
do $$
declare b uuid := (select id from public.barbers where slug = 'nizar');
begin
  assert b is not null, 'barber nizar exists';
  assert (select count(*) from public.services where barber_id = b) = 3, 'exactly 3 services';
  assert (select array_agg(duration_minutes order by display_order) from public.services where barber_id = b)
    = array[60, 90, 120], 'service durations 60/90/120';
  assert (select count(*) from public.business_hours where barber_id = b and day_of_week = 1) = 2, 'split day';
  assert (select count(*) from public.business_hours where barber_id = b and day_of_week = 0) = 0, 'sunday closed';
  assert (select count(*) from public.appointments where status = 'cancelled') = 1, 'cancelled sample';
  assert (select count(*) from public.appointments where status = 'no_show') = 1, 'no_show sample';
  assert (select count(*) from public.schedule_exceptions where type = 'blocked') = 1, 'blocked sample';
  assert (select user_id from public.barbers where id = b)
    = (select id from auth.users where email = 'nizar@example.com'), 'owner linked by seed';
end $$;

\echo '--- seed is re-runnable'
\i supabase/seed.sql
do $$ begin
  assert (select count(*) from public.services) = 3, 'no duplicated services after re-seed';
  assert (select count(*) from public.clients) = 5, 'no duplicated clients after re-seed';
end $$;

\echo '--- double booking is impossible at database level'
do $$
declare
  b uuid := (select id from public.barbers where slug = 'nizar');
  s uuid := (select id from public.services where barber_id = b and name = 'Coupe');
  c uuid := (select id from public.clients where phone = '+212600000002');
  t timestamptz := (select start_at from public.appointments where status = 'confirmed' and duration_snapshot = 60 limit 1);
begin
  begin
    insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
    values (b, c, s, t + interval '30 minutes', t + interval '90 minutes', 60);
    raise exception 'overlapping insert should fail';
  exception when exclusion_violation then null;
  end;

  -- Back-to-back is fine ([) ranges).
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
  values (b, c, s, t - interval '60 minutes', t, 60);

  -- A completed appointment still occupies its slot.
  begin
    update public.appointments set status = 'completed' where start_at = t and status = 'confirmed';
    insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
    values (b, c, s, t, t + interval '60 minutes', 60);
    raise exception 'overlap with completed should fail';
  exception when exclusion_violation then null;
  end;
end $$;

\echo '--- cancellation reopens the slot'
do $$
declare
  b uuid := (select id from public.barbers where slug = 'nizar');
  s uuid := (select id from public.services where barber_id = b and name = 'Coupe');
  c uuid := (select id from public.clients where phone = '+212600000003');
  a record := (select a from public.appointments a where status = 'cancelled');
begin
  -- The seeded cancelled slot is bookable.
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
  values (b, c, s, (a).start_at, (a).end_at, 60);
end $$;

\echo '--- integrity checks'
do $$
declare
  b uuid := (select id from public.barbers where slug = 'nizar');
  s uuid := (select id from public.services where barber_id = b and name = 'Coupe');
  c uuid := (select id from public.clients where phone = '+212600000001');
  other uuid;
  t timestamptz := now() + interval '100 days';
begin
  -- Duration must match the interval.
  begin
    insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
    values (b, c, s, t, t + interval '45 minutes', 60);
    raise exception 'mismatched duration should fail';
  exception when check_violation then null;
  end;

  -- cancelled_at must accompany status cancelled.
  begin
    insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot, status)
    values (b, c, s, t, t + interval '60 minutes', 60, 'cancelled');
    raise exception 'cancelled without cancelled_at should fail';
  exception when check_violation then null;
  end;

  -- Same phone cannot be duplicated for a barber.
  begin
    insert into public.clients (barber_id, full_name, phone) values (b, 'Dup', '+212600000001');
    raise exception 'duplicate phone should fail';
  exception when unique_violation then null;
  end;

  -- Phone must be normalized E.164.
  begin
    insert into public.clients (barber_id, full_name, phone) values (b, 'Bad', '0612345678');
    raise exception 'non-normalized phone should fail';
  exception when check_violation then null;
  end;

  -- An appointment cannot reference another barber's client.
  insert into public.barbers (public_name, slug, email) values ('Other', 'other', 'other@example.com')
    returning id into other;
  begin
    insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
    values (other, c, s, t, t + interval '60 minutes', 60);
    raise exception 'cross-barber reference should fail';
  exception when foreign_key_violation then null;
  end;

  -- Overlapping business hours on the same day are rejected.
  begin
    insert into public.business_hours (barber_id, day_of_week, start_time, end_time)
    values (b, 1, '12:00', '15:00');
    raise exception 'overlapping hours should fail';
  exception when exclusion_violation then null;
  end;

  -- Reserved slugs and bad timezones are rejected.
  begin
    insert into public.barbers (public_name, slug, email) values ('X', 'dashboard', 'x@example.com');
    raise exception 'reserved slug should fail';
  exception when check_violation then null;
  end;
  begin
    insert into public.barbers (public_name, slug, email, timezone) values ('X', 'x', 'x@example.com', 'Mars/Base');
    raise exception 'bad timezone should fail';
  exception when invalid_parameter_value then null;
  end;

  -- Public tokens are 64 hex chars and unique.
  assert (select bool_and(public_token ~ '^[0-9a-f]{64}$') from public.appointments), 'token format';
  assert (select count(distinct public_token) = count(*) from public.appointments), 'token unique';
end $$;

\echo '--- RLS: anonymous visitors cannot read or write anything'
begin;
set local role anon;
do $$ begin
  begin perform 1 from public.clients; raise exception 'anon read clients';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.appointments; raise exception 'anon read appointments';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.schedule_exceptions; raise exception 'anon read exceptions';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.barbers; raise exception 'anon read barbers';
  exception when insufficient_privilege then null; end;
  begin insert into public.clients (barber_id, full_name, phone)
    values ((select gen_random_uuid()), 'x', '+212611111111'); raise exception 'anon insert';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

\echo '--- RLS: a signed-in stranger sees nothing'
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-00000000dead', 'stranger@example.com', now());
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000dead';
do $$ begin
  assert (select count(*) from public.barbers) = 0, 'stranger sees no barber';
  assert (select count(*) from public.clients) = 0, 'stranger sees no clients';
  assert (select count(*) from public.appointments) = 0, 'stranger sees no appointments';
  assert (select count(*) from public.schedule_exceptions) = 0, 'stranger sees no exceptions';
  begin
    insert into public.services (barber_id, name, duration_minutes)
    values ((select id from public.barbers where slug = 'nizar'), 'Hack', 30);
    raise exception 'stranger inserted a service';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

\echo '--- RLS: Nizar sees and manages only his own data'
select id as nizar_uid from auth.users where email = 'nizar@example.com' \gset
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'nizar_uid';
do $$
declare n_appts int;
begin
  assert (select count(*) from public.barbers) = 1, 'owner sees own barber only';
  assert (select count(*) from public.clients) = 5, 'owner sees his clients';
  n_appts := (select count(*) from public.appointments);
  assert n_appts > 0, 'owner sees appointments';
  assert (select count(*) from public.schedule_exceptions where reason is not null) = 2, 'owner sees private reasons';

  -- Can update allowed settings…
  update public.barbers set buffer_minutes = 10;
  -- …but not identity columns.
  begin
    update public.barbers set user_id = null;
    raise exception 'owner changed user_id';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.barbers set slug = 'hacked';
    raise exception 'owner changed slug';
  exception when insufficient_privilege then null;
  end;

  -- Appointments are never hard-deleted.
  begin
    delete from public.appointments;
    raise exception 'owner deleted appointments';
  exception when insufficient_privilege then null;
  end;

  -- Status changes work.
  update public.appointments set status = 'cancelled', cancelled_at = now()
  where id = (select id from public.appointments where status = 'confirmed' limit 1);
end $$;
rollback;

\echo '--- owner linking requires a confirmed email'
do $$
declare b uuid;
begin
  insert into public.barbers (public_name, slug, email) values ('Link', 'link-test', 'link@example.com')
    returning id into b;
  insert into auth.users (email) values ('link@example.com');
  assert (select user_id from public.barbers where id = b) is null, 'unconfirmed user must not be linked';
  update auth.users set email_confirmed_at = now() where email = 'link@example.com';
  assert (select user_id from public.barbers where id = b)
    = (select id from auth.users where email = 'link@example.com'), 'confirmed user linked';
end $$;


\echo '--- booking functions: atomic, buffer-aware, server-only'
do $$
declare
  b uuid := (select id from public.barbers where slug = 'nizar');
  s uuid := (select id from public.services where barber_id = b and name = 'Coupe');
  t timestamptz := date_trunc('hour', now()) + interval '20 days';
  r public.appointments;
  r2 public.appointments;
  n_clients int;
begin
  r := public.book_appointment(b, s, t, 60, 'Fn Client', '+212699000001', 'note');
  assert r.id is not null and r.end_at = t + interval '1 hour', 'booked';

  -- Same slot again → null, no exception, no new appointment.
  assert (public.book_appointment(b, s, t + interval '30 minutes', 60, 'Other', '+212699000002', null)).id is null, 'overlap refused';

  -- Same phone reuses the client.
  select count(*) into n_clients from public.clients where phone = '+212699000001';
  r2 := public.book_appointment(b, s, t + interval '2 hours', 60, 'Fn Client again', '+212699000001', null);
  assert r2.client_id = r.client_id, 'client reused';
  assert (select count(*) from public.clients where phone = '+212699000001') = n_clients, 'no duplicate client';

  -- Buffer is enforced under the lock.
  update public.barbers set buffer_minutes = 15 where id = b;
  assert (public.book_appointment(b, s, t + interval '70 minutes', 30, 'Buf', '+212699000003', null)).id is null, 'buffer after refused';
  assert (public.book_appointment(b, s, t + interval '75 minutes', 30, 'Buf', '+212699000003', null)).id is not null, 'buffer respected ok';
  update public.barbers set buffer_minutes = 0 where id = b;

  -- Move: may overlap its own old time, not others; keeps duration.
  r := public.move_appointment(r.public_token, t + interval '15 minutes');
  assert r.start_at = t + interval '15 minutes' and r.end_at = t + interval '75 minutes', 'moved onto own slot';
  assert (public.move_appointment(r.public_token, t + interval '2 hours')).id is null, 'cannot move onto another booking';
  assert (public.move_appointment(repeat('0', 64), t)).id is null, 'unknown token';
end $$;

begin;
set local role anon;
do $$ begin
  begin
    perform public.book_appointment(gen_random_uuid(), gen_random_uuid(), now(), 60, 'x', '+212611111111', null);
    raise exception 'anon called book_appointment';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

begin;
set local role authenticated;
do $$ begin
  begin
    perform public.move_appointment(repeat('0', 64), now());
    raise exception 'authenticated called move_appointment';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

do $$
declare b uuid := (select id from public.barbers where slug = 'nizar');
begin
  perform public.replace_business_hours(b, '[{"dayOfWeek":1,"start":"10:00","end":"12:00"},{"dayOfWeek":1,"start":"13:00","end":"19:00"}]');
  assert (select count(*) from public.business_hours where barber_id = b) = 2, 'hours replaced';
  begin
    perform public.replace_business_hours(b, '[{"dayOfWeek":1,"start":"10:00","end":"12:00"},{"dayOfWeek":1,"start":"11:00","end":"19:00"}]');
    raise exception 'overlapping hours accepted';
  exception when exclusion_violation then null;
  end;
  assert (select count(*) from public.business_hours where barber_id = b) = 2, 'failed replace left hours untouched';
end $$;

\echo 'BOOKING FUNCTION TESTS PASSED'

\echo 'ALL DATABASE TESTS PASSED'
