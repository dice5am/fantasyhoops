# Home Hybrid A1+A3 — visualization & aggregate contracts

## Layout

1. **Hero** — League-average 9-cat radar (shared `src/lib/radar.ts` ranges + `normalizeRadarValue`)
2. **Triptych** — OFF / DEF / EFF chips (league avgs) + top-5 leaders per cat (team `chartPrimary` colors; tap → `/player`)
3. **Footer** — FG% histogram + stocks (STL+BLK) leaders — **not** strength-of-schedule (no SoS mart)

Season chips + scope (`reg_only` default / `playoff_only` only).  
`reg_plus_playoffs` is **not** in UI; URL parsers fall back to `reg_only`.

## Product pool: Top 250 by MPG + topPct slider

### Top-250 pool

Full mart stays on disk. User-visible Home viz, averages list (`/api/players` + PlayerTable), search/typeahead, and leaders/league radar use only the **top 250** players by minutes for the selected season+scope.

| Rank key | Order |
|----------|-------|
| `avg_min` | **DESC** |
| `gp` | **DESC** (tie-break) |
| `player_id` | **ASC** (tie-break; numeric-aware string) |

Implemented in `src/lib/top250.ts` → `selectTop250ByMpg`.  
Deep link `/player?player_id=` still loads players **outside** the top 250 (explorer + averages APIs); they are excluded from lists/search/Home. Soft note: "Outside active top-250 pool".

### Top X% by minutes (Home slider)

Replaces the former All / Min 20 / Top 10% Universe segmented control.

- Single slim range slider: **"Top X% by minutes"** within the top-250.
- Range **10 → 100** (integer %), `step={5}` (5% ticks). Default **`100`** (all 250).
- Live label e.g. `Top 100% · 250 players` / `Top 10% · 25 players`.
- Low height, mobile-first — does not dominate the Home header.
- URL: `?topPct=100` (integer). **No** `?universe=` on Home navigate.
- Legacy `?universe=` (any value) → treat as **topPct 100**.
- Filter (after top-250): take top `ceil(250 * topPct / 100)` (min 1) by the same avg_min ranking within the 250 (`filterByTopPct`).
- `router.replace(..., { scroll: false })` on slider + season/scope — **no scroll jump**.

Applies to **all** Home modules (radar, triptych, hist, stocks) via `getLeagueContext` in `loadMart.ts`.

### Spot-check (2025-26 · `reg_only`)

| topPct | expected player_count |
|--------|------------------------|
| `100` | **250** |
| `10` | **~25** (`ceil(250 * 0.10)`) |

Lists/search must not return players outside the top-250 pool.

## Aggregate formulas

Accurate calcs live in `src/lib/leagueAggregates.ts`. Counting = GP-weighted; FG%/FT% = Σ made / Σ att; 3PM = GP-weighted `avg_fg3m` only. Assert: `scripts/assert_avg_fg3m_only.sh`.

Leaders/hist default eligibility: `gp ≥ 10` within the topPct-filtered top-250 slice.

## API: `GET /api/league-context`

| Param | Notes |
|-------|-------|
| `season` | Default `2025-26` |
| `scope` | `reg_only` \| `playoff_only` |
| `topPct` | Integer 10–100 (default `100`) |
| `universe` | Legacy → treated as `topPct=100` |

Filter helpers: `selectTop250ByMpg` / `filterByTopPct` in `top250.ts`. Legacy map only in `universe.ts`.

## Chrome / Charts

Dark grey + champagne glass. Mid-season gap hold-last in PlayerExplorer must not regress.
