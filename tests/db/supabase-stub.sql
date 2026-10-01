-- Minimal stand-in for the parts of Supabase the migrations rely on, so they
-- can be tested on a plain local PostgreSQL. Never run against Supabase.

-- Roles are cluster-wide: create them only once.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema extensions;
create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz
);

-- Supabase reads the caller from the JWT claims of the request.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants table privileges to these roles by default; reproduce that
-- so the tests prove the migrations revoke what they must.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
