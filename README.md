# FantasyHoops — NBA Fantasy Phase 3 Dashboard

Next.js glass UI. Tabs: **Home** (`/`) | **Player** (`/player`). No fantasy rankings.

## Hybrid A1+A3 Home (`/`)
Top → bottom:
1. **Hero** — league-average 9-cat radar (same `RADAR_RANGES` / spoke order / norm note as Player)
2. **Triptych** — OFF / DEF / EFF glass panels (league chips + top-5 leaders)
3. **Footer** — **FG% histogram + stocks (STL+BLK) leaders**

### Footer choice (locked)
Home footer is **FG% histogram + stocks leaders**, **not** Strength of Schedule.
There is **no SoS mart** in the Phase 1 publish set, so SoS is intentionally omitted until a DE mart exists.

### Scope lock
UI `SCOPE_OPTIONS` = `reg_only` + `playoff_only` only. Parsers map `reg_plus_playoffs` → `reg_only`.

### League aggregations
- Counting stats: GP-weighted `Σ(avg × gp)/Σ(gp)`
- FG%/FT%: `Σ sum_fgm / Σ sum_fga` (and FT analog) — not mean-of-means
- 3PM: GP-weighted **`avg_fg3m` only** (never `sum_fg3m/gp`)
- API: `GET /api/league-context?season=&scope=`

## Canonical Player UI
- `/player` IA: **Recent → averages list (`PlayerTable` compact) → explorer (`PlayerExplorer`)**
- Shared radar helpers: `src/lib/radar.ts` (Home + Player)
- `/data` redirects to `/player`

## Phase 3 locks
- Chart: raw curated per-game; max 3 seasons; default scope reg_only; skip min≤0 for values
- Chart X-axis: game_num (1…N per season) — reg fixed 1–82, playoff 1–28; null≠0; hold-last gaps
- Chart FG%/FT%: single-game rates only (not season %)
- Radar: Recharts RadarChart; 9 corners PTS AST 3PM REB STL BLK FG% FT% TOV; ≤3 season polygons
- Radar normalization: fixed fantasy ranges (not league %ile) — PTS 0–35, AST 0–12, 3PM 0–5, REB 0–14, STL/BLK 0–2.5, FG% 40–60, FT% 65–95, TOV 0–5 inverted
- 9-cat: mart sum/sum for FG%/FT%; 3PM = mart avg_fg3m only (no sum_fg3m/gp fallback)
- Metric cards: select a card to highlight the matching radar spoke and set the line-chart stat
- Chrome: dark grey + champagne premium glass; team colors on charts/data only

## Run
DoD assert: GET /api/player-averages must never emit sum_fg3m/gp fallback or avg_fg3m_source/resolved fields — mart avg_fg3m only (hard guard in route.ts).
Regression: `bash scripts/assert_avg_fg3m_only.sh`
