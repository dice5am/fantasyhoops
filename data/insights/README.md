# data/insights

`insights.json` is a baked copy of Analyst's
`/workspace/skyscraper/nba-fantasy/phase-insights-analysis/insights.json` (read-only source; never write there).
Loaded server-side by `src/lib/loadInsightLists.ts` (validated; missing/malformed → the /insights list section hides, rest of the page renders).

**Drop in a new version:** `scripts/dropin_insights.sh` (copies, validates JSON, commits, pushes the current branch → Vercel preview).
