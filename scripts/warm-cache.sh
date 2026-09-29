#!/usr/bin/env bash
# Pre-load every NT chapter into the live site's data cache after a deploy,
# so no reader waits for the (possibly sleeping) database. Run: bash scripts/warm-cache.sh
set -uo pipefail
SITE=${1:-https://context-black.vercel.app}
BOOKS="matthew:28 mark:16 luke:24 john:21 acts:28 romans:16 1-corinthians:16 2-corinthians:13 galatians:6 ephesians:6
philippians:4 colossians:4 1-thessalonians:5 2-thessalonians:3 1-timothy:6 2-timothy:4 titus:3 philemon:1 hebrews:13
james:5 1-peter:5 2-peter:3 1-john:5 2-john:1 3-john:1 jude:1 revelation:22"
ok=0; fail=0
for entry in $BOOKS; do
  book=${entry%%:*}; n=${entry##*:}
  for c in $(seq 1 "$n"); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$SITE/study/$book/$c")
    [ "$code" = "200" ] && ok=$((ok+1)) || { fail=$((fail+1)); echo "failed: $book $c ($code)"; }
  done
done
curl -s -o /dev/null "$SITE/study"; curl -s -o /dev/null "$SITE/sources"; curl -s -o /dev/null "$SITE/audit"
echo "warmed $ok chapters, $fail failed"
