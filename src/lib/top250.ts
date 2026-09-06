/**
 * Product universe: Top 250 players by MPG for a season+scope mart slice.
 * Full mart stays intact; user-visible Home / averages list / search use this pool.
 * Ranking (exact): avg_min DESC → gp DESC → player_id ASC. Then take 250.
 * Universe presets (all / min20 / top10min) apply *within* this pool.
 */

import type { SeasonPlayerAverage } from "@/types/season_player_averages";

export const TOP_250_SIZE = 250;

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

export function top250IdSet(rows: SeasonPlayerAverage[]): Set<string> {
  return new Set(selectTop250ByMpg(rows).map((r) => r.player_id));
}

export const TOP_250_DOC =
  "Top 250 by avg_min DESC, tie-break gp DESC then player_id ASC; Universe filters apply within this pool";
