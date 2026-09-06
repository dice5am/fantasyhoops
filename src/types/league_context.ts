import type { SeasonTypeScope } from "@/types/season_player_averages";
import type { RadarStatKey } from "@/lib/radar";

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
  bin_center: number;
  label: string;
  count: number;
};

export type LeagueContextFilters = {
  min_gp: number | null;
  min_min: number | null;
  top_pct: number | null;
};

export type LeagueContext = {
  season: string;
  season_type_scope: SeasonTypeScope;
  topPct: number;
  player_count: number;
  league_avgs: LeagueAvgs;
  leaders: Record<RadarStatKey, LeaderEntry[]>;
  fg_pct_hist: FgPctHistBin[];
  stocks_leaders: LeaderEntry[];
  filters: LeagueContextFilters;
};
