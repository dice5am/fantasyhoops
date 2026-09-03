export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export const POSITIONS: readonly Position[] = ["PG", "SG", "SF", "PF", "C"];

export interface StatLine {
  /** Points per game */
  ppg: number;
  /** Rebounds per game */
  rpg: number;
  /** Assists per game */
  apg: number;
  /** Steals per game */
  spg: number;
  /** Blocks per game */
  bpg: number;
  /** Turnovers per game */
  topg: number;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: Position;
  stats: StatLine;
}

export interface ScoredPlayer extends Player {
  /** Projected fantasy points per game, derived from the stat line. */
  fantasyPoints: number;
}

export interface FantasyTeam {
  id: string;
  name: string;
  roster: string[];
}

export interface TeamView {
  id: string;
  name: string;
  roster: ScoredPlayer[];
  projectedPoints: number;
  rosterLimit: number;
}
