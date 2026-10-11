#!/usr/bin/env bash
# Aplica um stub do Supabase + todas as migrações num Postgres descartável
# e roda os testes SQL de RLS. Uso:
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres npm run test:db
set -euo pipefail
DB="${TEST_DB_NAME:-boratreinar_test}"
cd "$(dirname "$0")/.."
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -t -A -v ON_ERROR_STOP=1 -d "$DB" -f "$1" 2>&1 | sed -e '/^$/d' -e 's/^psql:[^ ]* NOTICE:  /  /'; return "${PIPESTATUS[0]}"; }
run supabase/tests/00_stub_supabase.sql
for f in supabase/migrations/*.sql; do run "$f"; done
[ -f supabase/seed.sql ] && run supabase/seed.sql
for f in supabase/tests/*.test.sql; do echo "▶ $f"; run "$f"; done
psql -q -d postgres -c "drop database $DB" >/dev/null
