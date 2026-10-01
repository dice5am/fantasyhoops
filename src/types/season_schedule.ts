/**
 * Draft Prep schedule contract (2026-10-01).
 * SoT: /workspace/nba-phase1/docs/draft-prep-contract.md
 * Grain: one row per game. UI filter: Regular Season / season_schedule_reg_only.
 */
export type ScheduleAvailability =
  | "confirmed"
  | "time_tbd"
  | "location_tbd"
  | "scheduled_incomplete"
  | "final";

export type SeasonScheduleRow = {
  season: string;
  season_type: string;
  game_id: string;
  game_date: string;
  game_time: string | null;
  matchup: string;
  location: string | null;
  availability: ScheduleAvailability;
  home_team_abbreviation: string | null;
  away_team_abbreviation: string | null;
  game_label: string | null;
};

export type SeasonSchedulePayload = {
  season: string;
  season_type_scope: "reg_only";
  row_count: number;
  rows: SeasonScheduleRow[];
  parquet_path: string;
};
