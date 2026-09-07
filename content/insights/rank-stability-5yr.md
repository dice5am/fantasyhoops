---
title: How sticky are fantasy ranks year to year?
date: 2026-09-07
slug: rank-stability-5yr
summary: Across five seasons, overall O1 ranks in the top-250 minutes pool correlate ~0.77 YoY — useful anchors, not locks. OFF/DEF stick more than EFF.
author: NBA Fantasy Analyst
tags: [fantasy, ranks, stability]
status: ready
---

# How sticky are fantasy ranks year to year?

**Takeaway:** Prior-season **O1** rank is a solid draft anchor inside the top-250 minutes pool, not a lock. Year-over-year Spearman ρ for overall rank runs about **0.72–0.83** (average **~0.77**). Roughly **two-thirds to four-fifths** of overlapping top-50 players stay top-50; the typical absolute O1 move is about **24–30** spots.

## Method

- **Source:** player_fantasy_scores mart (read-only).
- **Scope:** reg_only only.
- **Pool:** top-250 by average minutes (already in the mart).
- **Seasons:** 2021-22 → 2025-26.
- **Universe:** players in **both** seasons’ pools for each consecutive pair.
- **Metrics:** Spearman ρ on overall / offense / defense / efficiency ranks; share staying top-50 / top-100 by O1; median absolute O1 rank change.

Rank columns used:

```
rank_o1, rank_off, rank_def, rank_eff
```

### Median GP (reg_only)

| Season | Median GP |
| --- | ---: |
| 2021-22 | 66.0 |
| 2022-23 | 67.0 |
| 2023-24 | 68.5 |
| 2024-25 | 65.0 |
| 2025-26 | 64.5 |

**2025-26 does not look partial** on median GP alone (in line with prior full seasons).

## Consecutive-pair summary

| Pair | n overlap | ρ O1 | ρ OFF | ρ DEF | ρ EFF | Stay top-50 | Stay top-100 | Med abs ΔO1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2021-22→2022-23 | 185 | 0.83 | 0.90 | 0.90 | 0.72 | 81% | 79% | 24 |
| 2022-23→2023-24 | 196 | 0.80 | 0.88 | 0.86 | 0.76 | 70% | 79% | 28 |
| 2023-24→2024-25 | 197 | 0.74 | 0.86 | 0.83 | 0.74 | 68% | 83% | 30 |
| 2024-25→2025-26 | 171 | 0.72 | 0.82 | 0.86 | 0.67 | 66% | 75% | 29 |

### Patterns

- **OFF and DEF ranks stick more** than overall O1; **EFF is the least sticky**.
- Stickiness **softens slightly** toward more recent pairs (ρ O1 0.83 → 0.72).
- Latest pair has the **smallest overlap** (n = 171).

## Example movers (negative Δ = improved O1 rank)

Illustrative — role, injury, and minutes can dominate “skill” swings:

- **Big risers:** Christian Braun (−185, 2023-24→2024-25), Nickeil Alexander-Walker (−183, 2024-25→2025-26), Dyson Daniels (−138), Collin Sexton (−119).
- **Big fallers:** Terry Rozier (+177), Andrew Wiggins (+143 in 2022-23→2023-24), Jordan Poole (+147 in 2024-25→2025-26), Joel Embiid (+72 from rank 5 — availability risk).

## What it means for drafting

1. Start from last season’s **O1**, then budget for ~**mid-20s to ~30** median reshuffling inside the pool.
2. Cross-check **OFF / DEF / EFF** — defensive stickiness can diverge from overall.
3. Don’t overpay solely on last year’s rank; top-50 churn is real even when top-100 retention looks healthier.
4. Prefer the latest full season as the primary prior, then sanity-check against prior-pair mover patterns.

## Limits

- Overlap excludes players who **fell out of the top-250 minutes pool** (not counted as “leavers” in retention %).
- Ranks are within-season mart ranks, not re-ranked on the overlap set alone.
- No age / experience / size yet — those Insights come after cheap bios land.
- Playoff-only stability is a separate question (not in this post).

*Evidence from five-season reg_only top-250 fantasy score ranks.*
