/**
 * Home Universe presets — within Top-250-by-MPG pool. Default: min20.
 * Apply after selectTop250ByMpg in getLeagueContext.
 */

import type { SeasonPlayerAverage } from "@/types/season_player_averages";

export type UniverseId = "all" | "min20" | "top10min";

export const DEFAULT_UNIVERSE: UniverseId = "min20";

export const UNIVERSE_OPTIONS: {
  value: UniverseId;
  label: string;
  hint: string;
}[] = [
  { value: "all", label: "All", hint: "All of top 250" },
  { value: "min20", label: "≥20 min", hint: "avg_min ≥ 20 within top 250" },
  {
    value: "top10min",
    label: "Top 10% min",
    hint: "Top 10% of the 250 by avg_min",
  },
];

export function parseUniverse(v: string | null | undefined): UniverseId {
  if (v === "all" || v === "min20" || v === "top10min") return v;
  return DEFAULT_UNIVERSE;
}

export function filterByUniverse(
  rows: SeasonPlayerAverage[],
  universe: UniverseId
): SeasonPlayerAverage[] {
  const base = rows.filter((r) => r.gp >= 1);
  if (universe === "all") return base;
  if (universe === "min20") {
    return base.filter((r) => r.avg_min >= 20);
  }
  if (base.length === 0) return [];
  const sorted = [...base].sort((a, b) => b.avg_min - a.avg_min);
  const n = Math.max(1, Math.ceil(sorted.length * 0.1));
  const cutoff = sorted[n - 1]?.avg_min ?? 0;
  return base.filter((r) => r.avg_min >= cutoff);
}

export const UNIVERSE_DOC = {
  all: "All of Top-250 pool with GP ≥ 1",
  min20: "avg_min ≥ 20 within Top-250 (DEFAULT Home universe)",
  top10min:
    "Top decile by avg_min among Top-250 GP≥1 rows (ceil(10% of pool); ties at cutoff included) ≈25 for full 250",
} as const;
