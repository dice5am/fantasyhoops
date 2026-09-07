/**
 * Port of /workspace/nba-phase1/scripts/fantasy_score.py — MUST match
 * docs/FANTASY_SCORE.md (fantasy-score-v1). Used when Home topPct < 100
 * to re-score the narrowed pool. Do not invent alternate formulas.
 */

import type {
  FantasyScoreRawInput,
  PlayerFantasyScore,
} from "@/types/fantasy_score";

export const POOL_N_CAP = 250;

const C1_CATS: { suffix: keyof Pick<
  PlayerFantasyScore,
  "score_pts" | "score_ast" | "score_fg3m" | "score_reb" | "score_stl" | "score_blk"
>; col: keyof FantasyScoreRawInput }[] = [
  { suffix: "score_pts", col: "avg_pts" },
  { suffix: "score_ast", col: "avg_ast" },
  { suffix: "score_fg3m", col: "avg_fg3m" },
  { suffix: "score_reb", col: "avg_reb" },
  { suffix: "score_stl", col: "avg_stl" },
  { suffix: "score_blk", col: "avg_blk" },
];

const SCORE_CAT_COLS = [
  "score_pts",
  "score_ast",
  "score_fg3m",
  "score_reb",
  "score_stl",
  "score_blk",
  "score_tov",
  "score_fg_f1",
  "score_ft_f1",
] as const;

function nanMax(vals: number[]): number {
  let mx = -Infinity;
  for (const v of vals) {
    if (Number.isFinite(v) && v > mx) mx = v;
  }
  return mx === -Infinity ? NaN : mx;
}

function nanMin(vals: number[]): number {
  let mn = Infinity;
  for (const v of vals) {
    if (Number.isFinite(v) && v < mn) mn = v;
  }
  return mn === Infinity ? NaN : mn;
}

function nanMean(vals: (number | null)[]): number {
  let s = 0;
  let n = 0;
  for (const v of vals) {
    if (v != null && Number.isFinite(v)) {
      s += v;
      n += 1;
    }
  }
  return n > 0 ? s / n : 0;
}

/** 100 * x / max_pool; if max==0 → all 0. */
function c1Scores(xs: number[]): number[] {
  const mx = nanMax(xs);
  if (!Number.isFinite(mx) || mx === 0) return xs.map(() => 0);
  return xs.map((x) => (100 * x) / mx);
}

/** Invert: 100 * (max - x) / (max - min); if max==min → all 100. */
function t1TovScores(xs: number[]): number[] {
  const mx = nanMax(xs);
  const mn = nanMin(xs);
  if (!Number.isFinite(mx) || !Number.isFinite(mn) || mx === mn) {
    return xs.map(() => 100);
  }
  return xs.map((x) => (100 * (mx - x)) / (mx - mn));
}

/**
 * Impact = (pct - μ) * attempts; min–max → 0–100.
 * Null pct → impact 0. If max==min impact → all 50.
 */
function f1Scores(
  pcts: (number | null)[],
  attempts: number[]
): { scores: number[]; mu: number; impacts: number[] } {
  const mu = nanMean(pcts);
  const impacts = pcts.map((pct, i) => {
    const att = Number.isFinite(attempts[i]) ? attempts[i] : 0;
    if (pct == null || !Number.isFinite(pct)) return 0;
    return (pct - mu) * att;
  });
  const imax = nanMax(impacts);
  const imin = nanMin(impacts);
  let scores: number[];
  if (!Number.isFinite(imax) || !Number.isFinite(imin) || imax === imin) {
    scores = impacts.map(() => 50);
  } else {
    scores = impacts.map((imp) => (100 * (imp - imin)) / (imax - imin));
  }
  return { scores, mu, impacts };
}

/** Rank 1 = best. Tie-break: GP DESC, player_id ASC. */
function rankDesc(
  scores: number[],
  gps: number[],
  playerIds: string[]
): number[] {
  const order = scores
    .map((_, i) => i)
    .sort((a, b) => {
      if (scores[b] !== scores[a]) return scores[b] - scores[a];
      if (gps[b] !== gps[a]) return gps[b] - gps[a];
      return String(playerIds[a]).localeCompare(String(playerIds[b]), "en", {
        numeric: true,
      });
    });
  const ranks = new Array<number>(scores.length);
  order.forEach((idx, rank0) => {
    ranks[idx] = rank0 + 1;
  });
  return ranks;
}

function mean3(a: number, b: number, c: number): number {
  return (a + b + c) / 3;
}

function mean9(vals: number[]): number {
  let s = 0;
  for (const v of vals) s += v;
  return s / vals.length;
}

/**
 * Score an already-selected pool. μ/max/min computed inside this frame.
 * Mirrors fantasy_score.score_pool exactly.
 */
export function scorePool(
  pool: FantasyScoreRawInput[]
): PlayerFantasyScore[] {
  if (pool.length === 0) return [];

  const n = pool.length;
  const gps = pool.map((r) => r.gp);
  const pids = pool.map((r) => String(r.player_id));

  const catScores: Record<string, number[]> = {};
  for (const { suffix, col } of C1_CATS) {
    const xs = pool.map((r) => Number(r[col]));
    catScores[suffix] = c1Scores(xs);
  }
  catScores.score_tov = t1TovScores(pool.map((r) => Number(r.avg_tov)));

  const fg = f1Scores(
    pool.map((r) => r.fg_pct),
    pool.map((r) => Number(r.sum_fga) || 0)
  );
  const ft = f1Scores(
    pool.map((r) => r.ft_pct),
    pool.map((r) => Number(r.sum_fta) || 0)
  );
  catScores.score_fg_f1 = fg.scores;
  catScores.score_ft_f1 = ft.scores;

  const score_off = pool.map((_, i) =>
    mean3(
      catScores.score_pts[i],
      catScores.score_ast[i],
      catScores.score_fg3m[i]
    )
  );
  const score_def = pool.map((_, i) =>
    mean3(
      catScores.score_reb[i],
      catScores.score_stl[i],
      catScores.score_blk[i]
    )
  );
  const score_eff = pool.map((_, i) =>
    mean3(
      catScores.score_fg_f1[i],
      catScores.score_ft_f1[i],
      catScores.score_tov[i]
    )
  );
  const score_o1 = pool.map((_, i) =>
    mean9(SCORE_CAT_COLS.map((k) => catScores[k][i]))
  );

  const ranks: Record<string, number[]> = {
    rank_o1: rankDesc(score_o1, gps, pids),
    rank_off: rankDesc(score_off, gps, pids),
    rank_def: rankDesc(score_def, gps, pids),
    rank_eff: rankDesc(score_eff, gps, pids),
    rank_pts: rankDesc(catScores.score_pts, gps, pids),
    rank_ast: rankDesc(catScores.score_ast, gps, pids),
    rank_fg3m: rankDesc(catScores.score_fg3m, gps, pids),
    rank_reb: rankDesc(catScores.score_reb, gps, pids),
    rank_stl: rankDesc(catScores.score_stl, gps, pids),
    rank_blk: rankDesc(catScores.score_blk, gps, pids),
    rank_tov: rankDesc(catScores.score_tov, gps, pids),
    rank_fg_f1: rankDesc(catScores.score_fg_f1, gps, pids),
    rank_ft_f1: rankDesc(catScores.score_ft_f1, gps, pids),
  };

  return pool.map((r, i) => ({
    player_id: String(r.player_id),
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
    pool_size: n,
    pool_n_cap: POOL_N_CAP,
    pool_mu_fg_pct: fg.mu,
    pool_mu_ft_pct: ft.mu,
    fg_f1_impact: fg.impacts[i],
    ft_f1_impact: ft.impacts[i],
    score_pts: catScores.score_pts[i],
    score_ast: catScores.score_ast[i],
    score_fg3m: catScores.score_fg3m[i],
    score_reb: catScores.score_reb[i],
    score_stl: catScores.score_stl[i],
    score_blk: catScores.score_blk[i],
    score_tov: catScores.score_tov[i],
    score_fg_f1: catScores.score_fg_f1[i],
    score_ft_f1: catScores.score_ft_f1[i],
    score_off: score_off[i],
    score_def: score_def[i],
    score_eff: score_eff[i],
    score_o1: score_o1[i],
    rank_o1: ranks.rank_o1[i],
    rank_off: ranks.rank_off[i],
    rank_def: ranks.rank_def[i],
    rank_eff: ranks.rank_eff[i],
    rank_pts: ranks.rank_pts[i],
    rank_ast: ranks.rank_ast[i],
    rank_fg3m: ranks.rank_fg3m[i],
    rank_reb: ranks.rank_reb[i],
    rank_stl: ranks.rank_stl[i],
    rank_blk: ranks.rank_blk[i],
    rank_tov: ranks.rank_tov[i],
    rank_fg_f1: ranks.rank_fg_f1[i],
    rank_ft_f1: ranks.rank_ft_f1[i],
  }));
}

/** Spot-check F1 volume (mirrors fantasy_score.spot_check_f1_volume). */
export function spotCheckF1Volume(): {
  pass: boolean;
  mu_fg_pct: number;
  rank_fg_f1: Record<string, number>;
  impacts: Record<string, number>;
} {
  const rows: FantasyScoreRawInput[] = [
    {
      player_id: "A",
      full_name: "EqualHighVol",
      season: "test",
      season_type_scope: "reg_only",
      gp: 80,
      avg_min: 35,
      avg_pts: 20,
      avg_ast: 5,
      avg_fg3m: 2,
      avg_reb: 5,
      avg_stl: 1,
      avg_blk: 0.5,
      avg_tov: 2,
      fg_pct: 0.5,
      ft_pct: 0.8,
      sum_fga: 1000,
      sum_fta: 300,
    },
    {
      player_id: "B",
      full_name: "EqualLowVol",
      season: "test",
      season_type_scope: "reg_only",
      gp: 80,
      avg_min: 34,
      avg_pts: 18,
      avg_ast: 5,
      avg_fg3m: 2,
      avg_reb: 5,
      avg_stl: 1,
      avg_blk: 0.5,
      avg_tov: 2,
      fg_pct: 0.5,
      ft_pct: 0.8,
      sum_fga: 200,
      sum_fta: 60,
    },
    {
      player_id: "C",
      full_name: "BrickHighVol",
      season: "test",
      season_type_scope: "reg_only",
      gp: 80,
      avg_min: 33,
      avg_pts: 15,
      avg_ast: 5,
      avg_fg3m: 2,
      avg_reb: 5,
      avg_stl: 1,
      avg_blk: 0.5,
      avg_tov: 2,
      fg_pct: 0.3,
      ft_pct: 0.8,
      sum_fga: 1000,
      sum_fta: 300,
    },
    {
      player_id: "D",
      full_name: "BrickLowVol",
      season: "test",
      season_type_scope: "reg_only",
      gp: 80,
      avg_min: 32,
      avg_pts: 12,
      avg_ast: 5,
      avg_fg3m: 2,
      avg_reb: 5,
      avg_stl: 1,
      avg_blk: 0.5,
      avg_tov: 2,
      fg_pct: 0.3,
      ft_pct: 0.8,
      sum_fga: 200,
      sum_fta: 60,
    },
  ];
  const scored = scorePool(rows);
  const byId = Object.fromEntries(scored.map((r) => [r.player_id, r]));
  const ranks = {
    A: byId.A.rank_fg_f1,
    B: byId.B.rank_fg_f1,
    C: byId.C.rank_fg_f1,
    D: byId.D.rank_fg_f1,
  };
  const impacts = {
    A: byId.A.fg_f1_impact,
    B: byId.B.fg_f1_impact,
    C: byId.C.fg_f1_impact,
    D: byId.D.fg_f1_impact,
  };
  const mu = byId.A.pool_mu_fg_pct;
  const equal_ok = ranks.A < ranks.B;
  const brick_ok = ranks.C > ranks.D && ranks.C > ranks.A;
  const order_ok =
    ranks.A === 1 && ranks.B === 2 && ranks.D === 3 && ranks.C === 4;
  return {
    pass: Boolean(
      equal_ok && brick_ok && order_ok && Math.abs(mu - 0.4) < 1e-9
    ),
    mu_fg_pct: mu,
    rank_fg_f1: ranks,
    impacts,
  };
}
