import type { NineScoreKey } from "@/types/hot_cold";

/**
 * Draft v3 stat bands (Analyst rule): each of the 9 cat scores is ranked by percentile within
 * the top 200 on the board by overall (O1), on whichever view is selected (Last or 3yr).
 * Elite >= 90th, good 70th–90th, average 30th–70th, poor < 30th. Published scores already
 * invert TOV and score FG%/FT% by impact, so higher is always better here. Players outside the
 * top 200 are banded against the same cutoffs. Null stays unshaded (never "poor").
 */
export type Band = "elite" | "good" | "avg" | "poor";

export const BAND_CATS: NineScoreKey[] = ["pts", "reb", "ast", "stl", "blk", "fg3m", "fg_f1", "ft_f1", "tov"];

export const DRAFTABLE_POOL = 200;

type Cuts = { p90: number; p70: number; p30: number };
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
    out[k] = { p90: quantile(vals, 0.9), p70: quantile(vals, 0.7), p30: quantile(vals, 0.3) };
  }
  return out;
}

export function bandOf(v: number | null | undefined, cuts: Cuts | undefined): Band | null {
  if (!num(v) || !cuts) return null;
  if (v >= cuts.p90) return "elite";
  if (v >= cuts.p70) return "good";
  if (v >= cuts.p30) return "avg";
  return "poor";
}
