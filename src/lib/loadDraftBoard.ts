import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { parquetReadObjects } from "hyparquet";
import { getPrimaryTeamMap } from "@/lib/loadGameLogs";
import {
  AGG_CATS,
  DRAFT_LAST_SEASON,
  DRAFT_SCOPE,
  DRAFT_WINDOW_SEASONS,
  NINE_CATS,
  SIMILARITY_K,
  type ScoreVector,
  type SortKey,
} from "@/lib/draftMath";

/**
 * Draft board loader. Published scores only — no C1/T1/F1 recompute.
 * Last = 2025-26 reg_only. 3yr = GP-weighted published scores.
 * Null stays null (never coerced to 0).
 */

const SCORE_KEYS: SortKey[] = [
  ...NINE_CATS.map((c) => c.key),
  ...AGG_CATS.map((c) => c.key),
];

export type DraftWindowScores = ScoreVector;

export type DraftThreeYear = {
  /** Null if the mart omitted coverage — never coerced to 0. */
  n_seasons_used: number | null;
  honesty: "complete" | "partial";
  window_complete: boolean;
  gp_3yr: number | null;
  seasons_used: string;
  scores: DraftWindowScores;
};

/** 2025-26 reg_only per-game averages straight from the fantasy mart (null stays null). */
export type DraftAverages = {
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  fg3m: number | null;
  fg_pct: number | null;
  ft_pct: number | null;
  tov: number | null;
};

export type DraftBoardPlayer = {
  player_id: string;
  full_name: string;
  team_abbreviation: string | null;
  gp: number | null;
  scores: DraftWindowScores;
  avgs: DraftAverages;
  three_yr: DraftThreeYear | null;
  /** Analyst 3yr per-game (GP-weighted, seasons played only; FG%/FT% made/attempted). Null if not published. */
  avgs_3yr: (DraftAverages & { gp: number | null }) | null;
  /** NBA listing (Analyst positions.json, NBA player index Oct 8). Null = no listing → Util/BN only. */
  position: { nba_position: string; slots: string[] } | null;
};

export type DraftNeighbor = {
  player_id: string;
  similarity: number;
  rank: number;
};

export type DraftBoardPayload = {
  last_season: typeof DRAFT_LAST_SEASON;
  season_type_scope: typeof DRAFT_SCOPE;
  window_seasons: string[];
  playoffs: "off";
  yahoo: false;
  board_size: number;
  complete_count: number;
  partial_count: number;
  similarity_k: number;
  players: DraftBoardPlayer[];
  similarity: {
    last: Record<string, DraftNeighbor[]>;
    three_yr: Record<string, DraftNeighbor[]>;
  };
};

function toNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v);
}

/** Null / NaN stay null. Do not invent 0. */
function toNullable(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  const n = toNumber(v);
  return Number.isFinite(n) ? n : null;
}

function readParquet(filePath: string): Promise<Record<string, unknown>[]> {
  if (!existsSync(filePath)) {
    throw new Error(`Draft mart missing: ${path.basename(filePath)}`);
  }
  const buf = readFileSync(filePath);
  const file = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parquetReadObjects({ file }) as Promise<Record<string, unknown>[]>;
}

function emptyScores(): DraftWindowScores {
  return {
    pts: null,
    ast: null,
    fg3m: null,
    reb: null,
    stl: null,
    blk: null,
    tov: null,
    fg_f1: null,
    ft_f1: null,
    off: null,
    def: null,
    eff: null,
    o1: null,
  };
}

function scoresFrom(raw: Record<string, unknown>, suffix: "" | "_3yr"): DraftWindowScores {
  const scores = emptyScores();
  for (const key of SCORE_KEYS) {
    const col = suffix ? `score_${key}${suffix}` : `score_${key}`;
    scores[key] = toNullable(raw[col]);
  }
  return scores;
}

let cache: { key: string; payload: DraftBoardPayload } | null = null;

type AnalystJson = { players?: Record<string, Record<string, unknown>> };
function readAnalystJson(file: string): Record<string, Record<string, unknown>> {
  const p = path.join(process.cwd(), "data/draft", file);
  if (!existsSync(p)) return {};
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as AnalystJson;
    return raw && typeof raw.players === "object" && raw.players ? raw.players : {};
  } catch {
    return {};
  }
}

export async function getDraftBoard(): Promise<DraftBoardPayload> {
  const lastPath =
    process.env.NBA_FANTASY_SCORE_PATH ||
    path.join(process.cwd(), "data/marts/player_fantasy_scores.parquet");
  const threePath =
    process.env.NBA_FANTASY_SCORE_3YR_PATH ||
    path.join(process.cwd(), "data/marts/player_fantasy_scores_3yr.parquet");
  const simPath =
    process.env.NBA_SCORE_SIMILARITY_PATH ||
    path.join(process.cwd(), "data/marts/player_score_similarity.parquet");

  const stamp = [lastPath, threePath, simPath]
    .map((p) => {
      const st = statSync(p);
      return `${p}:${st.mtimeMs}:${st.size}`;
    })
    .join("|");
  if (cache && cache.key === stamp) return cache.payload;

  const [lastRows, threeRows, simRows] = await Promise.all([
    readParquet(lastPath),
    readParquet(threePath),
    readParquet(simPath),
  ]);

  const last = lastRows.filter(
    (r) =>
      String(r.season) === DRAFT_LAST_SEASON &&
      String(r.season_type_scope) === DRAFT_SCOPE
  );
  if (last.length === 0) {
    throw new Error(
      `No published ${DRAFT_LAST_SEASON} ${DRAFT_SCOPE} fantasy scores for the draft board`
    );
  }

  let teamMap = new Map<string, string>();
  try {
    teamMap = await getPrimaryTeamMap({
      season: DRAFT_LAST_SEASON,
      season_type_scope: DRAFT_SCOPE,
    });
  } catch {
    teamMap = new Map();
  }

  const threeById = new Map<string, Record<string, unknown>>();
  for (const row of threeRows) {
    if (String(row.season_type_scope) !== DRAFT_SCOPE) continue;
    if (String(row.last_season) !== DRAFT_LAST_SEASON) continue;
    threeById.set(String(row.player_id), row);
  }

  const avg3 = readAnalystJson("averages_3yr.json");
  const positions = readAnalystJson("positions.json");

  const players: DraftBoardPlayer[] = last.map((raw) => {
    const player_id = String(raw.player_id);
    const three = threeById.get(player_id);
    let three_yr: DraftThreeYear | null = null;
    if (three) {
      const honesty =
        String(three.honesty) === "complete" ? "complete" : "partial";
      three_yr = {
        n_seasons_used: toNullable(three.n_seasons_used),
        honesty,
        window_complete: three.window_complete === true,
        gp_3yr: toNullable(three.gp_3yr),
        seasons_used: three.seasons_used == null ? "" : String(three.seasons_used),
        scores: scoresFrom(three, "_3yr"),
      };
    }
    return {
      player_id,
      full_name: String(raw.full_name),
      team_abbreviation: teamMap.get(player_id) ?? null,
      gp: toNullable(raw.gp),
      scores: scoresFrom(raw, ""),
      avgs: {
        pts: toNullable(raw.avg_pts),
        reb: toNullable(raw.avg_reb),
        ast: toNullable(raw.avg_ast),
        stl: toNullable(raw.avg_stl),
        blk: toNullable(raw.avg_blk),
        fg3m: toNullable(raw.avg_fg3m),
        fg_pct: toNullable(raw.fg_pct),
        ft_pct: toNullable(raw.ft_pct),
        tov: toNullable(raw.avg_tov),
      },
      three_yr,
      avgs_3yr: avg3[player_id]
        ? {
            gp: toNullable(avg3[player_id].gp_3yr),
            pts: toNullable(avg3[player_id].avg_pts),
            reb: toNullable(avg3[player_id].avg_reb),
            ast: toNullable(avg3[player_id].avg_ast),
            stl: toNullable(avg3[player_id].avg_stl),
            blk: toNullable(avg3[player_id].avg_blk),
            fg3m: toNullable(avg3[player_id].avg_fg3m),
            fg_pct: toNullable(avg3[player_id].fg_pct),
            ft_pct: toNullable(avg3[player_id].ft_pct),
            tov: toNullable(avg3[player_id].avg_tov),
          }
        : null,
      position:
        positions[player_id] && Array.isArray(positions[player_id].slots)
          ? {
              nba_position: String(positions[player_id].nba_position ?? ""),
              slots: (positions[player_id].slots as unknown[]).map(String),
            }
          : null,
    };
  });

  players.sort((a, b) => {
    const ao = a.scores.o1 ?? Number.NEGATIVE_INFINITY;
    const bo = b.scores.o1 ?? Number.NEGATIVE_INFINITY;
    if (bo !== ao) return bo - ao;
    const ag = a.gp ?? Number.NEGATIVE_INFINITY;
    const bg = b.gp ?? Number.NEGATIVE_INFINITY;
    if (bg !== ag) return bg - ag;
    return a.player_id.localeCompare(b.player_id, "en", { numeric: true });
  });

  const similarity: DraftBoardPayload["similarity"] = { last: {}, three_yr: {} };
  for (const row of simRows) {
    const window = String(row.window);
    if (window !== "last" && window !== "three_yr") continue;
    const rank = toNullable(row.rank);
    const rankNeighbor = toNullable(row.rank_neighbor);
    const k = rankNeighbor ?? rank;
    if (k == null || k < 1 || k > SIMILARITY_K) continue;
    const sim = toNullable(row.similarity);
    if (sim == null) continue;
    const pid = String(row.player_id);
    const nid = String(row.neighbor_player_id);
    if (!pid || !nid || pid === nid) continue;
    const bucket = similarity[window];
    const list = bucket[pid] ?? [];
    list.push({ player_id: nid, similarity: sim, rank: k });
    bucket[pid] = list;
  }
  for (const window of ["last", "three_yr"] as const) {
    for (const pid of Object.keys(similarity[window])) {
      similarity[window][pid]!.sort((a, b) => a.rank - b.rank || a.player_id.localeCompare(b.player_id));
      similarity[window][pid] = similarity[window][pid]!.slice(0, SIMILARITY_K);
    }
  }

  let complete_count = 0;
  let partial_count = 0;
  for (const p of players) {
    if (!p.three_yr) continue;
    if (p.three_yr.honesty === "complete") complete_count += 1;
    else partial_count += 1;
  }

  const payload: DraftBoardPayload = {
    last_season: DRAFT_LAST_SEASON,
    season_type_scope: DRAFT_SCOPE,
    window_seasons: [...DRAFT_WINDOW_SEASONS],
    playoffs: "off",
    yahoo: false,
    board_size: players.length,
    complete_count,
    partial_count,
    similarity_k: SIMILARITY_K,
    players,
    similarity,
  };
  cache = { key: stamp, payload };
  return payload;
}
