/**
 * Draft v3 tiers (Analyst, 2026-10-09): Jenks natural breaks on overall (O1) for the top 200 on the
 * board, separately for Last (2025-26) and 3yr. Source: phase-insights-analysis/tiers.json.
 * MIN_SCORE[i] is the lowest O1 in tier i+1 (midpoint of the gap). Below the last cutoff is tier 6.
 * RANGES are the actual score ranges for the headers (not the cutoffs). Not computed on the page.
 */
export type TierView = "last" | "three_yr";

export const TIER_MIN_SCORE: Record<TierView, number[]> = {
  last: [53.962, 47.908, 44.454, 41.62, 38.986],
  three_yr: [54.992, 48.601, 44.688, 41.551, 38.772],
};

export const TIER_RANGES: Record<TierView, [string, string][]> = {
  last: [
    ["55.5", "62.9"],
    ["48.2", "52.4"],
    ["44.6", "47.6"],
    ["41.7", "44.4"],
    ["39.1", "41.6"],
    ["36.4", "38.9"],
  ],
  three_yr: [
    ["55.7", "62.6"],
    ["48.9", "54.3"],
    ["44.8", "48.3"],
    ["41.7", "44.6"],
    ["38.8", "41.4"],
    ["36.1", "38.8"],
  ],
};

/** 1-based tier for an overall score in this view. */
export function tierOf(o1: number, view: TierView): number {
  const cuts = TIER_MIN_SCORE[view];
  for (let i = 0; i < cuts.length; i++) if (o1 >= cuts[i]) return i + 1;
  return cuts.length + 1;
}
