import type { Player, ScoredPlayer, StatLine, Position } from "./types.js";

/**
 * Standard head-to-head fantasy points weighting. Turnovers subtract value.
 */
export const SCORING_WEIGHTS: Readonly<Record<keyof StatLine, number>> = {
  ppg: 1,
  rpg: 1.2,
  apg: 1.5,
  spg: 3,
  bpg: 3,
  topg: -1,
};

export function fantasyPoints(stats: StatLine): number {
  const total =
    stats.ppg * SCORING_WEIGHTS.ppg +
    stats.rpg * SCORING_WEIGHTS.rpg +
    stats.apg * SCORING_WEIGHTS.apg +
    stats.spg * SCORING_WEIGHTS.spg +
    stats.bpg * SCORING_WEIGHTS.bpg +
    stats.topg * SCORING_WEIGHTS.topg;
  return Math.round(total * 10) / 10;
}

export function scorePlayer(player: Player): ScoredPlayer {
  return { ...player, fantasyPoints: fantasyPoints(player.stats) };
}

/** Human-readable name for a roster position, used by the API and UI. */
export function positionLabel(position: Position): string {
  switch (position) {
    case "PG":
      return "Point Guard";
    case "SG":
      return "Shooting Guard";
    case "SF":
      return "Small Forward";
    case "PF":
      return "Power Forward";
    case "C":
      return "Center";
    default: {
      const exhaustiveCheck: never = position;
      throw new Error(`Unhandled position: ${String(exhaustiveCheck)}`);
    }
  }
}
