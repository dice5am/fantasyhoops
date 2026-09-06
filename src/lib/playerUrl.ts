import type { SeasonId, SeasonTypeScope } from "@/types/season_player_averages";
import { SEASON_OPTIONS } from "@/types/season_player_averages";

export type ChartStatKey =
  | "pts"
  | "ast"
  | "fg3m"
  | "reb"
  | "stl"
  | "blk"
  | "fg_pct"
  | "ft_pct"
  | "tov";

const STAT_KEYS = new Set<ChartStatKey>([
  "pts",
  "ast",
  "fg3m",
  "reb",
  "stl",
  "blk",
  "fg_pct",
  "ft_pct",
  "tov",
]);

const SEASON_SET = new Set<string>(SEASON_OPTIONS);

export function parseSeasonsParam(raw: string | null): SeasonId[] | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => SEASON_SET.has(s)) as SeasonId[];
  const uniq: SeasonId[] = [];
  for (const s of parts) {
    if (!uniq.includes(s)) uniq.push(s);
    if (uniq.length >= 3) break;
  }
  return uniq.length ? uniq : null;
}

/** reg_plus_playoffs → reg_only (UI lock). */
export function parseScopeParam(raw: string | null): SeasonTypeScope | null {
  if (!raw) return null;
  if (raw === "playoff_only") return "playoff_only";
  if (raw === "reg_only") return "reg_only";
  if (raw === "reg_plus_playoffs") return "reg_only";
  return null;
}

export function parseStatParam(raw: string | null): ChartStatKey | null {
  if (!raw) return null;
  return STAT_KEYS.has(raw as ChartStatKey) ? (raw as ChartStatKey) : null;
}

export function buildPlayerUrl(opts: {
  player_id?: string | null;
  name?: string | null;
  seasons: SeasonId[];
  scope: SeasonTypeScope;
  stat: ChartStatKey;
}): string {
  const params = new URLSearchParams();
  if (opts.player_id) params.set("player_id", String(opts.player_id));
  if (opts.name && opts.name !== "…") params.set("name", opts.name);
  params.set("seasons", opts.seasons.join(","));
  // Never write reg_plus_playoffs into the URL
  const scope =
    opts.scope === "reg_plus_playoffs" ? "reg_only" : opts.scope;
  params.set("scope", scope);
  params.set("stat", opts.stat);
  const q = params.toString();
  return q ? `/player?${q}` : "/player";
}
