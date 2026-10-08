/**
 * Hot/cold + baseline-team marts (read-only).
 * Contract: /workspace/nba-phase1/docs/hot-cold-baseline-contract.md
 * Rules: phase-hot-cold/HOT-COLD.md · BASELINE-TEAM.md · DATA-EXIT-ALLOW.md
 * Null stays null — never coerced to 0. No new math here.
 */

/** Hot/cold stat keys as named in the mart columns. */
export const HOT_KEYS = [
  "pts",
  "ast",
  "fg3m",
  "reb",
  "stl",
  "blk",
  "tov",
  "fg_pct",
  "ft_pct",
] as const;
export type HotKey = (typeof HOT_KEYS)[number];

export const HOT_LABEL: Record<HotKey, string> = {
  pts: "PTS",
  ast: "AST",
  fg3m: "3PM",
  reb: "REB",
  stl: "STL",
  blk: "BLK",
  tov: "TOV",
  fg_pct: "FG%",
  ft_pct: "FT%",
};

/** Draft 9-cat score key → hot/cold stat key (score_fg_f1 ↔ fg_pct, score_ft_f1 ↔ ft_pct). */
export const SCORE_TO_HOT: Record<
  "pts" | "ast" | "fg3m" | "reb" | "stl" | "blk" | "tov" | "fg_f1" | "ft_f1",
  HotKey
> = {
  pts: "pts",
  ast: "ast",
  fg3m: "fg3m",
  reb: "reb",
  stl: "stl",
  blk: "blk",
  tov: "tov",
  fg_f1: "fg_pct",
  ft_f1: "ft_pct",
};

export type HotStat = {
  /** 2025-26 season value (null if missing). */
  value: number | null;
  /** GP-weighted 2023-24..2025-26 baseline (null if 0/3). */
  baseline: number | null;
  /** N of 3 seasons that entered the baseline. */
  n_seasons: number | null;
  /** Mart label, e.g. "2/3". */
  covered: string | null;
  /** Favorable percent vs own average (TOV already flipped by the mart). Null = n/a. */
  hot_pct: number | null;
};

export type PlayerHotCold = {
  player_id: string;
  full_name: string;
  gp_2025_26: number | null;
  minutes_2025_26: number | null;
  /** 20 GP and 200 min in 2025-26. False → every hot_pct and hot_read is null. */
  floor_met: boolean;
  stats: Record<HotKey, HotStat>;
  /** Equal-weight mean of finite hot_pct when ≥ 6 of 9. Null = n/a. */
  hot_read: number | null;
  n_hot_finite: number | null;
};

export const NINE_SCORE_KEYS = [
  "pts",
  "ast",
  "fg3m",
  "reb",
  "stl",
  "blk",
  "tov",
  "fg_f1",
  "ft_f1",
] as const;
export type NineScoreKey = (typeof NINE_SCORE_KEYS)[number];

export type BaselineTeamRow = {
  team_count: number;
  kind: "league_avg" | "slot";
  slot: number | null;
  rounds: number;
  roster_size: number;
  n_seasons: number;
  seasons: string[];
  /** Published-score nine-vector (0–100). */
  scores: Record<NineScoreKey, number | null>;
};

export type HotColdPayload = {
  compare_season: "2025-26";
  season_type_scope: "reg_only";
  window_seasons: string[];
  floor: { min_gp: number; min_minutes: number };
  hot_cold: {
    rows: number;
    sha256: string;
    players: Record<string, PlayerHotCold>;
  };
  baselines: {
    rows: number;
    sha256: string;
    teams: BaselineTeamRow[];
  };
};
