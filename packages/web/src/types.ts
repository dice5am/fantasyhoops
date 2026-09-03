export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export interface StatLine {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
}

export interface ScoredPlayer {
  id: string;
  name: string;
  team: string;
  position: Position;
  stats: StatLine;
  fantasyPoints: number;
}

export interface TeamView {
  id: string;
  name: string;
  roster: ScoredPlayer[];
  projectedPoints: number;
  rosterLimit: number;
}
