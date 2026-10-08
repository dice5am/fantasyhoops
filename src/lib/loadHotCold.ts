import { createHash } from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { parquetReadObjects } from "hyparquet";
import {
  HOT_KEYS,
  NINE_SCORE_KEYS,
  type BaselineTeamRow,
  type HotColdPayload,
  type HotKey,
  type HotStat,
  type PlayerHotCold,
} from "@/types/hot_cold";

/**
 * Hot/cold + baseline-team mart loader (same pattern as loadDraftBoard).
 * Data/marts are committed with the app and traced into the server bundle.
 * Env overrides: NBA_HOT_COLD_PATH, NBA_BASELINE_TEAMS_PATH.
 *
 * Read-only. Values are the mart's — no recompute. Null stays null (never 0).
 * Fails closed if the files do not match the gated hashes / row counts
 * in DATA-EXIT-ALLOW.md.
 */

export const HOT_COLD_SHA256 =
  "cbd4c57c8112e30068d72782aec191dd3b3156ca88eca80e32af872790a15f54";
export const BASELINE_TEAMS_SHA256 =
  "3d416eedd6a69ecc1386ff9690d7fc3ebcf646c9a4270a7c1ca9cba6aa7eda2b";
export const HOT_COLD_ROWS = 582;
export const BASELINE_TEAMS_ROWS = 228;

function toNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v);
}

/** Null / NaN / non-finite stay null. Do not invent 0. */
function toNullable(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  const n = toNumber(v);
  return Number.isFinite(n) ? n : null;
}

async function readParquet(
  filePath: string
): Promise<{ rows: Record<string, unknown>[]; sha256: string }> {
  if (!existsSync(filePath)) {
    throw new Error(`Hot/cold mart missing: ${path.basename(filePath)}`);
  }
  const buf = readFileSync(filePath);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const file = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const rows = (await parquetReadObjects({ file })) as Record<string, unknown>[];
  return { rows, sha256 };
}

function mapHotCold(raw: Record<string, unknown>): PlayerHotCold {
  const stats = {} as Record<HotKey, HotStat>;
  for (const k of HOT_KEYS) {
    stats[k] = {
      value: toNullable(raw[`value_2025_26_${k}`]),
      baseline: toNullable(raw[`baseline_${k}`]),
      n_seasons: toNullable(raw[`n_seasons_${k}`]),
      covered:
        raw[`seasons_covered_${k}`] == null ? null : String(raw[`seasons_covered_${k}`]),
      hot_pct: toNullable(raw[`hot_pct_${k}`]),
    };
  }
  const floor_met = raw.floor_met === true;
  return {
    player_id: String(raw.player_id),
    full_name: String(raw.full_name),
    gp_2025_26: toNullable(raw.gp_2025_26),
    minutes_2025_26: toNullable(raw.minutes_2025_26),
    floor_met,
    stats,
    hot_read: toNullable(raw.hot_read),
    n_hot_finite: toNullable(raw.n_hot_finite),
  };
}

function mapBaseline(raw: Record<string, unknown>): BaselineTeamRow {
  const scores = {} as BaselineTeamRow["scores"];
  for (const k of NINE_SCORE_KEYS) scores[k] = toNullable(raw[`score_${k}`]);
  const kind = String(raw.kind);
  if (kind !== "league_avg" && kind !== "slot") {
    throw new Error(`baseline_teams: unexpected kind ${kind}`);
  }
  return {
    team_count: toNumber(raw.team_count),
    kind,
    slot: toNullable(raw.slot),
    rounds: toNumber(raw.rounds),
    roster_size: toNumber(raw.roster_size),
    n_seasons: toNumber(raw.n_seasons),
    seasons: Array.isArray(raw.seasons) ? raw.seasons.map(String) : [],
    scores,
  };
}

let cache: { key: string; payload: HotColdPayload } | null = null;

export async function getHotColdPayload(): Promise<HotColdPayload> {
  const hotPath =
    process.env.NBA_HOT_COLD_PATH ||
    path.join(process.cwd(), "data/marts/player_hot_cold.parquet");
  const basePath =
    process.env.NBA_BASELINE_TEAMS_PATH ||
    path.join(process.cwd(), "data/marts/baseline_teams.parquet");

  const stamp = [hotPath, basePath]
    .map((p) => {
      const st = statSync(p);
      return `${p}:${st.mtimeMs}:${st.size}`;
    })
    .join("|");
  if (cache && cache.key === stamp) return cache.payload;

  const [hot, base] = await Promise.all([readParquet(hotPath), readParquet(basePath)]);

  if (hot.sha256 !== HOT_COLD_SHA256 || hot.rows.length !== HOT_COLD_ROWS) {
    throw new Error(
      `player_hot_cold does not match gate (sha ${hot.sha256.slice(0, 8)}…, ${hot.rows.length} rows; expected cbd4c57c…, ${HOT_COLD_ROWS})`
    );
  }
  if (base.sha256 !== BASELINE_TEAMS_SHA256 || base.rows.length !== BASELINE_TEAMS_ROWS) {
    throw new Error(
      `baseline_teams does not match gate (sha ${base.sha256.slice(0, 8)}…, ${base.rows.length} rows; expected 3d416eed…, ${BASELINE_TEAMS_ROWS})`
    );
  }

  const players: Record<string, PlayerHotCold> = {};
  for (const raw of hot.rows) {
    if (String(raw.compare_season) !== "2025-26") continue;
    if (String(raw.season_type_scope) !== "reg_only") continue;
    const p = mapHotCold(raw);
    players[p.player_id] = p;
  }

  const teams = base.rows.map(mapBaseline);

  const payload: HotColdPayload = {
    compare_season: "2025-26",
    season_type_scope: "reg_only",
    window_seasons: ["2023-24", "2024-25", "2025-26"],
    floor: { min_gp: 20, min_minutes: 200 },
    hot_cold: { rows: hot.rows.length, sha256: hot.sha256, players },
    baselines: { rows: base.rows.length, sha256: base.sha256, teams },
  };
  cache = { key: stamp, payload };
  return payload;
}
