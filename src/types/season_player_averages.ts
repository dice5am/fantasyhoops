/**
 * LOCKED contract (2026-09-02): season_player_averages (Data Engineer)
 *
 * PK: (player_id, season, season_type_scope)
 * Publish: data/marts/season_player_averages.parquet via DuckDB
 *
 * Phase 2: season_type_scope includes playoff_only (Playoffs only, NO Play-In — lock A).
 * Phase 3: Player charts + 9-cat; mart avg_fg3m only (no sum_fg3m/gp fallback).
 * Mart may lag behind UI options; missing season/scope → empty rows, no crash.
 */

export type SeasonTypeScope =
  | "reg_only"
  | "reg_plus_playoffs"
  | "playoff_only";

/** Supported season selector values. */
export type SeasonId = "2023-24" | "2024-25" | "2025-26";

export const SEASON_OPTIONS: SeasonId[] = ["2023-24", "2024-25", "2025-26"];

export const SCOPE_OPTIONS: {
  value: SeasonTypeScope;
  label: string;
}[] = [
  { value: "reg_only", label: "Regular only" },
  { value: "reg_plus_playoffs", label: "Reg + Playoffs" },
  { value: "playoff_only", label: "Playoffs only" },
];

/** Human labels for chart scope (Phase 3). */
export const SCOPE_CHART_LABELS: Record<SeasonTypeScope, string> = {
  reg_only: "Regular Season",
  reg_plus_playoffs: "RS+PlayIn+Playoffs",
  playoff_only: "Playoffs only",
};

/** Single row matching the locked mart shape. */
export interface SeasonPlayerAverage {
  /** String player id (e.g. "201939"). */
  player_id: string;
  /** Denormalized on the mart — no separate players join required for display. */
  full_name: string;
  /** e.g. "2025-26" */
  season: string;
  season_type_scope: SeasonTypeScope;
  /** Games played; conceptually gp > 0 for rows in this mart. */
  gp: number;
  avg_min: number;
  avg_pts: number;
  avg_reb: number;
  avg_ast: number;
  avg_stl: number;
  avg_blk: number;
  avg_tov: number;
  /**
   * Phase 3 9-cat 3PM: mart avg_fg3m only (no sum_fg3m/gp fallback).
   */
  avg_fg3m: number;
  /** Optional audit sum; ignored for 3PM display. */
  sum_fg3m?: number | null;
  /**
   * LOCKED: shooting percentages are 0–1 floats (e.g. 0.462 = 46.2%).
   * UI multiplies by 100 for display; 1 decimal on displayed %.
   * Undefined rates (e.g. no 3PA) are null, never 0.
   */
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
}

export interface GetSeasonPlayerAveragesParams {
  season?: string;
  season_type_scope?: SeasonTypeScope;
  player_id?: string;
}

export interface PlayerDirectoryEntry {
  player_id: string;
  full_name: string;
}

/** Curated game-log row for Phase 3 charts (min > 0 filtered by loader). */
export interface PlayerGameLog {
  game_id: string;
  player_id: string;
  full_name: string;
  season: string;
  season_type: string;
  game_date: string;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  fg_pct: number | null;
  ft_pct: number | null;
  team_id: string;
  team_abbreviation: string;
}

/** Chart Y-axis stat keys (Phase 3). */
export type ChartStat =
  | "pts"
  | "ast"
  | "fg3m"
  | "reb"
  | "stl"
  | "blk"
  | "tov"
  | "fg_pct"
  | "ft_pct";

export const CHART_STAT_OPTIONS: {
  value: ChartStat;
  label: string;
  kind: "counting" | "rate";
}[] = [
  { value: "pts", label: "PTS", kind: "counting" },
  { value: "ast", label: "AST", kind: "counting" },
  { value: "fg3m", label: "3PM", kind: "counting" },
  { value: "reb", label: "REB", kind: "counting" },
  { value: "stl", label: "STL", kind: "counting" },
  { value: "blk", label: "BLK", kind: "counting" },
  { value: "tov", label: "TOV", kind: "counting" },
  { value: "fg_pct", label: "FG%", kind: "rate" },
  { value: "ft_pct", label: "FT%", kind: "rate" },
];
