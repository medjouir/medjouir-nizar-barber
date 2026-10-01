#!/usr/bin/env bash
# Applies the Supabase stub, all migrations and the seed to a throwaway local
# database, then runs tests/db/schema.test.sql.
#
# Usage: PGHOST=… PGPORT=… PGUSER=postgres tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="nizar_test_$$"
psql -q -d postgres -c "create database $DB" >/dev/null
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT

run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

run -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do run -f "$f"; done
# Nizar's confirmed auth user exists before seeding (as in production).
run -c "insert into auth.users (email, email_confirmed_at) values ('nizar@example.com', now())"
run -f supabase/seed.sql
run -f tests/db/schema.test.sql
