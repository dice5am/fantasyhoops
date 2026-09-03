import type { FantasyTeam, Player, ScoredPlayer, TeamView } from "./types.js";
import { SEED_PLAYERS } from "./data/players.js";
import { scorePlayer } from "./scoring.js";

export const ROSTER_LIMIT = 8;

export class RosterError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "ROSTER_FULL" | "DUPLICATE",
  ) {
    super(message);
    this.name = "RosterError";
  }
}

/**
 * In-memory data store. A single fantasy team is tracked for the demo so the
 * environment stays dependency-free (no external database required).
 */
export class Store {
  private readonly players = new Map<string, Player>();
  private readonly team: FantasyTeam = { id: "team-1", name: "My Team", roster: [] };

  constructor(seed: readonly Player[] = SEED_PLAYERS) {
    for (const player of seed) {
      this.players.set(player.id, player);
    }
  }

  listPlayers(): ScoredPlayer[] {
    return [...this.players.values()]
      .map(scorePlayer)
      .sort((a, b) => b.fantasyPoints - a.fantasyPoints);
  }

  getPlayer(id: string): ScoredPlayer | undefined {
    const player = this.players.get(id);
    return player ? scorePlayer(player) : undefined;
  }

  getTeam(): TeamView {
    const roster = this.team.roster
      .map((id) => this.getPlayer(id))
      .filter((p): p is ScoredPlayer => p !== undefined);
    const projectedPoints =
      Math.round(roster.reduce((sum, p) => sum + p.fantasyPoints, 0) * 10) / 10;
    return {
      id: this.team.id,
      name: this.team.name,
      roster,
      projectedPoints,
      rosterLimit: ROSTER_LIMIT,
    };
  }

  addToRoster(playerId: string): TeamView {
    if (!this.players.has(playerId)) {
      throw new RosterError(`Unknown player: ${playerId}`, "NOT_FOUND");
    }
    if (this.team.roster.includes(playerId)) {
      throw new RosterError(`Player already on roster: ${playerId}`, "DUPLICATE");
    }
    if (this.team.roster.length >= ROSTER_LIMIT) {
      throw new RosterError(`Roster is full (limit ${ROSTER_LIMIT})`, "ROSTER_FULL");
    }
    this.team.roster.push(playerId);
    return this.getTeam();
  }

  removeFromRoster(playerId: string): TeamView {
    const index = this.team.roster.indexOf(playerId);
    if (index === -1) {
      throw new RosterError(`Player not on roster: ${playerId}`, "NOT_FOUND");
    }
    this.team.roster.splice(index, 1);
    return this.getTeam();
  }

  resetRoster(): void {
    this.team.roster = [];
  }
}
