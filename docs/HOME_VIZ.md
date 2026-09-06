# Home Hybrid A1+A3 — visualization & aggregate contracts

## Layout

1. **Hero** — League-average 9-cat radar (shared `src/lib/radar.ts` ranges + `normalizeRadarValue`)
2. **Triptych** — OFF / DEF / EFF chips (league avgs) + top-5 leaders per cat (team `chartPrimary` colors; tap → `/player`)
3. **Footer** — FG% histogram + stocks (STL+BLK) leaders — **not** strength-of-schedule (no SoS mart)

Season chips + scope (`reg_only` default / `playoff_only` only).  
`reg_plus_playoffs` is **not** in UI; URL parsers fall back to `reg_only`.

## Product universe: Top 250 by MPG

Full mart stays intact (no deletes). User-visible Home / averages list / search & typeahead / leaders use only the **Top 250 by `avg_min`** for the selected season + scope.

### Ranking (exact)

1. **`avg_min` DESC**
2. Tie-break **`gp` DESC**
3. Then **`player_id` ASC** (numeric-aware string compare)

Implemented in `src/lib/top250.ts` → `selectTop250ByMpg`. Applied **before** Universe in `getLeagueContext` (`loadMart.ts`).

Same Top-250 pool feeds:

- Home viz (`getLeagueContext` / `filterByUniverse`)
- Averages list (`PlayerTable` SSR / `/api/players` list)
- Player search & typeahead (`/api/player-search`, `/api/players?directory=1`)
- Leaders (via league-context)

### Deep-link exception

`/player?player_id=` still loads explorer/charts for players **outside** the Top 250.  
`/api/player-averages` and game logs are **not** blocked.  
Outside players are excluded from Home / averages list / search&typeahead / leaders.  
Optional soft note on profile: **“Outside active top-250 pool”**.

## Universe control (within the Top 250)

One segmented champagne control. URL round-trip: `?universe=all|min20|top10min`.

| Preset | Filter (within Top-250 pool) | Default |
|--------|------------------------------|---------|
| `all` | `gp ≥ 1` (entire top 250 with games) | |
| `min20` | `gp ≥ 1` AND `avg_min ≥ 20` | **YES** |
| `top10min` | `gp ≥ 1` AND `avg_min` in top decile **of the 250** (ceil 10% of pool size; ties at cutoff) ≈25 | |

- Applies to **all** Home modules (radar, triptych, hist, stocks).
- Pipeline: season+scope mart → `selectTop250ByMpg` → `filterByUniverse` → aggregates.
- Implemented in `src/lib/universe.ts` → `filterByUniverse`, called from `getLeagueContext` in `loadMart.ts` **after** Top 250.
- **No client-side fake filter.** No Top 25% preset.

### Spot-check (2025-26 · `reg_only`)

| stage / universe | player_count |
|------------------|--------------|
| Top-250 pool | **250** |
| `all` (within 250) | **250** |
| `min20` (default) | **250** (rank-250 MPG ≈21.75 ≥ 20, so min20 = all this season) |
| `top10min` | **25** |

Note: `min20 < all` holds when the Top-250 pool includes players under 20 MPG; for 2025-26 reg_only the entire Top 250 clears the floor.

Formulas: counting = Σ(avg×gp)/Σ(gp); FG% = Σ sum_fgm / Σ sum_fga; 3PM = GP-weighted `avg_fg3m` only.

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

Default eligibility: `gp ≥ 10` within the Universe-filtered (Top-250) slice.  
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
| `universe` | no | `all` \| `min20` \| `top10min` (default `min20`); applied **within Top 250** |
| `min_gp` | reserved | Future UI slider; stacked after Universe |
| `min_min` | reserved | Future minutes floor |
| `top_pct` | reserved | Future top-N% (no Top 25% in product UI) |

Filter extension points: `LeagueAggregateFilters` in `leagueAggregates.ts` + Top 250 in `top250.ts` + Universe presets in `universe.ts`.

## Chrome

Dark grey + champagne glass tokens in `globals.css` (`--fh-champagne`, `--fh-void-*`). Team hues are **data-only** (leader dots / chart strokes), not chrome.

## Charts (Player)

Mid-season gap hold-last in PlayerExplorer must not regress (null ≠ 0; dashed gap path). Explorer imports shared `radar.ts`.
