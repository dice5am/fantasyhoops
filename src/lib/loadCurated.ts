import { readFileSync } from "fs";
import { parquetReadObjects } from "hyparquet";
import type {
  PlayerGameLog,
  SeasonTypeScope,
} from "@/types/season_player_averages";

import path from "path";

const DEFAULT_CURATED = path.join(process.cwd(), "data/curated/player_game_logs.parquet");

function curatedPath(): string {
  return process.env.NBA_CURATED_PATH || DEFAULT_CURATED;
}

function toNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v);
}

function toNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  const n = toNumber(v);
  return Number.isNaN(n) ? null : n;
}

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    // Already ISO or date-like
    if (v.length >= 10) return v.slice(0, 10);
    return v;
  }
  return String(v);
}

/**
 * Scope → curated season_type filter (lock):
 * - reg_only → Regular Season only
 * - reg_plus_playoffs → Regular Season + PlayIn + Playoffs
 * - playoff_only → Playoffs only (NO PlayIn)
 */
export function seasonTypesForScope(scope: SeasonTypeScope): string[] {
  switch (scope) {
    case "reg_only":
      return ["Regular Season"];
    case "reg_plus_playoffs":
      return ["Regular Season", "PlayIn", "Playoffs"];
    case "playoff_only":
      return ["Playoffs"];
    default:
      return ["Regular Season"];
  }
}

function mapGame(raw: Record<string, unknown>): PlayerGameLog {
  return {
    game_id: String(raw.game_id),
    player_id: String(raw.player_id),
    full_name: String(raw.full_name),
    season: String(raw.season),
    season_type: String(raw.season_type),
    game_date: toIsoDate(raw.game_date),
    min: toNumber(raw.min),
    pts: toNumber(raw.pts),
    reb: toNumber(raw.reb),
    ast: toNumber(raw.ast),
    stl: toNumber(raw.stl),
    blk: toNumber(raw.blk),
    tov: toNumber(raw.tov),
    fg3m: toNumber(raw.fg3m),
    fg_pct: toNullableNumber(raw.fg_pct),
    ft_pct: toNullableNumber(raw.ft_pct),
    team_id: String(raw.team_id ?? ""),
    team_abbreviation: String(raw.team_abbreviation ?? ""),
  };
}

export type GetPlayerGamesParams = {
  player_id: string;
  scope?: SeasonTypeScope;
  /** Max 3 seasons enforced by caller / API. */
  seasons?: string[];
};

/**
 * Game-by-game rows from curated player_game_logs.
 * Skips rows with min ≤ 0 (lock). Filters by scope + seasons.
 */
export async function getPlayerGames(
  params: GetPlayerGamesParams
): Promise<PlayerGameLog[]> {
  const scope = params.scope ?? "reg_only";
  const allowedTypes = new Set(seasonTypesForScope(scope));
  const seasonSet =
    params.seasons && params.seasons.length > 0
      ? new Set(params.seasons)
      : null;

  const path = curatedPath();
  const buf = readFileSync(path);
  const file = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  const objects = await parquetReadObjects({ file });

  const rows: PlayerGameLog[] = [];
  let skippedMin = 0;
  for (const obj of objects) {
    const raw = obj as Record<string, unknown>;
    if (String(raw.player_id) !== String(params.player_id)) continue;
    if (!allowedTypes.has(String(raw.season_type))) continue;
    if (seasonSet && !seasonSet.has(String(raw.season))) continue;

    const min = toNumber(raw.min);
    if (!(min > 0)) {
      skippedMin += 1;
      continue;
    }
    rows.push(mapGame(raw));
  }

  rows.sort((a, b) => {
    if (a.game_date < b.game_date) return -1;
    if (a.game_date > b.game_date) return 1;
    return a.game_id.localeCompare(b.game_id);
  });

  // Attach skip count for verify/debug via symbol-free property on array
  (rows as PlayerGameLog[] & { _skipped_min_le_0?: number })._skipped_min_le_0 =
    skippedMin;

  return rows;
}

export { curatedPath, DEFAULT_CURATED };
