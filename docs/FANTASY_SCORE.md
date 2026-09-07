# Fantasy Score Engine (Dashboard Home)

Schema version: `fantasy-score-v1`  
Module: `scripts/fantasy_score.py`  
Mart: `data/marts/player_fantasy_scores.parquet`  
DuckDB view: `player_fantasy_scores`  
Builder: `scripts/build_fantasy_scores.py`

This document matches the implementation exactly. Dashboard Home should treat
these formulas as locked.

## Source inputs

From `season_player_averages` (per player × season × `season_type_scope`):

| Input | Use |
| --- | --- |
| `avg_pts`, `avg_ast`, `avg_fg3m`, `avg_reb`, `avg_stl`, `avg_blk` | C1 counting cats (3PM = `avg_fg3m` only) |
| `avg_tov` | T1 turnovers (inverted) |
| `fg_pct`, `sum_fga` | F1 field-goal impact |
| `ft_pct`, `sum_fta` | F1 free-throw impact |
| `avg_min`, `gp`, `player_id` | Pool selection + rank tie-breaks |

`sum_fga` / `sum_fta` are required and must be populated (not all-null).

## Pool selection

For each `(season, season_type_scope)`:

1. Sort players by **`avg_min` DESC**, tie-break **`gp` DESC**, then **`player_id` ASC**.
2. Take the top **N = 250** (or all players if fewer than 250 — e.g. playoff scopes).

Published mart scores use **N = 250**. Column `pool_size` is the actual pool
length for that season×scope; `pool_n_cap` is always 250.

### topPct (Dashboard Home)

Home may further narrow the pool by a percentage of minutes leaders (`topPct`).
**μ / max / min for F1 / C1 / T1 are always computed inside the active pool.**

Therefore when Home applies `topPct`:

1. Start from the same season×scope averages.
2. Select top-250 by `avg_min` (same rule), **then** keep the top `ceil(250 * topPct)` (or your product rule) of that set.
3. Re-run `fantasy_score.score_pool` on that narrowed frame (or mirror the formulas below client-side).

The published mart includes **raw inputs** (`avg_*`, `fg_pct`, `ft_pct`,
`sum_fga`, `sum_fta`, `gp`) plus base top-250 scores/ranks so the Dashboard can
either display Home-default ranks directly or recompute for `topPct`.

Prefer **not** shipping many precomputed `topPct` variants; recompute on the
narrowed pool instead.

## Per-category scores (0–100, within active pool)

### C1 — counting (PTS, AST, 3PM, REB, STL, BLK)

```
score = 100 * x / max_pool
```

- `x` is the category average (`avg_pts`, …, `avg_fg3m`, …).
- `max_pool` = maximum of `x` in the active pool.
- If `max_pool == 0` → **all scores = 0** (documented; avoids divide-by-zero).

### T1 — turnovers (invert)

```
score_tov = 100 * (max_tov - x) / (max_tov - min_tov)
```

- Lower TOV is better.
- If `max_tov == min_tov` → **all scores = 100** (everyone equal).

### F1 — shooting impact (FG and FT separately)

1. Pool mean rate: `μ = nanmean(pct)` over the active pool (`fg_pct` or `ft_pct`).
2. Impact: `impact = (pct - μ) * attempts`  
   - FG uses `sum_fga`; FT uses `sum_fta`.  
   - Null `pct` → impact treated as **0** (typical when attempts are 0).
3. Min–max scale impacts across the pool:

```
score = 100 * (impact - min_impact) / (max_impact - min_impact)
```

- If `max_impact == min_impact` → **all scores = 50**.

Published helper columns: `pool_mu_fg_pct`, `pool_mu_ft_pct`,
`fg_f1_impact`, `ft_f1_impact`.

## Aggregates (equal weight)

```
OFF = mean(score_pts, score_ast, score_fg3m)
DEF = mean(score_reb, score_stl, score_blk)
EFF = mean(score_fg_f1, score_ft_f1, score_tov)
O1  = mean(all 9 category scores)
```

Nine cats: PTS, AST, FG3M, REB, STL, BLK, TOV, FG_F1, FT_F1.

## Ranks

Computed inside the active pool for: `O1`, `OFF`, `DEF`, `EFF`, and each of
the 9 cats.

- Sort key: **score DESC**, then **`gp` DESC**, then **`player_id` ASC**.
- Rank `1` = best. Tie-breaks make the order unique within a pool.

## Spot-check: F1 volume (locked behavior)

Constructed 4-player pool (`fantasy_score.spot_check_f1_volume`):

| Player | fg_pct | sum_fga | vs μ=0.40 | impact | expected `rank_fg_f1` |
| --- | ---: | ---: | --- | ---: | ---: |
| A EqualHighVol | 0.50 | 1000 | above | +100 | 1 |
| B EqualLowVol | 0.50 | 200 | above | +20 | 2 |
| D BrickLowVol | 0.30 | 200 | below | −20 | 3 |
| C BrickHighVol | 0.30 | 1000 | below | −100 | 4 |

Assertions:

- **Equal FG% above μ, higher FGA → better FG F1 rank** (A before B).
- **Brick-volume** (pct below μ, high FGA) → **worse** than low-volume brick
  and worse than efficient volume (C last).

Build refuses to publish if this synthetic check fails.

### Live example (2024-25 `reg_only`, published top-250)

- Equal-ish FG% above pool μ≈0.465: **Shai Gilgeous-Alexander** (fg_pct≈0.519, FGA=1656, impact≈+90, `rank_fg_f1`=11) ranks ahead of **Brook Lopez** (fg_pct≈0.509, FGA=774, impact≈+34, `rank_fg_f1`=39) — higher volume above μ → better FG F1.
- Brick-volume below μ: **Anthony Edwards** (fg_pct≈0.447, FGA=1612, impact≈−28, `rank_fg_f1`=209) — high volume below μ pulls FG F1 down.

## Output columns (mart)

Identity: `player_id`, `full_name`, `season`, `season_type_scope`, `gp`, `avg_min`  
Raw inputs: listed in the table above  
Pool meta: `pool_size`, `pool_n_cap`, `pool_mu_fg_pct`, `pool_mu_ft_pct`,
`fg_f1_impact`, `ft_f1_impact`  
Scores: `score_pts` … `score_ft_f1`, `score_off`, `score_def`, `score_eff`, `score_o1`  
Ranks: `rank_o1`, `rank_off`, `rank_def`, `rank_eff`, `rank_*` per cat

## Seasons / scopes

All seasons and scopes present on `season_player_averages`:

- Seasons: `2023-24`, `2024-25`, `2025-26`
- Scopes: `reg_only`, `reg_plus_playoffs`, `playoff_only`

## Rebuild

```bash
/workspace/nba-phase1/venv/bin/python /workspace/nba-phase1/scripts/build_fantasy_scores.py
```

Does **not** rebuild or delete `season_player_averages` or dense-series marts;
DuckDB update is additive (`CREATE OR REPLACE VIEW player_fantasy_scores` only).
