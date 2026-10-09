import type { NineScoreKey } from "@/types/hot_cold";

/**
 * Draft v4: six levels (Analyst confirmed 2026-10-09): Best >= 97th, Elite 90–97, Great 80–90,
 * Good 65–80, Average 35–65, Poor < 35. Same top-200-per-view basis as v3 (below).
 * p70 is kept only for the Suggested "Strong in:" fallback (Analyst v3 rule: >= 70th).
 *
 * Draft v3 stat bands (Analyst rule): each of the 9 cat scores is ranked by percentile within
 * the top 200 on the board by overall (O1), on whichever view is selected (Last or 3yr).
 * Elite >= 90th, good 70th–90th, average 30th–70th, poor < 30th. Published scores already
 * invert TOV and score FG%/FT% by impact, so higher is always better here. Players outside the
 * top 200 are banded against the same cutoffs. Null stays unshaded (never "poor").
 */
export type Band = "best" | "elite" | "great" | "good" | "avg" | "poor";

/** Display order + ranges for legends (best first). */
export const BAND_LEVELS: { band: Band; label: string; range: string }[] = [
  { band: "best", label: "Best", range: "97th+" },
  { band: "elite", label: "Elite", range: "90–97th" },
  { band: "great", label: "Great", range: "80–90th" },
  { band: "good", label: "Good", range: "65–80th" },
  { band: "avg", label: "Average", range: "35–65th" },
  { band: "poor", label: "Poor", range: "below 35th" },
];

export const BAND_CATS: NineScoreKey[] = ["pts", "reb", "ast", "stl", "blk", "fg3m", "fg_f1", "ft_f1", "tov"];

export const DRAFTABLE_POOL = 200;

type Cuts = { p97: number; p90: number; p80: number; p70: number; p65: number; p35: number };
export type BandCuts = Partial<Record<NineScoreKey, Cuts>>;
export type CatScores = Partial<Record<NineScoreKey, number | null | undefined>>;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function quantile(sortedAsc: number[], q: number): number {
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

/** Ids of the top `size` players by overall in this view (finite O1 only). */
export function topPoolIds<T>(rows: T[], id: (r: T) => string, overall: (r: T) => number | null | undefined, size = DRAFTABLE_POOL): string[] {
  return rows
    .filter((r) => num(overall(r)))
    .sort((a, b) => (overall(b) as number) - (overall(a) as number) || id(a).localeCompare(id(b), "en", { numeric: true }))
    .slice(0, size)
    .map(id);
}

export function bandCuts(pool: CatScores[]): BandCuts {
  const out: BandCuts = {};
  for (const k of BAND_CATS) {
    const vals = pool.map((p) => p[k]).filter(num).sort((a, b) => a - b);
    if (vals.length < 2) continue;
    out[k] = {
      p97: quantile(vals, 0.97),
      p90: quantile(vals, 0.9),
      p80: quantile(vals, 0.8),
      p70: quantile(vals, 0.7),
      p65: quantile(vals, 0.65),
      p35: quantile(vals, 0.35),
    };
  }
  return out;
}

export function bandOf(v: number | null | undefined, cuts: Cuts | undefined): Band | null {
  if (!num(v) || !cuts) return null;
  if (v >= cuts.p97) return "best";
  if (v >= cuts.p90) return "elite";
  if (v >= cuts.p80) return "great";
  if (v >= cuts.p65) return "good";
  if (v >= cuts.p35) return "avg";
  return "poor";
}

/** Suggested "Strong in:" fallback — Analyst v3 rule, at or above the 70th percentile. */
export function isStrong(v: number | null | undefined, cuts: Cuts | undefined): boolean {
  return num(v) && !!cuts && v >= cuts.p70;
}

/** StatLine (per-game averages) key → the cat score that bands it. */
export const STATLINE_SCORE_KEY = {
  pts: "pts",
  reb: "reb",
  ast: "ast",
  stl: "stl",
  blk: "blk",
  fg3m: "fg3m",
  fg_pct: "fg_f1",
  ft_pct: "ft_f1",
  tov: "tov",
} as const satisfies Record<string, NineScoreKey>;

export function statLineBands(scores: CatScores | null | undefined, cuts: BandCuts) {
  const out: Partial<Record<keyof typeof STATLINE_SCORE_KEY, Band | null>> = {};
  if (!scores) return out;
  for (const [line, key] of Object.entries(STATLINE_SCORE_KEY) as [keyof typeof STATLINE_SCORE_KEY, NineScoreKey][]) {
    out[line] = bandOf(scores[key], cuts[key]);
  }
  return out;
}
