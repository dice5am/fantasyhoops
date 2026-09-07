/**
 * Home Package A scarcity math — client-side from active /api/fantasy-scores pool.
 * Source of truth: /workspace/nba-phase1/docs/HOME_SCARCITY_MATH.md
 *
 * Spectrum HERO = absolute score-threshold COUNTS (n_ge_90 / n_ge_80 / n_in_40_60),
 * not percentile-% shares. Board rarity badges still use pct_rank.
 * pct_rank(i) = 100 * rank_asc(x_i) / n  (average ranks for ties).
 */

import type { PlayerFantasyScore } from "@/types/fantasy_score";

export type SpectrumMetric =
  | "PTS"
  | "AST"
  | "3PM"
  | "REB"
  | "STL"
  | "BLK"
  | "TOV"
  | "FG"
  | "FT";

export type AggregateMetric = "O1" | "OFF" | "DEF" | "EFF";

export type ScoreSortKey =
  | "o1"
  | "off"
  | "def"
  | "eff"
  | "pts"
  | "ast"
  | "fg3m"
  | "reb"
  | "stl"
  | "blk"
  | "tov"
  | "fg_f1"
  | "ft_f1";

export type Rarity = "ELITE" | "SCARCE" | "SOLID" | null;

/** Non-overlapping count bands for Spectrum hero bars. */
export type SpectrumCounts = {
  /** score >= 90 */
  ge_90: number;
  /** 80 <= score < 90 */
  band_80: number;
  /** 40 <= score < 60 */
  mid: number;
  /** remainder of pool */
  other: number;
};

export type SpectrumRow = {
  metric: SpectrumMetric;
  n: number;
  counts: SpectrumCounts;
  /** Overlapping / additive labels (SoT) */
  n_ge_90: number;
  n_ge_80: number;
  n_in_40_60: number;
};

export type RarityChip = {
  metric: SpectrumMetric;
  rarity: Exclude<Rarity, null>;
  pct_rank: number;
};

export type BoardRow = PlayerFantasyScore & {
  pct_rank_o1: number;
  pct_rank_off: number;
  pct_rank_def: number;
  pct_rank_eff: number;
  rarity_o1: Rarity;
  rarity_off: Rarity;
  rarity_def: Rarity;
  rarity_eff: Rarity;
  rarity_chips: RarityChip[];
};

export type O1Strip = {
  n: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
};

const SPECTRUM_ORDER: {
  metric: SpectrumMetric;
  field: keyof PlayerFantasyScore;
  c1: boolean;
}[] = [
  { metric: "PTS", field: "score_pts", c1: true },
  { metric: "AST", field: "score_ast", c1: true },
  { metric: "3PM", field: "score_fg3m", c1: true },
  { metric: "REB", field: "score_reb", c1: true },
  { metric: "STL", field: "score_stl", c1: true },
  { metric: "BLK", field: "score_blk", c1: true },
  { metric: "TOV", field: "score_tov", c1: false },
  { metric: "FG", field: "score_fg_f1", c1: false },
  { metric: "FT", field: "score_ft_f1", c1: false },
];

/** Scarcity chip preference when tying: BLK/STL/AST first among C1+F1. */
const CHIP_PREF: SpectrumMetric[] = [
  "BLK",
  "STL",
  "AST",
  "3PM",
  "FG",
  "FT",
  "REB",
  "PTS",
  "TOV",
];

function scoreOf(row: PlayerFantasyScore, field: keyof PlayerFantasyScore): number {
  const v = row[field];
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

/**
 * Average-rank ascending (pandas rank method="average").
 * Returns pct_rank = 100 * rank_asc / n for each index.
 */
export function pctRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => {
    const aNan = Number.isNaN(a.v);
    const bNan = Number.isNaN(b.v);
    if (aNan && bNan) return 0;
    if (aNan) return 1;
    if (bNan) return -1;
    if (a.v !== b.v) return a.v - b.v;
    return a.i - b.i;
  });

  const ranks = new Array<number>(n).fill(Number.NaN);
  let i = 0;
  while (i < n) {
    const cur = indexed[i]!;
    if (Number.isNaN(cur.v)) {
      ranks[cur.i] = Number.NaN;
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < n && !Number.isNaN(indexed[j]!.v) && indexed[j]!.v === cur.v) {
      j += 1;
    }
    // 1-based average rank over [i, j)
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k]!.i] = (100 * avgRank) / n;
    }
    i = j;
  }
  return ranks;
}

export function rarityFromPct(pct: number): Rarity {
  if (!Number.isFinite(pct)) return null;
  if (pct >= 95) return "ELITE";
  if (pct >= 90) return "SCARCE";
  if (pct >= 80) return "SOLID";
  return null;
}

function quantile(sortedAsc: number[], q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sortedAsc[0]!;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  const w = pos - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

function countBands(values: number[]): {
  counts: SpectrumCounts;
  n_ge_90: number;
  n_ge_80: number;
  n_in_40_60: number;
} {
  let ge_90 = 0;
  let band_80 = 0;
  let mid = 0;
  let other = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      other += 1;
      continue;
    }
    if (v >= 90) ge_90 += 1;
    else if (v >= 80) band_80 += 1;
    else if (v >= 40 && v < 60) mid += 1;
    else other += 1;
  }
  return {
    counts: { ge_90, band_80, mid, other },
    n_ge_90: ge_90,
    n_ge_80: ge_90 + band_80,
    n_in_40_60: mid,
  };
}

/** Scarcity Spectrum rows — COUNT hero on active pool (respects topPct). */
export function buildSpectrum(rows: PlayerFantasyScore[]): SpectrumRow[] {
  const n = rows.length;
  return SPECTRUM_ORDER.map(({ metric, field }) => {
    const values = rows.map((r) => scoreOf(r, field));
    const { counts, n_ge_90, n_ge_80, n_in_40_60 } = countBands(values);
    return { metric, n, counts, n_ge_90, n_ge_80, n_in_40_60 };
  });
}

/** O1 heat-strip quantiles (no ≥80 callouts). */
export function buildO1Strip(rows: PlayerFantasyScore[]): O1Strip | null {
  const vals = rows
    .map((r) => r.score_o1)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  return {
    n: vals.length,
    p10: quantile(vals, 0.1),
    p25: quantile(vals, 0.25),
    p50: quantile(vals, 0.5),
    p75: quantile(vals, 0.75),
    p90: quantile(vals, 0.9),
    min: vals[0]!,
    max: vals[vals.length - 1]!,
  };
}

function chipRank(m: SpectrumMetric): number {
  const i = CHIP_PREF.indexOf(m);
  return i < 0 ? 99 : i;
}

/**
 * Enrich board rows with aggregate pct_ranks + up to 3 scarcest C1/F1 chips.
 */
export function enrichBoardRows(rows: PlayerFantasyScore[]): BoardRow[] {
  if (!rows.length) return [];

  const pctO1 = pctRanks(rows.map((r) => r.score_o1));
  const pctOff = pctRanks(rows.map((r) => r.score_off));
  const pctDef = pctRanks(rows.map((r) => r.score_def));
  const pctEff = pctRanks(rows.map((r) => r.score_eff));

  const catPcts: { metric: SpectrumMetric; pcts: number[] }[] = SPECTRUM_ORDER.map(
    ({ metric, field }) => ({
      metric,
      pcts: pctRanks(rows.map((r) => scoreOf(r, field))),
    })
  );

  return rows.map((row, i) => {
    const chips: RarityChip[] = [];
    for (const { metric, pcts } of catPcts) {
      const pct = pcts[i]!;
      const rarity = rarityFromPct(pct);
      if (rarity === "ELITE" || rarity === "SCARCE") {
        chips.push({ metric, rarity, pct_rank: pct });
      }
    }
    chips.sort((a, b) => {
      const tier = (r: Exclude<Rarity, null>) => (r === "ELITE" ? 0 : 1);
      if (tier(a.rarity) !== tier(b.rarity)) return tier(a.rarity) - tier(b.rarity);
      if (b.pct_rank !== a.pct_rank) return b.pct_rank - a.pct_rank;
      return chipRank(a.metric) - chipRank(b.metric);
    });

    return {
      ...row,
      pct_rank_o1: pctO1[i]!,
      pct_rank_off: pctOff[i]!,
      pct_rank_def: pctDef[i]!,
      pct_rank_eff: pctEff[i]!,
      rarity_o1: rarityFromPct(pctO1[i]!),
      rarity_off: rarityFromPct(pctOff[i]!),
      rarity_def: rarityFromPct(pctDef[i]!),
      rarity_eff: rarityFromPct(pctEff[i]!),
      rarity_chips: chips.slice(0, 3),
    };
  });
}

export function scoreFieldForSort(key: ScoreSortKey): keyof PlayerFantasyScore {
  switch (key) {
    case "o1":
      return "score_o1";
    case "off":
      return "score_off";
    case "def":
      return "score_def";
    case "eff":
      return "score_eff";
    case "pts":
      return "score_pts";
    case "ast":
      return "score_ast";
    case "fg3m":
      return "score_fg3m";
    case "reb":
      return "score_reb";
    case "stl":
      return "score_stl";
    case "blk":
      return "score_blk";
    case "tov":
      return "score_tov";
    case "fg_f1":
      return "score_fg_f1";
    case "ft_f1":
      return "score_ft_f1";
  }
}

export function rankFieldForSort(key: ScoreSortKey): keyof PlayerFantasyScore {
  switch (key) {
    case "o1":
      return "rank_o1";
    case "off":
      return "rank_off";
    case "def":
      return "rank_def";
    case "eff":
      return "rank_eff";
    case "pts":
      return "rank_pts";
    case "ast":
      return "rank_ast";
    case "fg3m":
      return "rank_fg3m";
    case "reb":
      return "rank_reb";
    case "stl":
      return "rank_stl";
    case "blk":
      return "rank_blk";
    case "tov":
      return "rank_tov";
    case "fg_f1":
      return "rank_fg_f1";
    case "ft_f1":
      return "rank_ft_f1";
  }
}

export const SORT_CHIPS: { key: ScoreSortKey; label: string }[] = [
  { key: "o1", label: "O1" },
  { key: "off", label: "OFF" },
  { key: "def", label: "DEF" },
  { key: "eff", label: "EFF" },
  { key: "pts", label: "PTS" },
  { key: "ast", label: "AST" },
  { key: "fg3m", label: "3PM" },
  { key: "reb", label: "REB" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "fg_f1", label: "FG" },
  { key: "ft_f1", label: "FT" },
];

export type SpectrumBandKey = "ge_90" | "band_80" | "mid";

/** Stack order left→right for count hero (non-overlapping). */
export const SPECTRUM_BAND_ORDER: SpectrumBandKey[] = [
  "ge_90",
  "band_80",
  "mid",
];

export const SPECTRUM_BAND_LABEL: Record<SpectrumBandKey, string> = {
  ge_90: "≥90",
  band_80: "≥80",
  mid: "mid",
};
