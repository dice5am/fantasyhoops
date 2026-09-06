/**
 * Home Universe presets (SCOPE CHANGE — Hybrid A1+A3).
 * Server-side filter on mart rows via avg_min. Default: all (no Home UI this BUILD; API param reserved).
 */

import type { SeasonPlayerAverage } from "@/types/season_player_averages";

export type UniverseId = "all" | "min20" | "top10min";

export const DEFAULT_UNIVERSE: UniverseId = "all";

export const UNIVERSE_OPTIONS: {
  value: UniverseId;
  label: string;
  hint: string;
}[] = [
  { value: "all", label: "All", hint: "GP ≥ 1" },
  { value: "min20", label: "≥20 min", hint: "avg_min ≥ 20" },
  { value: "top10min", label: "Top 10% min", hint: "Top decile by avg_min" },
];

export function parseUniverse(v: string | null | undefined): UniverseId {
  if (v === "all" || v === "min20" || v === "top10min") return v;
  return DEFAULT_UNIVERSE;
}

/**
 * Apply Universe preset to a season+scope mart slice.
 * - all: gp ≥ 1
 * - min20: gp ≥ 1 AND avg_min ≥ 20
 * - top10min: gp ≥ 1 AND avg_min in top decile (highest 10%)
 */
export function filterByUniverse(
  rows: SeasonPlayerAverage[],
  universe: UniverseId
): SeasonPlayerAverage[] {
  const base = rows.filter((r) => r.gp >= 1);
  if (universe === "all") return base;
  if (universe === "min20") {
    return base.filter((r) => r.avg_min >= 20);
  }
  // top10min — top decile by avg_min
  if (base.length === 0) return [];
  const sorted = [...base].sort((a, b) => b.avg_min - a.avg_min);
  const n = Math.max(1, Math.ceil(sorted.length * 0.1));
  const cutoff = sorted[n - 1]?.avg_min ?? 0;
  // Include ties at the cutoff boundary
  return base.filter((r) => r.avg_min >= cutoff);
}

export const UNIVERSE_DOC = {
  all: "GP ≥ 1 (every mart row with games played)",
  min20: "avg_min ≥ 20 (DEFAULT Home universe)",
  top10min:
    "Top decile by avg_min among GP≥1 rows for the selected season+scope (ceil(10%)); ties at cutoff included",
} as const;
