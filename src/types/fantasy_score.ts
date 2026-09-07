/**
 * Fantasy score mart — fantasy-score-v1
 * Contract: docs/FANTASY_SCORE.md (mirrors /workspace/nba-phase1/docs/FANTASY_SCORE.md)
 * Mart: data/marts/player_fantasy_scores.parquet
 * Env: NBA_FANTASY_SCORE_PATH
 *
 * Scores/ranks are Data math. For Home topPct < 100, Dashboard re-runs
 * score_pool on the narrowed pool (port of scripts/fantasy_score.py) —
 * never reuse full-250 ranks after narrowing.
 */

import type { SeasonTypeScope } from "@/types/season_player_averages";

export const FANTASY_SCORE_CONTRACT_VERSION = "fantasy-score-v1";

/** Raw inputs + scored columns for one player in an active pool. */
export interface PlayerFantasyScore {
  player_id: string;
  full_name: string;
  season: string;
  season_type_scope: SeasonTypeScope;
  gp: number;
  avg_min: number;

  avg_pts: number;
  avg_ast: number;
  avg_fg3m: number;
  avg_reb: number;
  avg_stl: number;
  avg_blk: number;
  avg_tov: number;
  fg_pct: number | null;
  ft_pct: number | null;
  sum_fga: number;
  sum_fta: number;

  pool_size: number;
  pool_n_cap: number;
  pool_mu_fg_pct: number;
  pool_mu_ft_pct: number;
  fg_f1_impact: number;
  ft_f1_impact: number;

  score_pts: number;
  score_ast: number;
  score_fg3m: number;
  score_reb: number;
  score_stl: number;
  score_blk: number;
  score_tov: number;
  score_fg_f1: number;
  score_ft_f1: number;
  score_off: number;
  score_def: number;
  score_eff: number;
  score_o1: number;

  rank_o1: number;
  rank_off: number;
  rank_def: number;
  rank_eff: number;
  rank_pts: number;
  rank_ast: number;
  rank_fg3m: number;
  rank_reb: number;
  rank_stl: number;
  rank_blk: number;
  rank_tov: number;
  rank_fg_f1: number;
  rank_ft_f1: number;
}

/** Raw inputs needed to re-run score_pool (topPct narrow). */
export type FantasyScoreRawInput = Pick<
  PlayerFantasyScore,
  | "player_id"
  | "full_name"
  | "season"
  | "season_type_scope"
  | "gp"
  | "avg_min"
  | "avg_pts"
  | "avg_ast"
  | "avg_fg3m"
  | "avg_reb"
  | "avg_stl"
  | "avg_blk"
  | "avg_tov"
  | "fg_pct"
  | "ft_pct"
  | "sum_fga"
  | "sum_fta"
>;

export interface FantasyScorePoolMeta {
  season: string;
  season_type_scope: SeasonTypeScope;
  topPct: number;
  player_count: number;
  pool_size: number;
  pool_n_cap: number;
  mart_available: boolean;
  parquet_path: string;
  contract_version: string;
  /** true when topPct < 100 and scores were recomputed via score_pool */
  rescored: boolean;
  pool_mu_fg_pct: number | null;
  pool_mu_ft_pct: number | null;
}

export interface FantasyScoreHistBin {
  label: string;
  mid: number;
  count: number;
}

export interface FantasyScoresPayload {
  meta: FantasyScorePoolMeta;
  rows: PlayerFantasyScore[];
  /** O1 histogram bins (active pool). */
  o1_hist: FantasyScoreHistBin[];
  /** EFF histogram bins. */
  eff_hist: FantasyScoreHistBin[];
  /** GP-weighted pool means of raw 9-cat inputs (for radar). */
  pool_avgs: {
    pts: number | null;
    ast: number | null;
    fg3m: number | null;
    reb: number | null;
    stl: number | null;
    blk: number | null;
    fg_pct: number | null;
    ft_pct: number | null;
    tov: number | null;
  };
}

export type GetFantasyScoresParams = {
  season?: string;
  season_type_scope?: SeasonTypeScope;
  topPct?: number | string;
};

export type ScoreBoardKey = "o1" | "off" | "def" | "eff";
