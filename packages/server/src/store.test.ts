import { describe, it, expect, beforeEach } from "vitest";
import { Store, RosterError, ROSTER_LIMIT } from "./store.js";
import type { Player } from "./types.js";

function makePlayer(id: string): Player {
  return {
    id,
    name: `Player ${id}`,
    team: "TST",
    position: "PG",
    stats: { ppg: 10, rpg: 3, apg: 3, spg: 1, bpg: 0, topg: 1 },
  };
}

describe("Store roster management", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(Array.from({ length: 12 }, (_, i) => makePlayer(`p${i}`)));
  });

  it("adds a player and recomputes projected points", () => {
    const team = store.addToRoster("p0");
    expect(team.roster.map((p) => p.id)).toEqual(["p0"]);
    expect(team.projectedPoints).toBeGreaterThan(0);
  });

  it("rejects unknown players", () => {
    expect(() => store.addToRoster("nope")).toThrowError(RosterError);
  });

  it("rejects duplicate additions", () => {
    store.addToRoster("p0");
    expect(() => store.addToRoster("p0")).toThrowError(/already on roster/);
  });

  it("enforces the roster limit", () => {
    for (let i = 0; i < ROSTER_LIMIT; i++) {
      store.addToRoster(`p${i}`);
    }
    expect(() => store.addToRoster(`p${ROSTER_LIMIT}`)).toThrowError(/full/);
  });

  it("removes players", () => {
    store.addToRoster("p0");
    store.addToRoster("p1");
    const team = store.removeFromRoster("p0");
    expect(team.roster.map((p) => p.id)).toEqual(["p1"]);
  });

  it("sorts listed players by fantasy points descending", () => {
    const players = store.listPlayers();
    for (let i = 1; i < players.length; i++) {
      expect(players[i - 1].fantasyPoints).toBeGreaterThanOrEqual(players[i].fantasyPoints);
    }
  });
});
