import { describe, it, expect } from "vitest";
import { fantasyPoints, scorePlayer, positionLabel } from "./scoring.js";
import type { Player, Position } from "./types.js";

describe("fantasyPoints", () => {
  it("applies standard weights and subtracts turnovers", () => {
    const points = fantasyPoints({ ppg: 10, rpg: 5, apg: 4, spg: 2, bpg: 1, topg: 3 });
    // 10 + 6 + 6 + 6 + 3 - 3 = 28
    expect(points).toBe(28);
  });

  it("rounds to one decimal place", () => {
    const points = fantasyPoints({ ppg: 1.11, rpg: 0, apg: 0, spg: 0, bpg: 0, topg: 0 });
    expect(points).toBe(1.1);
  });
});

describe("scorePlayer", () => {
  it("attaches fantasyPoints without mutating the input", () => {
    const player: Player = {
      id: "x",
      name: "Test",
      team: "TST",
      position: "PG",
      stats: { ppg: 20, rpg: 5, apg: 5, spg: 1, bpg: 1, topg: 2 },
    };
    const scored = scorePlayer(player);
    expect(scored.fantasyPoints).toBeGreaterThan(0);
    expect(scored).not.toBe(player);
  });
});

describe("positionLabel", () => {
  it("maps every position to a readable label", () => {
    const positions: Position[] = ["PG", "SG", "SF", "PF", "C"];
    for (const p of positions) {
      expect(positionLabel(p).length).toBeGreaterThan(0);
    }
  });
});
