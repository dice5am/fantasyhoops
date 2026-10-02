/**
 * Team tab prior-year compare helpers.
 *
 * SoT (Analyst pack — wire boards 04/06 against this):
 *   /workspace/skyscraper/nba-fantasy/phase-draft-prep/TEAM-COMPARE-RULES.md
 *   mirror: /workspace/nba-phase1/docs/TEAM-COMPARE-RULES.md
 *
 * Locks: current 2026-27 · prior 2025-26 · both reg_only · averages only ·
 * avg_fg3m only for 3PM · no invented zeros · Δ = current − prior.
 */
import {
  TEAM_DEFAULT_SEASON,
  TEAM_PRIOR_SEASON,
  TEAM_DEFAULT_SCOPE,
} from "@/types/season_player_averages";

export {
  TEAM_DEFAULT_SEASON,
  TEAM_PRIOR_SEASON,
  TEAM_DEFAULT_SCOPE,
};

export type CompareMode = "current" | "compare";

/** Metric keys for Team averages (Analyst §3). */
export type TeamMetricKey =
  | "gp"
  | "avg_min"
  | "avg_pts"
  | "avg_reb"
  | "avg_ast"
  | "avg_stl"
  | "avg_blk"
  | "avg_tov"
  | "avg_fg3m"
  | "fg_pct"
  | "ft_pct";

/** Higher better except TOV (Analyst §4 polarity — tint only). */
const LOWER_BETTER = new Set<TeamMetricKey>(["avg_tov"]);

export function isLowerBetter(key: TeamMetricKey): boolean {
  return LOWER_BETTER.has(key);
}

/** Short season label for column headers (e.g. 2025-26 → 25-26). */
export function seasonShortLabel(season: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(season);
  if (!m) return season;
  return `${m[1]!.slice(2)}-${m[2]}`;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number"
    ? Number.isFinite(v)
    : v != null && v !== "" && Number.isFinite(Number(v));
}

/**
 * Δ = current − prior when both numeric/finite; else null → UI muted n/a.
 * Never coerce missing → 0.
 */
export function deltaValue(
  current: number | null | undefined,
  prior: number | null | undefined
): number | null {
  if (!isFiniteNumber(current) || !isFiniteNumber(prior)) return null;
  return Number(current) - Number(prior);
}

/**
 * FG%/FT% Δ in percentage points after ×100 display scale
 * (prior 0.462, current 0.481 → +1.9).
 */
export function deltaPctPoints(
  current: number | null | undefined,
  prior: number | null | undefined
): number | null {
  const raw = deltaValue(current, prior);
  if (raw == null) return null;
  return raw * 100;
}

/** Counting / rate averages: signed 1 decimal (+1.2, -0.4, 0.0). */
export function formatDelta(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "n/a";
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

/** GP Δ: signed integer (+3, -1). */
export function formatDeltaGp(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "n/a";
  const n = Math.round(Number(v));
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}`;
}

/**
 * Current-only “Δ vs PY” cell (Analyst §4 / board 03):
 * both numeric → Δ; current empty + prior exists → "see PY"; else n/a.
 */
export function formatDeltaVsPy(
  current: number | null | undefined,
  prior: number | null | undefined,
  opts?: { asPctPoints?: boolean; asGp?: boolean }
): string {
  const hasCurrent = isFiniteNumber(current);
  const hasPrior = isFiniteNumber(prior);
  if (!hasCurrent && hasPrior) return "see PY";
  if (!hasCurrent || !hasPrior) return "n/a";
  if (opts?.asPctPoints) return formatDelta(deltaPctPoints(current, prior));
  if (opts?.asGp) return formatDeltaGp(deltaValue(current, prior));
  return formatDelta(deltaValue(current, prior));
}

/**
 * Tint polarity for champagne chrome: improve | decline | neutral.
 * TOV inverted (lower better).
 */
export function deltaPolarity(
  key: TeamMetricKey,
  delta: number | null | undefined
): "improve" | "decline" | "neutral" {
  if (delta == null || !Number.isFinite(Number(delta)) || Number(delta) === 0) {
    return "neutral";
  }
  const positive = Number(delta) > 0;
  if (isLowerBetter(key)) return positive ? "decline" : "improve";
  return positive ? "improve" : "decline";
}
