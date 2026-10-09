import type { NineScoreKey } from "@/types/hot_cold";
import { isStrong, type BandCuts } from "@/lib/draftBands";

/**
 * Draft v3 Suggested reason line, worked out on the page (no new data):
 * team mean (Last 2025-26 published 0–100 cat scores) vs the average team baseline (You vs Avg).
 * Below-average cats = team mean < avg. A suggestion "lifts" a cat when the player's own score
 * in that cat is above the team's current mean. Order: biggest gap below average first; max 3.
 * score_tov is already inverted (higher = fewer turnovers), so no special case.
 * Fallback (Analyst): no picks yet, or he lifts none of the weak cats → "Strong in: …",
 * his elite/good cats under the shading bands, strongest first, max 3.
 */
export const REASON_CATS: { key: NineScoreKey; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "fg3m", label: "3PM" },
  { key: "fg_f1", label: "FG%" },
  { key: "ft_f1", label: "FT%" },
  { key: "tov", label: "TOV" },
];

export type CatScores = Partial<Record<NineScoreKey, number | null | undefined>>;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function teamMeans(roster: CatScores[]): CatScores {
  const out: CatScores = {};
  for (const c of REASON_CATS) {
    const vals = roster.map((r) => r[c.key]).filter(num);
    out[c.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return out;
}

/** Cats where the team is below the average team, biggest gap first. */
export function weakCats(team: CatScores, avg: CatScores | null | undefined) {
  if (!avg) return [];
  return REASON_CATS.map((c) => {
    const y = team[c.key];
    const a = avg[c.key];
    return num(y) && num(a) && y < a ? { ...c, gap: a - y, mean: y } : null;
  })
    .filter((x): x is { key: NineScoreKey; label: string; gap: number; mean: number } => x != null)
    .sort((a, b) => b.gap - a.gap);
}

export function reasonLine(
  player: CatScores,
  weak: ReturnType<typeof weakCats>,
  hasPicks: boolean,
  cuts: BandCuts
): string | null {
  if (hasPicks) {
    const lifts = weak.filter((w) => num(player[w.key]) && (player[w.key] as number) > w.mean).slice(0, 3);
    if (lifts.length > 0) return `Lifts your weakest: ${lifts.map((l) => l.label).join(", ")}`;
  }
  const strong = REASON_CATS.map((c) => ({ ...c, v: player[c.key] }))
    .filter((c) => isStrong(c.v, cuts[c.key]))
    .sort((a, b) => (b.v as number) - (a.v as number))
    .slice(0, 3);
  if (strong.length === 0) return null;
  return `Strong in: ${strong.map((c) => c.label).join(", ")}`;
}
