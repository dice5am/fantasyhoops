/**
 * Dense game-series contract (dense-series-v1) — live consumer types.
 *
 * Repo path (Vercel): data/marts/player_dense_game_series.parquet
 * Source publish: /workspace/nba-phase1/data/marts/player_dense_game_series.parquet
 * Contract: /workspace/nba-phase1/docs/dense-series-contract.md
 *
 * PK: (player_id, season, season_type_scope, game_index)
 * - Regular: game_index 1–82
 * - Playoffs: game_index 1–28
 * - DNP / not-reached → is_played=false; counting stats + rates null (never 0)
 * - game_id / game_date nullable on unplayed slots
 */

import type { SeasonTypeScope } from "@/types/season_player_averages";

/** Dense scopes in the contract (no reg_plus_playoffs). */
export type DenseSeasonTypeScope = "reg_only" | "playoff_only";

export interface DenseGameSeriesRow {
  player_id: string;
  full_name: string;
  season: string;
  season_type_scope: DenseSeasonTypeScope;
  /** 1–82 (reg_only) or 1–28 (playoff_only). */
  game_index: number;
  game_id: string | null;
  game_date: string | null;
  team_id: string | null;
  /** Optional denormalized abbr when present; not required by contract. */
  team_abbreviation?: string | null;
  is_played: boolean;
  /** Counting stats — null when !is_played (never coerce to 0). */
  min: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  fg3m: number | null;
  /** 0–1 rates; null when undefined / DNP. */
  fg_pct: number | null;
  ft_pct: number | null;
}

export type GetDensePlayerGamesParams = {
  player_id: string;
  seasons?: string[];
  season_type_scope?: SeasonTypeScope;
};

export const DENSE_REG_X_MAX = 82;
export const DENSE_PLAYOFF_X_MAX = 28;
