import { readFileSync, statSync } from "fs";
import { parquetReadObjects } from "hyparquet";
import type {
  GetSeasonPlayerAveragesParams,
  PlayerDirectoryEntry,
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";

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
  // Keep raw avg_fg3m / sum_fg3m separate; API resolves display 3PM + source.
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
 * Filters by season + season_type_scope (+ optional player_id).
 * Missing combo → [] (no crash).
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

/** Unique players from mart for unicode search/select. */
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

export { DEFAULT_SEASON, DEFAULT_SCOPE, martPath };
