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
Deep link `/player?player_id=` still loads players **outside** the top 250 (explorer + averages APIs); they are excluded from lists/search/Home. Soft note: “Outside active top-250 pool”.

### Top X% by minutes (Home slider)

Replaces the former All / Min 20 / Top 10% Universe segmented control.

- Single slim range slider: **“Top X% by minutes”** within the top-250.
- Range **10 → 100** (integer %), `step={5}` (5% ticks). Default **`100`** (all 250).
- Live label e.g. `Top 100% · 250 players` / `Top 10% · 25 players`.
- Low height, mobile-first — does not dominate the Home header.
- URL: `?topPct=100` (integer). **No** `?universe=` on Home navigate.
- Legacy `?universe=` (any value) → treat as **topPct 100**.
- Filter (after top-250): take top `ceil(250 * topPct / 100)` (min 1) by the same avg_min ranking within the 250 (`filterByTopPct`).

### No scroll jump (Home filters)

Root cause: App Router RSC remount when `searchParams` change via `router.replace`.

**Required approach for Home (season / scope / topPct):**

1. SSR initial load from `page.tsx`.
2. On in-page filter change: **client-fetch** `GET /api/league-context?...` and `setState` for context.
3. Sync URL with `window.history.replaceState` (do **not** remount the page).

PlayerExplorer / PlayerTable: avoid remounts where possible; if `router.replace` is needed for `useSearchParams`, save/restore `window.scrollY` around the update.

### Spot-check (2025-26 · `reg_only`)

| topPct | expected player_count |
|--------|------------------------|
| `100` | **250** |
| `10` | **~25** (`ceil(250 * 0.10)`) |

Lists/search must not return players outside the top-250 pool.

League aggregate formulas: counting = Σ(avg×gp)/Σ(gp); FG% = Σ sum_fgm / Σ sum_fga; 3PM = GP-weighted `avg_fg3m` only.

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

Default eligibility: `gp ≥ 10` within the topPct-filtered top-250 slice.  
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
| `topPct` | no | Integer 10–100 (default `100`); Top X% by minutes within top-250 |
| `universe` | legacy | Any value → treated as `topPct=100` |
| `min_gp` | reserved | Future UI slider; stacked after topPct |
| `min_min` | reserved | Future minutes floor |

Filter helpers: `selectTop250ByMpg` / `filterByTopPct` in `top250.ts`; aggregates in `leagueAggregates.ts`. Legacy map only in `universe.ts`.

## Chrome

Dark grey + champagne glass tokens in `globals.css` (`--fh-champagne`, `--fh-void-*`). Team hues are **data-only** (leader dots / chart strokes), not chrome.

## Charts (Player)

Mid-season gap hold-last in PlayerExplorer must not regress (null ≠ 0; dashed gap path). Explorer imports shared `radar.ts`.

## Fantasy score viz (fantasy-score-v1)

Consume Data mart only — formulas locked in `docs/FANTASY_SCORE.md`.

| Artifact | Path |
|----------|------|
| Contract | `docs/FANTASY_SCORE.md` |
| Parquet | `data/marts/player_fantasy_scores.parquet` |
| Env | `NBA_FANTASY_SCORE_PATH` |
| Engine port | `src/lib/fantasyScorePool.ts` (`scorePool`) |

### topPct rescoring (required)

- `topPct=100`: use published mart `score_*` / `rank_*`.
- `topPct<100`: narrow published pool by `avg_min` (same top-250 order), then **re-run `scorePool`** on raw inputs. Never reuse full-250 ranks after narrowing.

### Home layout

1. Condensed O1 / OFF / DEF / EFF score boards (top 8)
2. O1 histogram · OFF×DEF scatter (size=`avg_min`) · EFF hist · pool-avg 9-cat radar
3. Slim topPct + `history.replaceState` (no scroll jump)

API: `GET /api/fantasy-scores?season=&scope=&topPct=`
