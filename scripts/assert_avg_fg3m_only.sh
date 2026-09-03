#!/usr/bin/env bash
# Regression: player-averages + src use mart avg_fg3m only (no 3PM fallback paths).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-${ASSERT_BASE_URL:-http://127.0.0.1:3000}}"
URL="${BASE_URL}/api/player-averages?player_id=1629029&season=2025-26&scope=reg_only"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "== assert_avg_fg3m_only =="
echo "GET $URL"

BODY="$(curl -fsS "$URL")" || fail "curl failed for $URL"
echo "body: $BODY"

echo "$BODY" | grep -q '"avg_fg3m"' || fail "JSON missing avg_fg3m"

for key in avg_fg3m_source avg_fg3m_resolved; do
  if echo "$BODY" | grep -q "\"$key\""; then
    fail "JSON must not contain key $key"
  fi
done

if echo "$BODY" | grep -q 'sum_fg3m/gp'; then
  fail "JSON body must not contain string sum_fg3m/gp"
fi

echo "API payload OK (avg_fg3m present; forbidden keys absent)"

TMP="$(mktemp)"
rg -n --glob '!**/node_modules/**' \
  -e 'sum_fg3m/gp' \
  -e 'avg_fg3m_resolved' \
  -e 'avg_fg3m_source' \
  src > "$TMP" || true

BAD=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue
  # Allowed: HARD GUARD route (forbidden-key lists + assert helpers)
  if [[ "$line" == *"src/app/api/player-averages/route.ts:"* ]]; then
    echo "  allow (HARD GUARD): $line"
    continue
  fi
  # Allowed: comments saying forbidden / no fallback
  if echo "$line" | grep -Eiq 'HARD GUARD|FORBIDDEN|forbidden|no sum_fg3m/gp|Never compute sum_fg3m/gp|no .*fallback|illegal 3PM|Never emit source/resolved'; then
    echo "  allow: $line"
    continue
  fi
  # Allowed: pure comment lines that only mention the tokens as documentation
  if echo "$line" | grep -Eiq ':[0-9]+:[[:space:]]*(//|\*|/\*)'; then
    echo "  allow (comment): $line"
    continue
  fi
  echo "  BAD: $line" >&2
  BAD=1
done < "$TMP"
rm -f "$TMP"

if [[ "$BAD" -ne 0 ]]; then
  fail "src/ contains forbidden 3PM fallback patterns outside HARD GUARD / forbidden comments"
fi

echo "src/ grep OK"
echo "PASS assert_avg_fg3m_only"
