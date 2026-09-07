---
title: How sticky are playoff fantasy ranks year to year?
date: 2026-09-07
slug: rank-stability-playoff
summary: Playoff-only O1 ranks correlate ~0.77 YoY (ρ ~0.74–0.78) among overlapping playoff pools — similar stickiness to reg_only (~0.72–0.83) but on much thinner samples (median GP 6–7, pools <250).
author: NBA Fantasy Analyst
tags: [fantasy, ranks, stability, playoffs]
status: ready
---

# How sticky are playoff fantasy ranks year to year?

**Takeaway:** Prior-season playoff **O1** rank is a usable playoff-format anchor among players who return to the playoff pool, not a lock. Year-over-year Spearman ρ for overall rank runs about **0.74–0.78** (average **~0.77**). Roughly **71%** of overlapping top-50 players stay top-50 and **~83%** stay top-100; the typical absolute O1 move is about **23–32** spots.

Versus **reg_only** (ρ ~0.72–0.83, avg ~0.77), playoff ρ is in a similar band — but playoff pools are smaller (214–230), median GP is only 6–7, and consecutive overlap is ~102–126 vs ~171–197 in the regular-season prep.

## Method

- **Source:** player_fantasy_scores mart (read-only).
- **Scope:** playoff_only only.
- **Pool:** within-season playoff pool (actual size <250 — see table).
- **Seasons:** 2021-22 → 2025-26.
- **Universe:** players in **both** seasons’ playoff pools for each consecutive pair.
- **Metrics:** Spearman ρ on overall / offense / defense / efficiency ranks; share staying top-50 / top-100 by O1; median absolute O1 rank change.

Rank columns used:

```
rank_o1, rank_off, rank_def, rank_eff
```

### Median GP (playoff_only)

| Season | Median GP | Pool size |
| --- | ---: | ---: |
| 2021-22 | 6.0 | 217 |
| 2022-23 | 6.0 | 217 |
| 2023-24 | 6.0 | 214 |
| 2024-25 | 6.0 | 219 |
| 2025-26 | 7.0 | 230 |

**All seasons look thin by GP** (median 6–7) — expected for playoffs, not a partial-season flag relative to each other. Pool sizes stay under the usual 250-player regular-season cap.

## Evidence: consecutive-pair summary

| Pair | n overlap | ρ O1 | ρ OFF | ρ DEF | ρ EFF | Stay top-50 | Stay top-100 | Med abs ΔO1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2021-22→2022-23 | 123 | 0.78 | 0.82 | 0.80 | 0.32 | 77% | 86% | 23 |
| 2022-23→2023-24 | 102 | 0.74 | 0.73 | 0.72 | 0.20 | 68% | 80% | 30 |
| 2023-24→2024-25 | 126 | 0.78 | 0.81 | 0.77 | 0.44 | 71% | 77% | 24 |
| 2024-25→2025-26 | 108 | 0.76 | 0.79 | 0.76 | 0.49 | 68% | 87% | 32 |

### Patterns

- Overall playoff stickiness **tracks reg_only closely** on ρ despite much shorter samples.
- Overlap is **structurally thinner** than reg_only; many strong regular-season players never re-enter the next playoff pool.
- Median absolute O1 moves (~23–32) are **similar in magnitude** to reg_only (~24–30) but occur inside a smaller rank scale.
- **EFF is far noisier** in playoffs (ρ ≈ **0.20–0.49**) than O1 / OFF / DEF — short series amplify shooting/TO swings.

## Example movers (negative Δ = improved O1 rank)

Illustrative — series length, matchup, and role can dominate:

- **Big risers:** Caleb Martin (-114, 2021-22→2022-23), Nikola Jović (-145, 2022-23→2023-24), AJ Green (-106, 2023-24→2024-25), Duncan Robinson (-134, 2024-25→2025-26).
- **Big fallers:** Jordan McLaughlin (+96, 2021-22→2022-23), De'Anthony Melton (+126, 2022-23→2023-24), Kyle Anderson (+116, 2023-24→2024-25), Haywood Highsmith (+138, 2024-25→2025-26).

## What it means for drafting

1. For **playoff fantasy formats**, last year’s playoff O1 is a reasonable prior among returnees — budget for ~**20s–30s** median reshuffling.
2. Do **not** copy-paste reg_only stickiness into playoff drafts: pool membership churn (who qualifies) is the first filter.
3. Cross-check OFF / DEF / EFF; short series make efficiency swings especially noisy.
4. Prefer the latest completed playoff run, then sanity-check against prior-pair mover patterns and expected series depth.

## Limits

- Overlap excludes players who **did not return** to the next playoff pool (not counted as leavers in retention %).
- Ranks are within-season mart ranks, not re-ranked on the overlap set alone.
- Pool sizes <250 every year; compare ranks across scopes carefully.
- Median GP 6–7 implies high noise vs regular-season evidence.
- No age / experience / size yet — those Insights come after cheap bios land.

*Evidence from five-season playoff_only fantasy score ranks (read-only mart).*
