-- Development seed for Nizar Barber Booking.
--
-- Safe to re-run. Configuration rows (barber, services, hours) are upserted;
-- sample data (clients with +2126000000xx phones, exceptions whose reason
-- starts with "[seed]") is wiped and recreated. Remove sample data with
-- supabase/seed-reset.sql.
--
-- BEFORE RUNNING: set v_owner_email to the email Nizar logs in with.

do $$
declare
  v_owner_email constant text := 'nizar@example.com';
  v_tz constant text := 'Africa/Casablanca';

  v_barber uuid;
  v_coupe uuid;
  v_coupe_barbe uuid;
  v_proteine uuid;
  v_today date := (now() at time zone v_tz)::date;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
begin
  -- Barber -----------------------------------------------------------------
  insert into public.barbers (public_name, slug, email, timezone, city)
  values ('Nizar', 'nizar', lower(v_owner_email), v_tz, 'Casablanca')
  on conflict (slug) do update set email = excluded.email
  returning id into v_barber;

  -- Link the auth user if Nizar's account already exists and is confirmed.
  update public.barbers b set user_id = u.id
  from auth.users u
  where b.id = v_barber and b.user_id is null
    and u.email_confirmed_at is not null and lower(u.email) = b.email;

  -- Services (exactly three, no prices) ----------------------------------
  select id into v_coupe from public.services where barber_id = v_barber and name = 'Coupe';
  if v_coupe is null then
    insert into public.services (barber_id, name, duration_minutes, display_order)
    values (v_barber, 'Coupe', 60, 1) returning id into v_coupe;
  end if;

  select id into v_coupe_barbe from public.services where barber_id = v_barber and name = 'Coupe + barbe';
  if v_coupe_barbe is null then
    insert into public.services (barber_id, name, duration_minutes, display_order)
    values (v_barber, 'Coupe + barbe', 90, 2) returning id into v_coupe_barbe;
  end if;

  select id into v_proteine from public.services where barber_id = v_barber and name = 'Proteine cheveux';
  if v_proteine is null then
    insert into public.services (barber_id, name, duration_minutes, display_order)
    values (v_barber, 'Proteine cheveux', 120, 3) returning id into v_proteine;
  end if;

  -- Working hours: Monday–Saturday, split day 09:00–13:00 / 14:00–20:00.
  -- Sunday has no rows = "Ma khedamch".
  delete from public.business_hours where barber_id = v_barber;
  insert into public.business_hours (barber_id, day_of_week, start_time, end_time)
  select v_barber, d, t.s, t.e
  from generate_series(1, 6) d
  cross join (values (time '09:00', time '13:00'), (time '14:00', time '20:00')) t(s, e);

  -- Sample data reset -----------------------------------------------------
  delete from public.appointments a using public.clients c
    where a.client_id = c.id and c.barber_id = v_barber and c.phone like '+2126000000%';
  delete from public.clients where barber_id = v_barber and phone like '+2126000000%';
  delete from public.schedule_exceptions where barber_id = v_barber and reason like '[seed]%';

  insert into public.clients (barber_id, full_name, phone) values
    (v_barber, 'Youssef El Amrani', '+212600000001') returning id into c1;
  insert into public.clients (barber_id, full_name, phone) values
    (v_barber, 'Hamza Bennani', '+212600000002') returning id into c2;
  insert into public.clients (barber_id, full_name, phone) values
    (v_barber, 'Amine Tazi', '+212600000003') returning id into c3;
  insert into public.clients (barber_id, full_name, phone) values
    (v_barber, 'Karim Alaoui', '+212600000004') returning id into c4;
  insert into public.clients (barber_id, full_name, phone) values
    (v_barber, 'Mehdi Idrissi', '+212600000005') returning id into c5;

  -- Appointments. Wall-clock times are interpreted in Nizar's timezone.
  -- Normal 60 min, today 10:00
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
  values (v_barber, c1, v_coupe,
    (v_today + time '10:00') at time zone v_tz, (v_today + time '11:00') at time zone v_tz, 60);

  -- Cancelled, today 11:00 (its slot is free again)
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot, status, cancelled_at)
  values (v_barber, c4, v_coupe,
    (v_today + time '11:00') at time zone v_tz, (v_today + time '12:00') at time zone v_tz, 60, 'cancelled', now());

  -- 90 min, today 14:00, with a note
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot, client_note)
  values (v_barber, c2, v_coupe_barbe,
    (v_today + time '14:00') at time zone v_tz, (v_today + time '15:30') at time zone v_tz, 90,
    'Bghit dégradé khfif.');

  -- 2 h, today 16:00
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot)
  values (v_barber, c3, v_proteine,
    (v_today + time '16:00') at time zone v_tz, (v_today + time '18:00') at time zone v_tz, 120);

  -- No-show, yesterday 10:00
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot, status)
  values (v_barber, c5, v_coupe,
    (v_today - 1 + time '10:00') at time zone v_tz, (v_today - 1 + time '11:00') at time zone v_tz, 60, 'no_show');

  -- Completed, yesterday 15:00 (history for client profile)
  insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot, status)
  values (v_barber, c1, v_coupe_barbe,
    (v_today - 1 + time '15:00') at time zone v_tz, (v_today - 1 + time '16:30') at time zone v_tz, 90, 'completed');

  -- Blocked period, tomorrow 17:00–18:30 (private reason)
  insert into public.schedule_exceptions (barber_id, date, type, start_time, end_time, reason)
  values (v_barber, v_today + 1, 'blocked', time '17:00', time '18:30', '[seed] Rendez-vous chkhsi');

  -- Closed date, in 5 days
  insert into public.schedule_exceptions (barber_id, date, type, reason)
  values (v_barber, v_today + 5, 'closed', '[seed] 3otla');
end;
$$;
