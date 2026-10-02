-- Atomic booking operations, called only by the Next.js server (service role).
--
-- The application recomputes availability first (hours, exceptions, notice,
-- horizon). These functions then make the final write race-free:
--   * a per-barber transaction lock serializes concurrent writes;
--   * the buffer rule is re-checked under that lock;
--   * appointments_no_overlap remains the last line of defence.
-- They return NULL when the slot is no longer free.

create function private.slot_is_free(
  p_barber_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude uuid default null
) returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (
    select 1
    from public.appointments a
    join public.barbers b on b.id = a.barber_id
    where a.barber_id = p_barber_id
      and a.status in ('confirmed', 'completed')
      and (p_exclude is null or a.id <> p_exclude)
      and a.start_at < p_end + make_interval(mins => b.buffer_minutes)
      and a.end_at + make_interval(mins => b.buffer_minutes) > p_start
  );
$$;

create function public.book_appointment(
  p_barber_id uuid,
  p_service_id uuid,
  p_start timestamptz,
  p_duration integer,
  p_full_name text,
  p_phone text,
  p_note text
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_end timestamptz := p_start + make_interval(mins => p_duration);
  v_row public.appointments;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_barber_id::text, 0));

  if not private.slot_is_free(p_barber_id, p_start, v_end) then
    return null;
  end if;

  -- Create or reuse the client (same barber + normalized phone).
  insert into public.clients (barber_id, full_name, phone)
  values (p_barber_id, p_full_name, p_phone)
  on conflict (barber_id, phone) do nothing
  returning id into v_client;
  if v_client is null then
    select id into v_client from public.clients where barber_id = p_barber_id and phone = p_phone;
  end if;

  begin
    insert into public.appointments (barber_id, client_id, service_id, start_at, end_at, duration_snapshot, client_note)
    values (p_barber_id, v_client, p_service_id, p_start, v_end, p_duration, p_note)
    returning * into v_row;
  exception when exclusion_violation then
    return null;
  end;
  return v_row;
end;
$$;

create function public.move_appointment(p_token text, p_start timestamptz) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  select * into v_row from public.appointments where public_token = p_token;
  if not found then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_row.barber_id::text, 0));

  -- The original duration is kept even if the service changed since.
  if not private.slot_is_free(v_row.barber_id, p_start, p_start + make_interval(mins => v_row.duration_snapshot), v_row.id) then
    return null;
  end if;

  begin
    update public.appointments
    set start_at = p_start, end_at = p_start + make_interval(mins => duration_snapshot)
    where id = v_row.id and status = 'confirmed'
    returning * into v_row;
  exception when exclusion_violation then
    return null;
  end;
  return v_row;
end;
$$;

-- Replaces a barber's weekly hours in one transaction (no half-saved week).
create function public.replace_business_hours(p_barber_id uuid, p_hours jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.business_hours where barber_id = p_barber_id;
  insert into public.business_hours (barber_id, day_of_week, start_time, end_time)
  select p_barber_id, (h->>'dayOfWeek')::smallint, (h->>'start')::time, (h->>'end')::time
  from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) h;
end;
$$;

-- Server-only: never callable from the browser (anon) or by signed-in users.
revoke all on function private.slot_is_free(uuid, timestamptz, timestamptz, uuid) from public;
revoke all on function public.book_appointment(uuid, uuid, timestamptz, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.move_appointment(text, timestamptz) from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, integer, text, text, text) to service_role;
grant execute on function public.move_appointment(text, timestamptz) to service_role;
revoke all on function public.replace_business_hours(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_business_hours(uuid, jsonb) to service_role;
