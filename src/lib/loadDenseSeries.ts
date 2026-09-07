import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { parquetReadObjects } from "hyparquet";
import type { SeasonTypeScope } from "@/types/season_player_averages";
import type {
  DenseGameSeriesRow,
  DenseSeasonTypeScope,
  GetDensePlayerGamesParams,
} from "@/types/dense_game_series";
import { teamAbbrFromTeamId } from "@/lib/teamColors";

/**
 * Dense series loader. Same hyparquet + mtime cache pattern as
 * loadMart / loadGameLogs.
 *
 * Env: NBA_DENSE_SERIES_PATH
 * Default (repo-shipped for Vercel, mirrors other marts):
 *   data/marts/player_dense_game_series.parquet
 *
 * Callers MUST treat missing parquet as unavailable (API → 503) — never
 * silently fall back to played-sequence curated logs inside this module.
 */

const DEFAULT_DENSE = path.join(
  process.cwd(),
  "data/marts/player_dense_game_series.parquet"
);

let denseCache: {
  path: string;
  mtimeMs: number;
  rows: DenseGameSeriesRow[];
} | null = null;

export function denseSeriesPath(): string {
  return process.env.NBA_DENSE_SERIES_PATH || DEFAULT_DENSE;
}

/** True iff the dense parquet file exists on disk (does not validate schema). */
export function denseSeriesAvailable(): boolean {
  try {
    const p = denseSeriesPath();
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
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

function toNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length === 0 ? null : s;
}

function formatGameDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s || null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number" || typeof v === "bigint") return Number(v) !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "t" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "f" || s === "no" || s === "")
      return false;
  }
  return Boolean(v);
}

function mapScope(raw: unknown): DenseSeasonTypeScope {
  const s = String(raw ?? "");
  if (s === "playoff_only") return "playoff_only";
  return "reg_only";
}

function mapRow(raw: Record<string, unknown>): DenseGameSeriesRow {
  const is_played = toBool(raw.is_played);
  // Contract: DNP → null never 0. If Data accidentally sends 0 on !is_played,
  // still coerce counting/rates to null at the consumer boundary.
  const nullIfUnplayed = (v: unknown): number | null => {
    if (!is_played) return null;
    return toNullableNumber(v);
  };
  return {
    player_id: String(raw.player_id),
    full_name: String(raw.full_name ?? ""),
    season: String(raw.season),
    season_type_scope: mapScope(raw.season_type_scope),
    game_index: toNumber(raw.game_index),
    game_id: toNullableString(raw.game_id),
    game_date: formatGameDate(raw.game_date),
    team_id: toNullableString(raw.team_id),
    // Dense parquet currently ships team_id only; map → TeamAbbr for chart strokes.
    // Prefer explicit column when Data backfills; else resolve from official NBA team_id.
    team_abbreviation: (() => {
      const fromCol =
        "team_abbreviation" in raw
          ? toNullableString(raw.team_abbreviation)
          : null;
      if (fromCol) return fromCol;
      return teamAbbrFromTeamId(toNullableString(raw.team_id));
    })(),
    is_played,
    min: nullIfUnplayed(raw.min),
    pts: nullIfUnplayed(raw.pts),
    reb: nullIfUnplayed(raw.reb),
    ast: nullIfUnplayed(raw.ast),
    stl: nullIfUnplayed(raw.stl),
    blk: nullIfUnplayed(raw.blk),
    tov: nullIfUnplayed(raw.tov),
    fg3m: nullIfUnplayed(raw.fg3m),
    fg_pct: nullIfUnplayed(raw.fg_pct),
    ft_pct: nullIfUnplayed(raw.ft_pct),
  };
}

async function loadAllDenseRows(): Promise<DenseGameSeriesRow[]> {
  const p = denseSeriesPath();
  if (!existsSync(p)) {
    throw new DenseSeriesUnavailableError(p);
  }
  const st = statSync(p);
  if (
    denseCache &&
    denseCache.path === p &&
    denseCache.mtimeMs === st.mtimeMs
  ) {
    return denseCache.rows;
  }

  const buf = readFileSync(p);
  const file = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  const objects = await parquetReadObjects({ file });
  const rows = objects.map((o) => mapRow(o as Record<string, unknown>));
  denseCache = { path: p, mtimeMs: st.mtimeMs, rows };
  return rows;
}

export class DenseSeriesUnavailableError extends Error {
  readonly code = "DENSE_SERIES_UNAVAILABLE" as const;
  readonly path: string;
  constructor(parquetPath: string) {
    super(
      `Dense game series parquet not published yet (missing: ${parquetPath})`
    );
    this.name = "DenseSeriesUnavailableError";
    this.path = parquetPath;
  }
}

/** Map UI scope → dense season_type_scope (reg_plus_playoffs → reg_only). */
export function denseScopeForUi(
  scope: SeasonTypeScope | undefined
): DenseSeasonTypeScope {
  if (scope === "playoff_only") return "playoff_only";
  return "reg_only";
}

/**
 * Dense slots for a player. Throws DenseSeriesUnavailableError if parquet
 * is missing — callers must surface 503 / empty, never curated fallback here.
 */
export async function getDensePlayerGames(
  params: GetDensePlayerGamesParams
): Promise<DenseGameSeriesRow[]> {
  const scope = denseScopeForUi(params.season_type_scope);
  const seasonSet =
    params.seasons && params.seasons.length > 0
      ? new Set(params.seasons)
      : null;
  const pid = String(params.player_id);

  const all = await loadAllDenseRows();
  const rows = all.filter((r) => {
    if (r.player_id !== pid) return false;
    if (seasonSet && !seasonSet.has(r.season)) return false;
    if (r.season_type_scope !== scope) return false;
    return true;
  });

  rows.sort((a, b) => {
    if (a.season !== b.season) return a.season.localeCompare(b.season);
    return a.game_index - b.game_index;
  });
  return rows;
}

export { DEFAULT_DENSE as DEFAULT_DENSE_SERIES_PATH };
