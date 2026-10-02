#!/usr/bin/env bash
# Fires N parallel book_appointment calls for the same slot and checks that
# exactly one wins. Usage: PGHOST=… PGPORT=… PGUSER=postgres tests/db/race.sh [N]
set -euo pipefail
cd "$(dirname "$0")/../.."
N="${1:-20}"
DB="nizar_race_$$"
OUT="$(mktemp -d)"
psql -q -d postgres -c "create database $DB" >/dev/null
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null; rm -rf "$OUT"' EXIT

args=(-f tests/db/supabase-stub.sql)
for f in supabase/migrations/*.sql; do args+=(-f "$f"); done
psql -q -v ON_ERROR_STOP=1 -d "$DB" "${args[@]}" >/dev/null
psql -q -d "$DB" -c "insert into auth.users (email, email_confirmed_at) values ('nizar@example.com', now())" >/dev/null
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/seed.sql >/dev/null

Q="select (public.book_appointment(b.id, s.id, date_trunc('hour', now()) + interval '21 days', 60, 'Racer',
      '+2126990' || lpad(pg_backend_pid()::text, 5, '0'), null)).id is not null
   from public.barbers b join public.services s on s.barber_id = b.id and s.name = 'Coupe' where b.slug = 'nizar'"
for i in $(seq 1 "$N"); do psql -tA -d "$DB" -c "$Q" > "$OUT/$i" & done
wait

winners=$(cat "$OUT"/* | grep -c '^t$' || true)
rows=$(psql -tA -d "$DB" -c "select count(*) from public.appointments where start_at = date_trunc('hour', now()) + interval '21 days' and status = 'confirmed'")
echo "parallel requests: $N, winners: $winners, confirmed rows: $rows"
[ "$winners" = "1" ] && [ "$rows" = "1" ] && echo "RACE TEST PASSED"
