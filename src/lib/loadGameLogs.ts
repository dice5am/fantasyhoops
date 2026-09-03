import { readFileSync, statSync } from "fs";
import { parquetReadObjects } from "hyparquet";
import type {
  PlayerGameLog,
  SeasonTypeScope,
} from "@/types/season_player_averages";

import path from "path";

const DEFAULT_LOGS = path.join(process.cwd(), "data/curated/player_game_logs.parquet");

export type { PlayerGameLog };

let logsCache: {
  path: string;
  mtimeMs: number;
  rows: PlayerGameLog[];
} | null = null;

function logsPath(): string {
  return process.env.NBA_CURATED_PATH || process.env.NBA_GAME_LOGS_PATH || DEFAULT_LOGS;
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

function formatGameDate(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function mapRow(raw: Record<string, unknown>): PlayerGameLog {
  return {
    game_id: String(raw.game_id ?? ""),
    player_id: String(raw.player_id),
    full_name: String(raw.full_name ?? ""),
    season: String(raw.season),
    season_type: String(raw.season_type),
    game_date: formatGameDate(raw.game_date),
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
  };
}

async function loadAllLogs(): Promise<PlayerGameLog[]> {
  const path = logsPath();
  const st = statSync(path);
  if (
    logsCache &&
    logsCache.path === path &&
    logsCache.mtimeMs === st.mtimeMs
  ) {
    return logsCache.rows;
  }

  const buf = readFileSync(path);
  const file = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  const objects = await parquetReadObjects({ file });
  const rows = objects.map((o) => mapRow(o as Record<string, unknown>));
  logsCache = { path, mtimeMs: st.mtimeMs, rows };
  return rows;
}

/** Map UI scope → season_type filter on curated game logs. */
export function seasonTypesForScope(scope: SeasonTypeScope): string[] | null {
  switch (scope) {
    case "reg_only":
      return ["Regular Season"];
    case "playoff_only":
      return ["Playoffs"];
    case "reg_plus_playoffs":
      return ["Regular Season", "PlayIn", "Playoffs"];
    default:
      return ["Regular Season"];
  }
}

export type GetPlayerGamesParams = {
  player_id: string;
  seasons?: string[];
  season_type_scope?: SeasonTypeScope;
};

/**
 * Game-by-game logs for a player from curated parquet.
 * Skips min <= 0. Default scope = reg_only.
 */
export async function getPlayerGameLogs(
  params: GetPlayerGamesParams
): Promise<PlayerGameLog[]> {
  const scope = params.season_type_scope ?? "reg_only";
  const types = seasonTypesForScope(scope);
  const seasonSet =
    params.seasons && params.seasons.length > 0
      ? new Set(params.seasons)
      : null;
  const pid = String(params.player_id);

  const all = await loadAllLogs();
  const rows = all.filter((r) => {
    if (r.player_id !== pid) return false;
    if (!(r.min > 0)) return false;
    if (seasonSet && !seasonSet.has(r.season)) return false;
    if (types && !types.includes(r.season_type)) return false;
    return true;
  });

  rows.sort((a, b) => {
    if (a.season !== b.season) return a.season.localeCompare(b.season);
    return a.game_date.localeCompare(b.game_date);
  });
  return rows;
}

export { logsPath };
