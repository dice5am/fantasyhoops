/**
 * Product pool: Top 250 players by MPG for a season+scope mart slice.
 * Full mart stays intact; user-visible Home / averages list / search use this pool.
 * Ranking: avg_min DESC → gp DESC → player_id ASC. Then take 250.
 * Home topPct slider further narrows within this pool.
 */

import type { SeasonPlayerAverage } from "@/types/season_player_averages";

export const TOP_250_SIZE = 250;

export const DEFAULT_TOP_PCT = 100;
export const TOP_PCT_MIN = 10;
export const TOP_PCT_MAX = 100;
export const TOP_PCT_STEP = 5;

/**
 * Select top 250 by MPG from a season+scope slice (already filtered).
 * Tie-break: GP DESC, then player_id ASC (string, numeric-aware).
 */
export function selectTop250ByMpg(
  rows: SeasonPlayerAverage[]
): SeasonPlayerAverage[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.avg_min !== a.avg_min) return b.avg_min - a.avg_min;
    if (b.gp !== a.gp) return b.gp - a.gp;
    return a.player_id.localeCompare(b.player_id, "en", { numeric: true });
  });
  return sorted.slice(0, TOP_250_SIZE);
}

/** Id set for membership checks (deep-link / soft note). */
export function top250IdSet(rows: SeasonPlayerAverage[]): Set<string> {
  return new Set(selectTop250ByMpg(rows).map((r) => r.player_id));
}

/**
 * Parse Home `?topPct=` (integer %). Default 100.
 * Clamps to [10, 100]. Slider prefers step 5; off-step URL ints still accepted.
 */
export function parseTopPct(v: string | null | undefined): number {
  if (v == null || v === "") return DEFAULT_TOP_PCT;
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_TOP_PCT;
  return Math.min(TOP_PCT_MAX, Math.max(TOP_PCT_MIN, Math.round(n)));
}

/** How many players to keep: ceil(250 * topPct/100), min 1. */
export function topPctCount(topPct: number): number {
  const pct = Math.min(TOP_PCT_MAX, Math.max(1, Math.round(topPct)));
  return Math.max(1, Math.ceil(TOP_250_SIZE * (pct / 100)));
}

/**
 * After selectTop250ByMpg: keep top ceil(250 * topPct/100) (min 1)
 * by the same avg_min ranking (pool is already sorted that way).
 */
export function filterByTopPct(
  top250: SeasonPlayerAverage[],
  topPct: number
): SeasonPlayerAverage[] {
  const n = topPctCount(topPct);
  return top250.slice(0, Math.min(n, top250.length));
}

export function topPctLabel(topPct: number, playerCount: number): string {
  return `Top ${topPct}% · ${playerCount} players`;
}

export const TOP_250_DOC =
  "Top 250 by avg_min DESC, tie-break gp DESC then player_id ASC; topPct slider narrows within this pool";
