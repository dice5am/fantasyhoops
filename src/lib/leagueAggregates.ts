/**
 * Accurate league aggregations from mart rows (Hybrid A1+A3 / SCOPE ADD).
 *
 * Formulas (documented in docs/HOME_VIZ.md):
 * - Counting (pts/reb/ast/stl/blk/tov/fg3m/min): GP-weighted
 *     Σ(avg_* × gp) / Σ(gp)
 * - FG% / FT%: shot-weighted
 *     Σ sum_fgm / Σ sum_fga   and   Σ sum_ftm / Σ sum_fta
 *     NEVER mean-of-means (avg of fg_pct / ft_pct)
 * - 3PM: GP-weighted avg_fg3m ONLY — HARD GUARD, never sum_fg3m/gp
 */

import type { SeasonPlayerAverage } from "@/types/season_player_averages";
import type { RadarStatKey } from "@/lib/radar";
import {
  FALLBACK_CHART_STROKE,
  getTeamColors,
  isTeamAbbr,
} from "@/lib/teamColors";

/** Default min GP for leaders / hist (filter-ready; no UI slider this BUILD). */
export const DEFAULT_MIN_GP = 10;

export type LeaderEntry = {
  player_id: string;
  full_name: string;
  value: number;
  gp: number;
  team_abbreviation: string | null;
  chart_color: string;
};

export type LeagueAvgs = Record<RadarStatKey, number | null>;

export type FgPctHistBin = {
  /** Bin center as 0–1 rate */
  bin_center: number;
  /** Display label e.g. "40–45%" */
  label: string;
  count: number;
};

export type LeagueAggregateFilters = {
  /** Min games played; reserved for future UI. Default 0 for league avgs. */
  min_gp?: number;
  /** Min avg minutes; reserved — unused this BUILD (requires avg_min filter). */
  min_min?: number;
  /** Keep top N% by a ranking key; reserved — unused this BUILD. */
  top_pct?: number;
};

const COUNTING_KEYS = [
  "pts",
  "ast",
  "fg3m",
  "reb",
  "stl",
  "blk",
  "tov",
] as const;

export const ALL_RADAR_KEYS: RadarStatKey[] = [
  "pts",
  "ast",
  "fg3m",
  "reb",
  "stl",
  "blk",
  "fg_pct",
  "ft_pct",
  "tov",
];

function rowAvg(row: SeasonPlayerAverage, key: RadarStatKey): number | null {
  switch (key) {
    case "pts":
      return row.avg_pts;
    case "ast":
      return row.avg_ast;
    case "fg3m":
      // HARD GUARD: mart avg_fg3m only — NEVER sum_fg3m/gp
      return row.avg_fg3m ?? null;
    case "reb":
      return row.avg_reb;
    case "stl":
      return row.avg_stl;
    case "blk":
      return row.avg_blk;
    case "fg_pct":
      return row.fg_pct;
    case "ft_pct":
      return row.ft_pct;
    case "tov":
      return row.avg_tov;
    default:
      return null;
  }
}

function applyRowFilters(
  rows: SeasonPlayerAverage[],
  filters?: LeagueAggregateFilters
): SeasonPlayerAverage[] {
  const minGp = filters?.min_gp ?? 0;
  const minMin = filters?.min_min;
  let out = rows.filter((r) => r.gp > 0 && r.gp >= minGp);
  if (minMin != null && minMin > 0) {
    out = out.filter((r) => r.avg_min >= minMin);
  }
  // top_pct reserved — no-op this BUILD (shape documented for future)
  void filters?.top_pct;
  return out;
}

/**
 * GP-weighted counting + sum/sum shooting rates for a filtered mart slice.
 */
export function computeLeagueAvgs(
  rows: SeasonPlayerAverage[],
  filters?: LeagueAggregateFilters
): LeagueAvgs {
  const filtered = applyRowFilters(rows, filters);
  let gpSum = 0;
  const weighted: Record<(typeof COUNTING_KEYS)[number], number> = {
    pts: 0,
    ast: 0,
    fg3m: 0,
    reb: 0,
    stl: 0,
    blk: 0,
    tov: 0,
  };
  let sumFgm = 0;
  let sumFga = 0;
  let sumFtm = 0;
  let sumFta = 0;
  let fg3mGp = 0;

  for (const r of filtered) {
    const gp = r.gp;
    gpSum += gp;
    weighted.pts += r.avg_pts * gp;
    weighted.ast += r.avg_ast * gp;
    weighted.reb += r.avg_reb * gp;
    weighted.stl += r.avg_stl * gp;
    weighted.blk += r.avg_blk * gp;
    weighted.tov += r.avg_tov * gp;
    // 3PM: GP-weighted avg_fg3m only (not sum_fg3m/gp)
    if (r.avg_fg3m != null && !Number.isNaN(Number(r.avg_fg3m))) {
      weighted.fg3m += Number(r.avg_fg3m) * gp;
      fg3mGp += gp;
    }
    if (r.sum_fgm != null) sumFgm += r.sum_fgm;
    if (r.sum_fga != null) sumFga += r.sum_fga;
    if (r.sum_ftm != null) sumFtm += r.sum_ftm;
    if (r.sum_fta != null) sumFta += r.sum_fta;
  }

  return {
    pts: gpSum > 0 ? weighted.pts / gpSum : null,
    ast: gpSum > 0 ? weighted.ast / gpSum : null,
    fg3m: fg3mGp > 0 ? weighted.fg3m / fg3mGp : null,
    reb: gpSum > 0 ? weighted.reb / gpSum : null,
    stl: gpSum > 0 ? weighted.stl / gpSum : null,
    blk: gpSum > 0 ? weighted.blk / gpSum : null,
    tov: gpSum > 0 ? weighted.tov / gpSum : null,
    fg_pct: sumFga > 0 ? sumFgm / sumFga : null,
    ft_pct: sumFta > 0 ? sumFtm / sumFta : null,
  };
}

function colorFor(
  playerId: string,
  teamByPlayer?: Map<string, string>
): { abbr: string | null; color: string } {
  const abbr = teamByPlayer?.get(playerId) ?? null;
  if (abbr && isTeamAbbr(abbr)) {
    const token = getTeamColors(abbr);
    return { abbr, color: token?.chartPrimary ?? FALLBACK_CHART_STROKE };
  }
  return {
    abbr: abbr && abbr.length ? abbr : null,
    color: FALLBACK_CHART_STROKE,
  };
}

export function computeTopLeaders(
  rows: SeasonPlayerAverage[],
  key: RadarStatKey,
  opts?: {
    limit?: number;
    min_gp?: number;
    teamByPlayer?: Map<string, string>;
    /** When true, lower value ranks higher (TOV). */
    ascending?: boolean;
  }
): LeaderEntry[] {
  const limit = opts?.limit ?? 5;
  const minGp = opts?.min_gp ?? DEFAULT_MIN_GP;
  // Lock: top-5 sort by displayed avg DESC (TOV included — lower better on radar only).
  const ascending = opts?.ascending ?? key === "tov";
  const eligible = rows.filter((r) => r.gp >= minGp);
  const scored = eligible
    .map((r) => {
      const value = rowAvg(r, key);
      return value == null || Number.isNaN(value) ? null : { row: r, value };
    })
    .filter((x): x is { row: SeasonPlayerAverage; value: number } => x != null);
  scored.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value));
  return scored.slice(0, limit).map(({ row, value }) => {
    const { abbr, color } = colorFor(row.player_id, opts?.teamByPlayer);
    return {
      player_id: row.player_id,
      full_name: row.full_name,
      value,
      gp: row.gp,
      team_abbreviation: abbr,
      chart_color: color,
    };
  });
}

/** FG% histogram bins from 30%–70% in 5pp steps. */
export function computeFgPctHistogram(
  rows: SeasonPlayerAverage[],
  opts?: { min_gp?: number }
): FgPctHistBin[] {
  const minGp = opts?.min_gp ?? DEFAULT_MIN_GP;
  const histEligible = rows.filter(
    (r) => r.gp >= minGp && r.fg_pct != null && !Number.isNaN(r.fg_pct)
  );
  const binEdges: number[] = [];
  for (let p = 0.3; p <= 0.7 + 1e-9; p += 0.05) {
    binEdges.push(Number(p.toFixed(2)));
  }
  const counts = new Array(binEdges.length - 1).fill(0);
  for (const r of histEligible) {
    const v = r.fg_pct as number;
    let placed = false;
    for (let i = 0; i < binEdges.length - 1; i++) {
      const lo = binEdges[i];
      const hi = binEdges[i + 1];
      if (v >= lo && (i === binEdges.length - 2 ? v <= hi : v < hi)) {
        counts[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (v < binEdges[0]) counts[0] += 1;
      else counts[counts.length - 1] += 1;
    }
  }
  return counts.map((count, i) => {
    const lo = binEdges[i];
    const hi = binEdges[i + 1];
    return {
      bin_center: (lo + hi) / 2,
      label: `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`,
      count,
    };
  });
}

/** Stocks = avg_stl + avg_blk. */
export function computeStocksLeaders(
  rows: SeasonPlayerAverage[],
  opts?: {
    limit?: number;
    min_gp?: number;
    teamByPlayer?: Map<string, string>;
  }
): LeaderEntry[] {
  const limit = opts?.limit ?? 5;
  const minGp = opts?.min_gp ?? DEFAULT_MIN_GP;
  const scored = rows
    .filter((r) => r.gp >= minGp)
    .map((r) => ({ row: r, value: r.avg_stl + r.avg_blk }));
  scored.sort((a, b) => b.value - a.value);
  return scored.slice(0, limit).map(({ row, value }) => {
    const { abbr, color } = colorFor(row.player_id, opts?.teamByPlayer);
    return {
      player_id: row.player_id,
      full_name: row.full_name,
      value,
      gp: row.gp,
      team_abbreviation: abbr,
      chart_color: color,
    };
  });
}

export type LeagueContextPayload = {
  season: string;
  season_type_scope: string;
  universe: string;
  player_count: number;
  league_avgs: LeagueAvgs;
  leaders: Record<RadarStatKey, LeaderEntry[]>;
  fg_pct_hist: FgPctHistBin[];
  stocks_leaders: LeaderEntry[];
  /** Echo of reserved filter params (may be null / default). */
  filters: {
    min_gp: number | null;
    min_min: number | null;
    top_pct: number | null;
  };
};

/**
 * Build full Home league context from mart rows + optional team map.
 * Caller should Universe-filter rows first (filterByUniverse).
 */
export function buildLeagueContext(
  rows: SeasonPlayerAverage[],
  opts: {
    season: string;
    season_type_scope: string;
    universe?: string;
    teamByPlayer?: Map<string, string>;
    /** Reserved filters stacked on Universe-prefiltered rows. */
    filters?: LeagueAggregateFilters;
    leader_min_gp?: number;
  }
): LeagueContextPayload {
  const leaderMinGp = opts.leader_min_gp ?? DEFAULT_MIN_GP;
  const filtered = applyRowFilters(rows, {
    min_gp: opts.filters?.min_gp ?? 0,
    min_min: opts.filters?.min_min,
    top_pct: opts.filters?.top_pct,
  });
  const league_avgs = computeLeagueAvgs(filtered, { min_gp: 0 });

  const leaders = {} as Record<RadarStatKey, LeaderEntry[]>;
  for (const k of ALL_RADAR_KEYS) {
    leaders[k] = computeTopLeaders(filtered, k, {
      min_gp: leaderMinGp,
      teamByPlayer: opts.teamByPlayer,
    });
  }

  return {
    season: opts.season,
    season_type_scope: opts.season_type_scope,
    universe: opts.universe ?? "all",
    player_count: filtered.length,
    league_avgs,
    leaders,
    fg_pct_hist: computeFgPctHistogram(filtered, { min_gp: leaderMinGp }),
    stocks_leaders: computeStocksLeaders(filtered, {
      min_gp: leaderMinGp,
      teamByPlayer: opts.teamByPlayer,
    }),
    filters: {
      min_gp: opts.filters?.min_gp ?? null,
      min_min: opts.filters?.min_min ?? null,
      top_pct: opts.filters?.top_pct ?? null,
    },
  };
}
