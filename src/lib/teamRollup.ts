/**
 * Team rollups as the roster fills — HOT-COLD.md "Team view" + contract §Team view.
 * Not stored. Recompute from whoever is on the roster. Empty roster → null (blank), never 0.
 *
 * - OFF/DEF/EFF: unweighted mean of members' 2025-26 score_off/def/eff (skip members
 *   with no 2025-26 score row).
 * - Nine category scores: unweighted mean of members' 2025-26 score_* (same skip).
 * - Nine hot/cold %: unweighted mean of members' hot_pct per stat, skipping nulls (+ count).
 * - Team hot_read: unweighted mean of members' hot_read, skipping nulls (+ count).
 *
 * Baselines: published baseline_teams rows (league_avg for N, slot S for N). No recompute.
 */

import {
  HOT_KEYS,
  NINE_SCORE_KEYS,
  type BaselineTeamRow,
  type HotKey,
  type NineScoreKey,
  type PlayerHotCold,
} from "@/types/hot_cold";

export type MeanCell = { mean: number | null; n: number };

export type TeamScoreSource = {
  off: number | null;
  def: number | null;
  eff: number | null;
} & Record<NineScoreKey, number | null>;

export type TeamRollup = {
  members: number;
  /** Members with a 2025-26 score row (in the published top-250 pool). */
  scored_members: number;
  off: MeanCell;
  def: MeanCell;
  eff: MeanCell;
  nine: Record<NineScoreKey, MeanCell>;
  hot: Record<HotKey, MeanCell>;
  hot_read: MeanCell;
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function meanOf(values: (number | null | undefined)[]): MeanCell {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (!isFiniteNum(v)) continue;
    sum += v;
    n += 1;
  }
  return { mean: n > 0 ? sum / n : null, n };
}

/**
 * @param rosterIds  ordered player_ids from fantasyhoops.teamRoster
 * @param lastScores player_id → 2025-26 reg_only published scores (Last window)
 * @param hotCold    player_id → player_hot_cold row
 */
export function computeTeamRollup(
  rosterIds: string[],
  lastScores: Map<string, TeamScoreSource>,
  hotCold: Record<string, PlayerHotCold> | null | undefined
): TeamRollup {
  const scored = rosterIds
    .map((id) => lastScores.get(id))
    .filter((s): s is TeamScoreSource => Boolean(s));
  const hot = rosterIds
    .map((id) => hotCold?.[id])
    .filter((h): h is PlayerHotCold => Boolean(h));

  const nine = {} as Record<NineScoreKey, MeanCell>;
  for (const k of NINE_SCORE_KEYS) nine[k] = meanOf(scored.map((s) => s[k]));

  const hotCells = {} as Record<HotKey, MeanCell>;
  for (const k of HOT_KEYS) hotCells[k] = meanOf(hot.map((h) => h.stats[k]?.hot_pct));

  return {
    members: rosterIds.length,
    scored_members: scored.length,
    off: meanOf(scored.map((s) => s.off)),
    def: meanOf(scored.map((s) => s.def)),
    eff: meanOf(scored.map((s) => s.eff)),
    nine,
    hot: hotCells,
    hot_read: meanOf(hot.map((h) => h.hot_read)),
  };
}

export type BaselinePair = {
  league: BaselineTeamRow | null;
  slot: BaselineTeamRow | null;
};

/** Published baselines for team count N and slot S. Missing → null (no fallback math). */
export function baselinesFor(
  teams: BaselineTeamRow[] | null | undefined,
  n: number | null | undefined,
  s: number | null | undefined
): BaselinePair {
  if (!teams || !isFiniteNum(n)) return { league: null, slot: null };
  const league =
    teams.find((t) => t.team_count === n && t.kind === "league_avg") ?? null;
  const slot = isFiniteNum(s)
    ? teams.find((t) => t.team_count === n && t.kind === "slot" && t.slot === s) ?? null
    : null;
  return { league, slot };
}

/** Draft is done when every pick in the setup is made (or the 15-man roster is full). */
export function isDraftComplete(
  setup: { r: number } | null | undefined,
  rosterLength: number,
  rosterMax = 15
): boolean {
  if (rosterLength >= rosterMax) return true;
  if (!setup || !isFiniteNum(setup.r)) return false;
  return rosterLength >= Math.min(setup.r, rosterMax);
}

/** Percent formatter for hot/cold. Null → "n/a" (never 0). */
export function fmtHotPct(v: number | null | undefined, digits = 1): string {
  if (!isFiniteNum(v)) return "n/a";
  const r = Number(v.toFixed(digits));
  const sign = r > 0 ? "+" : "";
  return `${sign}${r.toFixed(digits)}%`;
}
