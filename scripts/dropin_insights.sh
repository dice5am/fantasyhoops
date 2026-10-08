#!/usr/bin/env bash
# Drop in Analyst's insights.json (read-only source) → baked app copy, then commit + push.
# Usage: scripts/dropin_insights.sh [/path/to/insights.json]   (run on branch insights-lists; preview only)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
SRC="${1:-/workspace/skyscraper/nba-fantasy/phase-insights-analysis/insights.json}"
DEST="data/insights/insights.json"
[[ -f "$SRC" ]] || { echo "missing $SRC" >&2; exit 1; }
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$SRC" || { echo "not valid JSON: $SRC" >&2; exit 1; }
cp "$SRC" "$DEST"
sha256sum "$DEST"
git add "$DEST"
git -c user.name='NBA Dashboard Engineer' -c user.email='dashboard@fantasyhoops.local' \
  commit -m "data(insights): drop in insights.json ($(sha256sum "$DEST" | cut -c1-8))"
git push origin HEAD
