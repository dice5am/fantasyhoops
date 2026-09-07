import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { parquetReadObjects } from "hyparquet";
import type {
  FantasyScoreHistBin,
  FantasyScoresPayload,
  GetFantasyScoresParams,
  PlayerFantasyScore,
} from "@/types/fantasy_score";
import {
  FANTASY_SCORE_CONTRACT_VERSION,
} from "@/types/fantasy_score";
import type { SeasonTypeScope } from "@/types/season_player_averages";
import { DEFAULT_SCOPE, DEFAULT_SEASON } from "@/lib/loadMart";
import { parseTopPct, topPctCount, TOP_250_SIZE } from "@/lib/top250";
import { POOL_N_CAP, scorePool } from "@/lib/fantasyScorePool";

/**
 * Fantasy score mart loader (fantasy-score-v1).
 * Env: NBA_FANTASY_SCORE_PATH
 * Default: data/marts/player_fantasy_scores.parquet
 *
 * topPct=100 → published mart scores/ranks.
 * topPct<100 → narrow by avg_min within season×scope pool, then scorePool
 * (port of fantasy_score.py). Never reuse full-250 ranks after narrowing.
 */

const DEFAULT_FANTASY_SCORE = path.join(
  process.cwd(),
  "data/marts/player_fantasy_scores.parquet"
);

let cache: {
  path: string;
  mtimeMs: number;
  rows: PlayerFantasyScore[];
} | null = null;

export function fantasyScorePath(): string {
  return process.env.NBA_FANTASY_SCORE_PATH || DEFAULT_FANTASY_SCORE;
}

export function fantasyScoreAvailable(): boolean {
  try {
    const p = fantasyScorePath();
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

export class FantasyScoreUnavailableError extends Error {
  code = "FANTASY_SCORE_UNAVAILABLE" as const;
  path: string;
  constructor(message: string, p: string) {
    super(message);
    this.name = "FantasyScoreUnavailableError";
    this.path = p;
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

function mapRow(raw: Record<string, unknown>): PlayerFantasyScore {
  return {
    player_id: String(raw.player_id),
    full_name: String(raw.full_name),
    season: String(raw.season),
    season_type_scope: raw.season_type_scope as SeasonTypeScope,
    gp: toNumber(raw.gp),
    avg_min: toNumber(raw.avg_min),
    avg_pts: toNumber(raw.avg_pts),
    avg_ast: toNumber(raw.avg_ast),
    avg_fg3m: toNumber(raw.avg_fg3m),
    avg_reb: toNumber(raw.avg_reb),
    avg_stl: toNumber(raw.avg_stl),
    avg_blk: toNumber(raw.avg_blk),
    avg_tov: toNumber(raw.avg_tov),
    fg_pct: toNullableNumber(raw.fg_pct),
    ft_pct: toNullableNumber(raw.ft_pct),
    sum_fga: toNumber(raw.sum_fga) || 0,
    sum_fta: toNumber(raw.sum_fta) || 0,
    pool_size: toNumber(raw.pool_size),
    pool_n_cap: toNumber(raw.pool_n_cap) || POOL_N_CAP,
    pool_mu_fg_pct: toNumber(raw.pool_mu_fg_pct),
    pool_mu_ft_pct: toNumber(raw.pool_mu_ft_pct),
    fg_f1_impact: toNumber(raw.fg_f1_impact),
    ft_f1_impact: toNumber(raw.ft_f1_impact),
    score_pts: toNumber(raw.score_pts),
    score_ast: toNumber(raw.score_ast),
    score_fg3m: toNumber(raw.score_fg3m),
    score_reb: toNumber(raw.score_reb),
    score_stl: toNumber(raw.score_stl),
    score_blk: toNumber(raw.score_blk),
    score_tov: toNumber(raw.score_tov),
    score_fg_f1: toNumber(raw.score_fg_f1),
    score_ft_f1: toNumber(raw.score_ft_f1),
    score_off: toNumber(raw.score_off),
    score_def: toNumber(raw.score_def),
    score_eff: toNumber(raw.score_eff),
    score_o1: toNumber(raw.score_o1),
    rank_o1: toNumber(raw.rank_o1),
    rank_off: toNumber(raw.rank_off),
    rank_def: toNumber(raw.rank_def),
    rank_eff: toNumber(raw.rank_eff),
    rank_pts: toNumber(raw.rank_pts),
    rank_ast: toNumber(raw.rank_ast),
    rank_fg3m: toNumber(raw.rank_fg3m),
    rank_reb: toNumber(raw.rank_reb),
    rank_stl: toNumber(raw.rank_stl),
    rank_blk: toNumber(raw.rank_blk),
    rank_tov: toNumber(raw.rank_tov),
    rank_fg_f1: toNumber(raw.rank_fg_f1),
    rank_ft_f1: toNumber(raw.rank_ft_f1),
  };
}

const REQUIRED = [
  "player_id",
  "full_name",
  "season",
  "season_type_scope",
  "gp",
  "avg_min",
  "avg_pts",
  "avg_ast",
  "avg_fg3m",
  "avg_reb",
  "avg_stl",
  "avg_blk",
  "avg_tov",
  "sum_fga",
  "sum_fta",
  "score_o1",
  "score_off",
  "score_def",
  "score_eff",
  "rank_o1",
] as const;

async function loadAllRows(): Promise<PlayerFantasyScore[]> {
  const p = fantasyScorePath();
  if (!existsSync(p)) {
    throw new FantasyScoreUnavailableError(
      "Fantasy score parquet missing",
      p
    );
  }
  const st = statSync(p);
  if (cache && cache.path === p && cache.mtimeMs === st.mtimeMs) {
    return cache.rows;
  }
  const buf = readFileSync(p);
  const file = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  const objects = await parquetReadObjects({ file });
  const rows: PlayerFantasyScore[] = [];
  for (const obj of objects) {
    const raw = obj as Record<string, unknown>;
    for (const col of REQUIRED) {
      if (!(col in raw)) {
        throw new Error(`Fantasy score mart missing column: ${col}`);
      }
    }
    rows.push(mapRow(raw));
  }
  cache = { path: p, mtimeMs: st.mtimeMs, rows };
  return rows;
}

/** Sort like Data select_pool: avg_min DESC, gp DESC, player_id ASC. */
function sortByMpg(rows: PlayerFantasyScore[]): PlayerFantasyScore[] {
  return [...rows].sort((a, b) => {
    if (b.avg_min !== a.avg_min) return b.avg_min - a.avg_min;
    if (b.gp !== a.gp) return b.gp - a.gp;
    return a.player_id.localeCompare(b.player_id, "en", { numeric: true });
  });
}

function histBins(
  values: number[],
  binWidth = 10,
  min = 0,
  max = 100
): FantasyScoreHistBin[] {
  const bins: FantasyScoreHistBin[] = [];
  for (let lo = min; lo < max; lo += binWidth) {
    const hi = Math.min(lo + binWidth, max);
    bins.push({
      label: `${lo}–${hi}`,
      mid: (lo + hi) / 2,
      count: 0,
    });
  }
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const clamped = Math.min(max - 1e-9, Math.max(min, v));
    const idx = Math.min(
      bins.length - 1,
      Math.floor((clamped - min) / binWidth)
    );
    bins[idx].count += 1;
  }
  return bins;
}

function poolAvgs(rows: PlayerFantasyScore[]): FantasyScoresPayload["pool_avgs"] {
  let gpSum = 0;
  let pts = 0;
  let ast = 0;
  let fg3m = 0;
  let reb = 0;
  let stl = 0;
  let blk = 0;
  let tov = 0;
  let fgm = 0;
  let fga = 0;
  let ftm = 0;
  let fta = 0;
  for (const r of rows) {
    const gp = r.gp || 0;
    if (gp <= 0) continue;
    gpSum += gp;
    pts += r.avg_pts * gp;
    ast += r.avg_ast * gp;
    fg3m += r.avg_fg3m * gp;
    reb += r.avg_reb * gp;
    stl += r.avg_stl * gp;
    blk += r.avg_blk * gp;
    tov += r.avg_tov * gp;
    // shot-weighted FG%/FT% from rate * attempts (approx Σ made)
    if (r.fg_pct != null && r.sum_fga > 0) {
      fgm += r.fg_pct * r.sum_fga;
      fga += r.sum_fga;
    }
    if (r.ft_pct != null && r.sum_fta > 0) {
      ftm += r.ft_pct * r.sum_fta;
      fta += r.sum_fta;
    }
  }
  return {
    pts: gpSum > 0 ? pts / gpSum : null,
    ast: gpSum > 0 ? ast / gpSum : null,
    fg3m: gpSum > 0 ? fg3m / gpSum : null,
    reb: gpSum > 0 ? reb / gpSum : null,
    stl: gpSum > 0 ? stl / gpSum : null,
    blk: gpSum > 0 ? blk / gpSum : null,
    tov: gpSum > 0 ? tov / gpSum : null,
    fg_pct: fga > 0 ? fgm / fga : null,
    ft_pct: fta > 0 ? ftm / fta : null,
  };
}

function buildPayload(
  rows: PlayerFantasyScore[],
  meta: Omit<
    FantasyScoresPayload["meta"],
    "player_count" | "pool_mu_fg_pct" | "pool_mu_ft_pct"
  > & {
    pool_mu_fg_pct?: number | null;
    pool_mu_ft_pct?: number | null;
  }
): FantasyScoresPayload {
  const sorted = [...rows].sort((a, b) => a.rank_o1 - b.rank_o1);
  const muFg =
    meta.pool_mu_fg_pct ??
    (sorted[0]?.pool_mu_fg_pct ?? null);
  const muFt =
    meta.pool_mu_ft_pct ??
    (sorted[0]?.pool_mu_ft_pct ?? null);
  return {
    meta: {
      ...meta,
      player_count: sorted.length,
      pool_mu_fg_pct: muFg,
      pool_mu_ft_pct: muFt,
    },
    rows: sorted,
    o1_hist: histBins(sorted.map((r) => r.score_o1)),
    eff_hist: histBins(sorted.map((r) => r.score_eff)),
    pool_avgs: poolAvgs(sorted),
  };
}

/**
 * Load fantasy scores for season+scope.
 * topPct=100: published ranks. topPct<100: narrow then scorePool.
 */
export async function getFantasyScores(
  params: GetFantasyScoresParams = {}
): Promise<FantasyScoresPayload | null> {
  if (!fantasyScoreAvailable()) return null;

  const season = params.season ?? DEFAULT_SEASON;
  const season_type_scope: SeasonTypeScope =
    params.season_type_scope ?? DEFAULT_SCOPE;
  const topPct = parseTopPct(
    params.topPct != null ? String(params.topPct) : undefined
  );
  const parquet_path = fantasyScorePath();

  const all = await loadAllRows();
  const seasonRows = all.filter(
    (r) =>
      r.season === season && r.season_type_scope === season_type_scope
  );
  if (seasonRows.length === 0) {
    return buildPayload([], {
      season,
      season_type_scope,
      topPct,
      pool_size: 0,
      pool_n_cap: TOP_250_SIZE,
      mart_available: true,
      parquet_path,
      contract_version: FANTASY_SCORE_CONTRACT_VERSION,
      rescored: false,
      pool_mu_fg_pct: null,
      pool_mu_ft_pct: null,
    });
  }

  // Mart already is top-250 (or fewer for playoffs). Sort by MPG for topPct.
  const byMpg = sortByMpg(seasonRows);
  const publishedPoolSize = byMpg[0]?.pool_size ?? byMpg.length;

  if (topPct >= 100) {
    // Use published scores/ranks as-is (sorted by rank_o1 in buildPayload).
    return buildPayload(byMpg, {
      season,
      season_type_scope,
      topPct,
      pool_size: publishedPoolSize,
      pool_n_cap: byMpg[0]?.pool_n_cap ?? POOL_N_CAP,
      mart_available: true,
      parquet_path,
      contract_version: FANTASY_SCORE_CONTRACT_VERSION,
      rescored: false,
    });
  }

  // Narrow within published pool, then RE-SCORE (never reuse full-250 ranks).
  const n = Math.min(topPctCount(topPct), byMpg.length);
  const narrowed = byMpg.slice(0, n);
  const rescored = scorePool(
    narrowed.map((r) => ({
      player_id: r.player_id,
      full_name: r.full_name,
      season: r.season,
      season_type_scope: r.season_type_scope,
      gp: r.gp,
      avg_min: r.avg_min,
      avg_pts: r.avg_pts,
      avg_ast: r.avg_ast,
      avg_fg3m: r.avg_fg3m,
      avg_reb: r.avg_reb,
      avg_stl: r.avg_stl,
      avg_blk: r.avg_blk,
      avg_tov: r.avg_tov,
      fg_pct: r.fg_pct,
      ft_pct: r.ft_pct,
      sum_fga: r.sum_fga,
      sum_fta: r.sum_fta,
    }))
  );

  return buildPayload(rescored, {
    season,
    season_type_scope,
    topPct,
    pool_size: rescored.length,
    pool_n_cap: POOL_N_CAP,
    mart_available: true,
    parquet_path,
    contract_version: FANTASY_SCORE_CONTRACT_VERSION,
    rescored: true,
  });
}

export function awaitingFantasyScoresPayload(params: {
  season: string;
  season_type_scope: SeasonTypeScope;
  topPct: number;
}): FantasyScoresPayload {
  return {
    meta: {
      season: params.season,
      season_type_scope: params.season_type_scope,
      topPct: params.topPct,
      player_count: 0,
      pool_size: 0,
      pool_n_cap: POOL_N_CAP,
      mart_available: false,
      parquet_path: fantasyScorePath(),
      contract_version: FANTASY_SCORE_CONTRACT_VERSION,
      rescored: false,
      pool_mu_fg_pct: null,
      pool_mu_ft_pct: null,
    },
    rows: [],
    o1_hist: [],
    eff_hist: [],
    pool_avgs: {
      pts: null,
      ast: null,
      fg3m: null,
      reb: null,
      stl: null,
      blk: null,
      fg_pct: null,
      ft_pct: null,
      tov: null,
    },
  };
}
