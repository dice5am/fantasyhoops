/**
 * Draft Assistant math — DRAFT-RULES.md only.
 * No new fantasy formulas. Scores are published mart values.
 * Last baseline season is 2025-26 reg_only (caller supplies vectors).
 */

export const DRAFT_LAST_SEASON = "2025-26";
export const DRAFT_SCOPE = "reg_only" as const;
export const DRAFT_WINDOW_SEASONS = ["2023-24", "2024-25", "2025-26"] as const;
export const ROSTER_MAX = 15;
export const DEFAULT_ROUNDS = 15;
export const SIMILARITY_K = 10;

export type DraftFormat = "straight" | "snake";

/** 9 category scores. TOV is already inverted in score_tov. */
export const NINE_CATS = [
  { key: "pts", label: "PTS" },
  { key: "ast", label: "AST" },
  { key: "fg3m", label: "3PM" },
  { key: "reb", label: "REB" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "fg_f1", label: "FG" },
  { key: "ft_f1", label: "FT" },
] as const;

export const AGG_CATS = [
  { key: "off", label: "OFF" },
  { key: "def", label: "DEF" },
  { key: "eff", label: "EFF" },
  { key: "o1", label: "O1" },
] as const;

export type NineCatKey = (typeof NINE_CATS)[number]["key"];
export type AggKey = (typeof AGG_CATS)[number]["key"];
export type SortKey = NineCatKey | AggKey;

export const SORT_CHIPS: { key: SortKey; label: string }[] = [
  { key: "o1", label: "O1" },
  { key: "off", label: "OFF" },
  { key: "def", label: "DEF" },
  { key: "eff", label: "EFF" },
  ...NINE_CATS.map((c) => ({ key: c.key, label: c.label })),
];

export type ScoreVector = Record<SortKey, number | null>;

export type DraftSetup = {
  n: number;
  s: number;
  format: DraftFormat;
  r: number;
};

export type PickSlot = {
  round: number;
  overall: number;
  yours: true;
};

const N_MIN = 2;
const N_MAX = 20;
const R_MAX = 30;

export function validateSetup(input: {
  n: number;
  s: number;
  format: DraftFormat;
  r: number;
}): string | null {
  const { n, s, format, r } = input;
  if (!Number.isInteger(n) || n < N_MIN || n > N_MAX) {
    return `Teams (N) must be an integer from ${N_MIN} to ${N_MAX}.`;
  }
  if (!Number.isInteger(s) || s < 1 || s > n) {
    return "Slot (S) must be an integer from 1 to N. It is not clamped.";
  }
  if (format !== "straight" && format !== "snake") {
    return "Format must be straight or snake.";
  }
  if (!Number.isInteger(r) || r < 1 || r > R_MAX) {
    return `Rounds (R) must be an integer from 1 to ${R_MAX}. Default is ${DEFAULT_ROUNDS}.`;
  }
  return null;
}

/** DRAFT-RULES §1 overall pick (1-based). */
export function overallPick(
  round: number,
  slot: number,
  teams: number,
  format: DraftFormat
): number {
  if (format === "straight" || round % 2 === 1) {
    return (round - 1) * teams + slot;
  }
  return (round - 1) * teams + (teams + 1 - slot);
}

export function yourPicks(setup: DraftSetup): PickSlot[] {
  const err = validateSetup(setup);
  if (err) throw new Error(err);
  const picks: PickSlot[] = [];
  for (let round = 1; round <= setup.r; round += 1) {
    picks.push({
      round,
      overall: overallPick(round, setup.s, setup.n, setup.format),
      yours: true,
    });
  }
  return picks;
}

export function finite(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Population stdev. Empty → null. DRAFT-RULES §3.3. */
export function populationStdev(values: Array<number | null | undefined>): number | null {
  const xs = values.filter(finite);
  if (xs.length === 0) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance =
    xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const sd = Math.sqrt(variance);
  return Number.isFinite(sd) ? sd : null;
}

/** τ = 0.5σ, else 5 when σ is 0 or null. */
export function tauFromSigma(sigma: number | null): number {
  if (sigma == null || sigma === 0) return 5;
  return 0.5 * sigma;
}

export type SwLabel = "S" | "W" | "N";

export function labelGap(gap: number, tau: number): SwLabel {
  if (gap >= tau) return "S";
  if (gap <= -tau) return "W";
  return "N";
}

export type CatGap = {
  key: NineCatKey;
  label: string;
  rosterMean: number | null;
  poolMean: number | null;
  sigma: number | null;
  tau: number;
  gap: number | null;
  labelSw: SwLabel | null;
};

export function meanFinite(values: Array<number | null | undefined>): number | null {
  const xs = values.filter(finite);
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function categoryGaps(
  rosterVectors: ScoreVector[],
  poolVectors: ScoreVector[]
): CatGap[] {
  return NINE_CATS.map((cat) => {
    const poolVals = poolVectors.map((v) => v[cat.key]);
    const poolMean = meanFinite(poolVals);
    const sigma = populationStdev(poolVals);
    const tau = tauFromSigma(sigma);
    if (rosterVectors.length === 0) {
      return {
        key: cat.key,
        label: cat.label,
        rosterMean: null,
        poolMean,
        sigma,
        tau,
        gap: null,
        labelSw: null,
      };
    }
    const rosterMean = meanFinite(rosterVectors.map((v) => v[cat.key]));
    const gap =
      rosterMean != null && poolMean != null ? rosterMean - poolMean : null;
    return {
      key: cat.key,
      label: cat.label,
      rosterMean,
      poolMean,
      sigma,
      tau,
      gap,
      labelSw: gap == null ? null : labelGap(gap, tau),
    };
  });
}

export type SuggestMode = "cover" | "stack";

/**
 * §4.3 weights.
 * Empty / no finite gaps → equal weight 1 on all 9 (balanced fallback; tracks broad value).
 * All weights zero with finite gaps → lowest three (cover) or highest three (stack), weight 1.
 */
export function categoryWeights(
  mode: SuggestMode,
  gaps: CatGap[]
): number[] {
  const raw = gaps.map((g) => {
    if (!finite(g.gap)) return 0;
    return mode === "cover" ? Math.max(0, -g.gap) : Math.max(0, g.gap);
  });
  if (raw.some((w) => w > 0)) return raw;

  const indexed = gaps
    .map((g, i) => ({ i, gap: g.gap }))
    .filter((x): x is { i: number; gap: number } => finite(x.gap));
  if (indexed.length === 0) {
    return gaps.map(() => 1);
  }
  const sorted = [...indexed].sort((a, b) =>
    mode === "cover" ? a.gap - b.gap : b.gap - a.gap
  );
  const out = gaps.map(() => 0);
  for (const row of sorted.slice(0, 3)) out[row.i] = 1;
  return out;
}

export type SuggestCandidate<T> = T & {
  suggest: number;
  o1: number | null;
  player_id: string;
  focusKey: NineCatKey | null;
  focusLabel: string | null;
};

/**
 * §4.4 primary rank.
 * Require all 9 scores finite. Normalize by Σw when Σw > 0.
 * Order: suggest DESC, score_o1 DESC, player_id ASC.
 * Drafted ids must already be excluded by the caller.
 */
export function rankSuggestions<T extends { player_id: string; scores: ScoreVector }>(
  candidates: T[],
  mode: SuggestMode,
  gaps: CatGap[]
): Array<SuggestCandidate<T>> {
  const weights = categoryWeights(mode, gaps);
  const ranked: Array<SuggestCandidate<T>> = [];
  for (const player of candidates) {
    let num = 0;
    let den = 0;
    let complete = true;
    let best = -Infinity;
    let focusKey: NineCatKey | null = null;
    for (let i = 0; i < NINE_CATS.length; i += 1) {
      const key = NINE_CATS[i]!.key;
      const score = player.scores[key];
      if (!finite(score)) {
        complete = false;
        break;
      }
      const w = weights[i] ?? 0;
      if (w > 0) {
        num += w * score;
        den += w;
        const contrib = w * score;
        if (contrib > best) {
          best = contrib;
          focusKey = key;
        }
      }
    }
    if (!complete || den <= 0) continue;
    ranked.push({
      ...player,
      suggest: num / den,
      o1: finite(player.scores.o1) ? player.scores.o1 : null,
      focusKey,
      focusLabel: focusKey
        ? (NINE_CATS.find((c) => c.key === focusKey)?.label ?? null)
        : null,
    });
  }
  ranked.sort((a, b) => {
    if (b.suggest !== a.suggest) return b.suggest - a.suggest;
    const ao = a.o1 ?? Number.NEGATIVE_INFINITY;
    const bo = b.o1 ?? Number.NEGATIVE_INFINITY;
    if (bo !== ao) return bo - ao;
    return a.player_id.localeCompare(b.player_id, "en", { numeric: true });
  });
  return ranked;
}

export function weightCaption(mode: SuggestMode, gaps: CatGap[]): string {
  const weights = categoryWeights(mode, gaps);
  const parts = NINE_CATS.map((c, i) => ({
    label: c.label,
    w: weights[i] ?? 0,
  }))
    .filter((p) => p.w > 0)
    .sort((a, b) => b.w - a.w);
  if (parts.length === 0) return mode === "cover" ? "balanced" : "balanced";
  return parts
    .slice(0, 4)
    .map((p) => p.label)
    .join(" · ");
}
