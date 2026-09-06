import { readFileSync, statSync } from "fs";
import { parquetReadObjects } from "hyparquet";
import type {
  GetSeasonPlayerAveragesParams,
  PlayerDirectoryEntry,
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";
import {
  buildLeagueContext,
  DEFAULT_MIN_GP,
  type FgPctHistBin,
  type LeaderEntry,
  type LeagueAvgs,
  type LeagueContextPayload,
} from "@/lib/leagueAggregates";
import { getPrimaryTeamMap } from "@/lib/loadGameLogs";
import {
  filterByTopPct,
  parseTopPct,
  selectTop250ByMpg,
  top250IdSet,
} from "@/lib/top250";

import path from "path";

const DEFAULT_MART = path.join(process.cwd(), "data/marts/season_player_averages.parquet");
const DEFAULT_SEASON = "2025-26";
const DEFAULT_SCOPE: SeasonTypeScope = "reg_only";

const REQUIRED = [
  "player_id",
  "full_name",
  "season",
  "season_type_scope",
  "gp",
  "avg_min",
  "avg_pts",
  "avg_reb",
  "avg_ast",
  "avg_stl",
  "avg_blk",
  "avg_tov",
  "fg_pct",
  "fg3_pct",
  "ft_pct",
] as const;

let martCache: { path: string; mtimeMs: number; rows: SeasonPlayerAverage[] } | null =
  null;

function martPath(): string {
  return process.env.NBA_MART_PATH || DEFAULT_MART;
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

function mapRow(raw: Record<string, unknown>): SeasonPlayerAverage {
  const avgFg3m =
    "avg_fg3m" in raw ? toNullableNumber(raw.avg_fg3m) : null;
  const sumFg3m =
    "sum_fg3m" in raw ? toNullableNumber(raw.sum_fg3m) : null;
  return {
    player_id: String(raw.player_id),
    full_name: String(raw.full_name),
    season: String(raw.season),
    season_type_scope: raw.season_type_scope as SeasonTypeScope,
    gp: toNumber(raw.gp),
    avg_min: toNumber(raw.avg_min),
    avg_pts: toNumber(raw.avg_pts),
    avg_reb: toNumber(raw.avg_reb),
    avg_ast: toNumber(raw.avg_ast),
    avg_stl: toNumber(raw.avg_stl),
    avg_blk: toNumber(raw.avg_blk),
    avg_tov: toNumber(raw.avg_tov),
    avg_fg3m: avgFg3m as number,
    sum_fg3m: sumFg3m,
    sum_fgm: "sum_fgm" in raw ? toNullableNumber(raw.sum_fgm) : null,
    sum_fga: "sum_fga" in raw ? toNullableNumber(raw.sum_fga) : null,
    sum_ftm: "sum_ftm" in raw ? toNullableNumber(raw.sum_ftm) : null,
    sum_fta: "sum_fta" in raw ? toNullableNumber(raw.sum_fta) : null,
    fg_pct: toNullableNumber(raw.fg_pct),
    fg3_pct: toNullableNumber(raw.fg3_pct),
    ft_pct: toNullableNumber(raw.ft_pct),
  };
}

async function loadAllMartRows(): Promise<SeasonPlayerAverage[]> {
  const path = martPath();
  const st = statSync(path);
  if (
    martCache &&
    martCache.path === path &&
    martCache.mtimeMs === st.mtimeMs
  ) {
    return martCache.rows;
  }

  const buf = readFileSync(path);
  const file = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  const objects = await parquetReadObjects({ file });

  const rows: SeasonPlayerAverage[] = [];
  for (const obj of objects) {
    const raw = obj as Record<string, unknown>;
    for (const col of REQUIRED) {
      if (!(col in raw)) {
        throw new Error(`Mart missing required column: ${col}`);
      }
    }
    rows.push(mapRow(raw));
  }

  martCache = { path, mtimeMs: st.mtimeMs, rows };
  return rows;
}

/**
 * Server-side read of the live parquet mart (hyparquet).
 * Full mart — no Top-250 trim (deep-link / player-averages / game logs).
 */
export async function getSeasonPlayerAverages(
  params: GetSeasonPlayerAveragesParams = {}
): Promise<SeasonPlayerAverage[]> {
  const season = params.season ?? DEFAULT_SEASON;
  const season_type_scope = params.season_type_scope ?? DEFAULT_SCOPE;
  const playerId = params.player_id ? String(params.player_id) : null;

  const all = await loadAllMartRows();
  const rows = all.filter((r) => {
    if (r.season !== season) return false;
    if (r.season_type_scope !== season_type_scope) return false;
    if (playerId && r.player_id !== playerId) return false;
    return true;
  });

  rows.sort((a, b) => b.avg_pts - a.avg_pts);
  return rows;
}

/** Season+scope averages restricted to Top-250-by-MPG pool. */
export async function getSeasonPlayerAveragesTop250(
  params: GetSeasonPlayerAveragesParams = {}
): Promise<SeasonPlayerAverage[]> {
  const rows = await getSeasonPlayerAverages({
    season: params.season,
    season_type_scope: params.season_type_scope,
  });
  return selectTop250ByMpg(rows);
}

/** Unique players from mart for unicode search/select (full mart — legacy). */
export async function getPlayerDirectory(): Promise<PlayerDirectoryEntry[]> {
  const all = await loadAllMartRows();
  const map = new Map<string, string>();
  for (const r of all) {
    if (!map.has(r.player_id)) map.set(r.player_id, r.full_name);
  }
  const entries = [...map.entries()].map(([player_id, full_name]) => ({
    player_id,
    full_name,
  }));
  entries.sort((a, b) => a.full_name.localeCompare(b.full_name, "en"));
  return entries;
}

/** Directory restricted to Top-250 pool for season+scope (typeahead / search). */
export async function getPlayerDirectoryTop250(params?: {
  season?: string;
  season_type_scope?: SeasonTypeScope;
}): Promise<PlayerDirectoryEntry[]> {
  const top = await getSeasonPlayerAveragesTop250({
    season: params?.season ?? DEFAULT_SEASON,
    season_type_scope: params?.season_type_scope ?? DEFAULT_SCOPE,
  });
  const entries = top.map((r) => ({
    player_id: r.player_id,
    full_name: r.full_name,
  }));
  entries.sort((a, b) => a.full_name.localeCompare(b.full_name, "en"));
  return entries;
}

/** Whether player_id is in the Top-250 pool for season+scope. */
export async function isInTop250Pool(params: {
  player_id: string;
  season?: string;
  season_type_scope?: SeasonTypeScope;
}): Promise<boolean> {
  const rows = await getSeasonPlayerAverages({
    season: params.season ?? DEFAULT_SEASON,
    season_type_scope: params.season_type_scope ?? DEFAULT_SCOPE,
  });
  return top250IdSet(rows).has(String(params.player_id));
}

export type { LeaderEntry, LeagueAvgs, FgPctHistBin, LeagueContextPayload };
export type LeagueContext = LeagueContextPayload;

/**
 * GP-weighted league averages + top-5 leaders + FG% hist + stocks leaders.
 * Pipeline: season+scope mart → Top 250 by MPG → topPct slice → aggregates.
 */
export async function getLeagueContext(params: {
  season?: string;
  season_type_scope?: SeasonTypeScope;
  /** Integer % 10–100 within top-250 (preferred). */
  topPct?: number | string;
  /** @deprecated Prefer topPct; legacy universe query maps to 100. */
  universe?: string;
  min_gp?: number;
  min_min?: number;
  teamByPlayer?: Map<string, string>;
}): Promise<LeagueContextPayload> {
  const season = params.season ?? DEFAULT_SEASON;
  const season_type_scope = params.season_type_scope ?? DEFAULT_SCOPE;
  let topPct: number;
  if (params.topPct != null && params.topPct !== "") {
    topPct = parseTopPct(String(params.topPct));
  } else if (params.universe != null && params.universe !== "") {
    topPct = 100;
  } else {
    topPct = parseTopPct(undefined);
  }
  const rows = await getSeasonPlayerAverages({ season, season_type_scope });
  const top250 = selectTop250ByMpg(rows);
  const filtered = filterByTopPct(top250, topPct);
  const teamByPlayer =
    params.teamByPlayer ??
    (await getPrimaryTeamMap({ season, season_type_scope }));
  return buildLeagueContext(filtered, {
    season,
    season_type_scope,
    topPct,
    teamByPlayer,
    filters: {
      min_gp: params.min_gp,
      min_min: params.min_min,
      top_pct: topPct,
    },
  });
}

export { DEFAULT_SEASON, DEFAULT_SCOPE, martPath, DEFAULT_MIN_GP as MIN_GP_LEADERS };
