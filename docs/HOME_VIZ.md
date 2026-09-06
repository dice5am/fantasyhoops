# Home Hybrid A1+A3 — visualization & aggregate contracts

## Layout

1. **Hero** — League-average 9-cat radar (shared `src/lib/radar.ts` ranges + `normalizeRadarValue`)
2. **Triptych** — OFF / DEF / EFF chips (league avgs) + top-5 leaders per cat (team `chartPrimary` colors; tap → `/player`)
3. **Footer** — FG% histogram + stocks (STL+BLK) leaders — **not** strength-of-schedule (no SoS mart)

Season chips + scope (`reg_only` default / `playoff_only` only).  
`reg_plus_playoffs` is **not** in UI; URL parsers fall back to `reg_only`.

## Universe control (Home only)

One segmented champagne control. URL round-trip: `?universe=all|min20|top10min`.

| Preset | Filter (server / mart engine) | Default |
|--------|-------------------------------|---------|
| `all` | `gp ≥ 1` | |
| `min20` | `gp ≥ 1` AND `avg_min ≥ 20` | **YES** |
| `top10min` | `gp ≥ 1` AND `avg_min` in top decile (ceil 10%; ties at cutoff included) | |

- Applies to **all** Home modules (radar, triptych, hist, stocks).
- Implemented in `src/lib/universe.ts` → `filterByUniverse`, called from `getLeagueContext` in `loadMart.ts`.
- **No client-side fake filter.** No Top 25% preset.

### Spot-check (2025-26 · `reg_only`)

Documented at ship time (re-run via `/api/league-context`):

| universe | player_count |
|----------|--------------|
| `all` | **582** |
| `min20` | **290** |
| `top10min` | **59** |

For `universe=all` · 2025-26 · `reg_only`:

| Metric | Value |
|--------|-------|
| League PTS (GP-weighted) | **≈ 10.67** |
| League FG% (Σ fgm / Σ fga) | **≈ 0.471 (47.1%)** |
| Σ gp | 26,649 |

## Aggregate formulas

Accurate calcs live in `src/lib/leagueAggregates.ts`.

### Counting (PTS, REB, AST, STL, BLK, TOV, MIN, 3PM)

GP-weighted:

\[
\frac{\sum_i (\mathrm{avg}_i \times \mathrm{gp}_i)}{\sum_i \mathrm{gp}_i}
\]

### FG% / FT%

Shot-weighted (**never** mean-of-means):

\[
\mathrm{FG\%} = \frac{\sum \mathrm{sum\_fgm}}{\sum \mathrm{sum\_fga}},\quad
\mathrm{FT\%} = \frac{\sum \mathrm{sum\_ftm}}{\sum \mathrm{sum\_fta}}
\]

### 3PM — HARD GUARD

GP-weighted **`avg_fg3m` only**. Never `sum_fg3m/gp`. Assert: `scripts/assert_avg_fg3m_only.sh`.

### Leaders / histogram

Default eligibility: `gp ≥ 10` within the Universe-filtered slice.  
TOV leaders = **lowest** TOV (ascending). Radar still inverts TOV for spoke size.

## Radar normalization

Shared module: `src/lib/radar.ts` (Home + PlayerExplorer).

Fixed fantasy ranges (not league percentile): PTS 0–35, AST 0–12, 3PM 0–5, REB 0–14, STL/BLK 0–2.5, FG% 40–60, FT% 65–95, TOV 0–5 inverted.

## API: `GET /api/league-context`

Query params:

| Param | Required | Notes |
|-------|----------|-------|
| `season` | no | Default `2025-26` |
| `scope` / `season_type_scope` | no | `reg_only` \| `playoff_only`; `reg_plus_playoffs` → `reg_only` |
| `universe` | no | `all` \| `min20` \| `top10min` (default `min20`) |
| `min_gp` | reserved | Future UI slider; stacked after Universe |
| `min_min` | reserved | Future minutes floor |
| `top_pct` | reserved | Future top-N% (no Top 25% in product UI) |

Filter extension points: `LeagueAggregateFilters` in `leagueAggregates.ts` + Universe presets in `universe.ts`.

## Chrome

Dark grey + champagne glass tokens in `globals.css` (`--fh-champagne`, `--fh-void-*`). Team hues are **data-only** (leader dots / chart strokes), not chrome.

## Charts (Player)

Mid-season gap hold-last in PlayerExplorer must not regress (null ≠ 0; dashed gap path). Explorer imports shared `radar.ts`.
