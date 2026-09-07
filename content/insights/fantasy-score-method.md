---
title: Fantasy score method — how we rank the pool
date: 2026-09-07
slug: fantasy-score-method
summary: Locked 9-cat scoring (C1/T1/F1/O1) on the top-250 minutes pool, reg_only / playoff_only only — the baseline every later Insight post will cite.
author: NBA Fantasy Analyst
tags: [fantasy, method, scores]
status: ready
---

# Fantasy score method — how we rank the pool

**Takeaway:** FantasyHoops ranks players with a locked, pool-relative 9-category engine (C1 / T1 / F1 / O1). Always read ranks inside the **top-250 by minutes** for a single scope — **`reg_only` or `playoff_only`** — never a combined regular+playoff smear.

## Method

### Pool

For each season × scope:

1. Sort by `avg_min` DESC (tie-break `gp` DESC, then `player_id` ASC).
2. Keep the top **250** (or everyone if fewer — e.g. some playoff pools).
3. Home may further narrow with `topPct`; when it does, category μ / max / min are recomputed **inside that narrower pool**.

### Categories (0–100 within the active pool)

| Block | Cats | Rule |
| --- | --- | --- |
| **C1** counting | PTS, AST, 3PM, REB, STL, BLK | `100 * x / max_pool` (3PM = **`avg_fg3m` only**) |
| **T1** turnovers | TOV | Invert: lower TOV → higher score |
| **F1** shooting | FG, FT | Impact = `(pct − μ_pool) * attempts` (`sum_fga` / `sum_fta`), then min–max to 0–100 |

FG% and FT% are **sum/sum** rates (0–1), never raw game zeros.

### Aggregates (equal weight)

- **OFF** = mean(PTS, AST, FG3M scores)
- **DEF** = mean(REB, STL, BLK scores)
- **EFF** = mean(FG F1, FT F1, TOV scores)
- **O1** = mean of all nine category scores

Ranks: score DESC, then `gp` DESC, then `player_id` ASC. Rank `1` = best.

## Seasons in the mart today

`2021-22` → `2025-26` (five seasons). Product analysis scopes: **`reg_only`** and **`playoff_only` only**.

## What this means for drafting

- Treat **O1** as the overall 9-cat anchor; peel **OFF / DEF / EFF** when building a build.
- Volume above the pool shooting mean helps F1; high-volume bricks hurt — efficiency is not rate-only.
- Home `topPct` changes the competitive set; ranks are not portable across different pool cuts without recompute.

## Limits

- No player bios (age / height / experience) in the mart yet — age curves and size/role Insights wait on Data.
- Dense game charts use null ≠ 0 for DNP slots; this method note is about **season averages + fantasy scores**, not dense series.
- This post documents the lock; it does not replace reading `docs/FANTASY_SCORE.md` for implementers.

*Evidence: published `player_fantasy_scores` mart + `docs/FANTASY_SCORE.md` (fantasy-score-v1).*
