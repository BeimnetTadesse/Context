#!/usr/bin/env bash
# Publish local content (studies, commentaries, versions) to the live Neon database
# WITHOUT losing live user data (accounts, notes, quiz answers, their AI logs).
# Usage: bash scripts/sync-neon.sh        (reads NEON_DATABASE_URL_DIRECT from .env.local)
set -euo pipefail
cd "$(dirname "$0")/.."
NEON=$(python3 -c "
for l in open('.env.local'):
    if l.startswith('NEON_DATABASE_URL_DIRECT='): print(l.split('=',1)[1].strip().strip('\"\''))")
[ -n "$NEON" ] || { echo "NEON_DATABASE_URL_DIRECT missing in .env.local"; exit 1; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "1/5 saving live user data from Neon…"
for t in users notes assumption_guesses; do
  psql "$NEON" -q -c "\\copy (select * from $t) to '$TMP/$t.csv' csv header"
done
psql "$NEON" -q -c "\\copy (select user_id, kind, book_id, chapter, input, retrieved, output, validation, model, prompt_version, created_at from ai_runs where user_id is not null) to '$TMP/ai_user.csv' csv header"
wc -l "$TMP"/*.csv | tail -n +1

echo "2/5 dumping local content (no local users/notes/logs)…"
pg_dump --no-owner --no-privileges -d context_dev \
  --exclude-table-data=users --exclude-table-data=notes --exclude-table-data=assumption_guesses --exclude-table-data=ai_runs \
  -f "$TMP/content.sql"
psql -d context_dev -q -c "\\copy (select null::int as user_id, kind, book_id, chapter, input, retrieved, output, validation, model, prompt_version, created_at from ai_runs where kind in ('chapter_study','review')) to '$TMP/ai_local.csv' csv header"

echo "3/5 replacing Neon content (single transaction)…"
psql "$NEON" -q -v ON_ERROR_STOP=1 --single-transaction \
  -c "drop schema public cascade; create schema public;" -f "$TMP/content.sql" >/dev/null

echo "4/5 restoring live user data…"
psql "$NEON" -q -v ON_ERROR_STOP=1 --single-transaction <<SQL
\\copy users from '$TMP/users.csv' csv header
create temp table n (like notes);
\\copy n from '$TMP/notes.csv' csv header
insert into notes select id, user_id, book_id, chapter, start_ord, end_ord, kind,
  case when item_id in (select id from reflection_items) then item_id end, body, created_at from n;
create temp table g (like assumption_guesses);
\\copy g from '$TMP/assumption_guesses.csv' csv header
insert into assumption_guesses select * from g where item_id in (select id from reflection_items);
create temp table a (user_id int, kind text, book_id smallint, chapter smallint, input text, retrieved jsonb, output jsonb, validation jsonb, model text, prompt_version text, created_at timestamptz);
\\copy a from '$TMP/ai_local.csv' csv header
\\copy a from '$TMP/ai_user.csv' csv header
insert into ai_runs (user_id, kind, book_id, chapter, input, retrieved, output, validation, model, prompt_version, created_at)
  select * from a order by created_at;
select setval('users_id_seq', greatest((select max(id) from users), 1));
select setval('notes_id_seq', greatest((select max(id) from notes), 1));
SQL

echo "5/5 verifying…"
Q="select 'studies',count(*) from chapter_studies where status='ready' union all select 'claims',count(*) from claims union all select 'commentary_notes',count(*) from commentary_notes union all select 'verse_texts',count(*) from verse_texts union all select 'users',count(*) from users union all select 'notes',count(*) from notes"
psql "$NEON" -At -F ' ' -c "$Q"
