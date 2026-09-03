# FantasyHoops — NBA Fantasy Phase 3 Dashboard

Next.js glass UI. Tabs: Data (/) | Player (/player). No fantasy rankings.

## Canonical Player UI (do not thrash)
- /player canonical component: PlayerExplorer (src/components/PlayerExplorer.tsx)
- / Data tab: PlayerTable (src/components/PlayerTable.tsx)
- src/app/player/page.tsx must import PlayerExplorer only. Do not reintroduce PlayerView for /player without PM/CoS decision.

## Phase 3 locks
- Chart: raw curated per-game; max 3 seasons; default scope reg_only; skip min<=0
- Chart X-axis: game_num (1…N per season, games sorted by date) — not game_date
- Chart FG%/FT%: single-game rates only (not season %)
- Radar: Recharts RadarChart; 9 corners PTS AST 3PM REB STL BLK FG% FT% TOV; ≤3 season polygons
- Radar normalization: fixed fantasy ranges (not league %ile) — PTS 0–35, AST 0–12, 3PM 0–5, REB 0–14, STL/BLK 0–2.5, FG% 40–60, FT% 65–95, TOV 0–5 inverted (lower → larger spoke); 3PM = mart avg_fg3m only
- 9-cat: mart sum/sum for FG%/FT%; 3PM = mart avg_fg3m only (no sum_fg3m/gp fallback)
- Metric cards: select a card to highlight the matching radar spoke and set the line-chart stat

## Run
DoD assert: GET /api/player-averages must never emit sum_fg3m/gp fallback or avg_fg3m_source/resolved fields — mart avg_fg3m only (hard guard in route.ts).
Regression: `bash scripts/assert_avg_fg3m_only.sh`
Single-writer until Phase 3 close: NBA Dashboard Engineer owns player-averages API + PlayerExplorer.
