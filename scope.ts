import type { SeasonTypeScope } from "@/types/season_player_averages";
import { DEFAULT_SCOPE, DEFAULT_SEASON } from "@/lib/loadMart";
import { SEASON_OPTIONS } from "@/types/season_player_averages";

export function parseScope(v: string | null | undefined): SeasonTypeScope {
  if (v === "reg_plus_playoffs") return "reg_plus_playoffs";
  if (v === "playoff_only") return "playoff_only";
  if (v === "reg_only") return "reg_only";
  return DEFAULT_SCOPE;
}

export function parseSeason(v: string | null | undefined): string {
  if (v && (SEASON_OPTIONS as string[]).includes(v)) return v;
  return DEFAULT_SEASON;
}

export function parseSeasonsCsv(
  v: string | null | undefined,
  max = 3
): string[] {
  if (!v) return [DEFAULT_SEASON];
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (SEASON_OPTIONS as string[]).includes(s));
  const uniq = [...new Set(parts)];
  return uniq.slice(0, max);
}
