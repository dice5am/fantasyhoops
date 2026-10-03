/**
 * DRAFT-RULES fixtures. Run: npx tsx scripts/assert_draft_rules.mjs
 */
const { validateSetup, yourPicks, overallPick, categoryGaps, rankSuggestions, tauFromSigma, populationStdev, labelGap } =
  await import("../src/lib/draftMath.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const straight = yourPicks({ n: 10, s: 3, format: "straight", r: 2 }).map((p) => p.overall);
assert(JSON.stringify(straight) === JSON.stringify([3, 13]), `straight ${straight}`);

const snake = yourPicks({ n: 10, s: 3, format: "snake", r: 2 }).map((p) => p.overall);
assert(JSON.stringify(snake) === JSON.stringify([3, 18]), `snake ${snake}`);

const snake4 = [1, 2, 3, 4].map((r) => overallPick(r, 3, 10, "snake"));
assert(JSON.stringify(snake4) === JSON.stringify([3, 18, 23, 38]), `snake4 ${snake4}`);

assert(validateSetup({ n: 10, s: 0, format: "snake", r: 15 }) !== null, "S=0 rejected");
assert(validateSetup({ n: 10, s: 11, format: "snake", r: 15 }) !== null, "S=11 rejected");
assert(validateSetup({ n: 10, s: 3, format: "snake", r: 15 }) === null, "valid setup");

assert(tauFromSigma(null) === 5, "null sigma tau");
assert(tauFromSigma(0) === 5, "zero sigma tau");
assert(tauFromSigma(10) === 5, "0.5 sigma");
assert(labelGap(5, 5) === "S", "S edge");
assert(labelGap(-5, 5) === "W", "W edge");
assert(labelGap(0, 5) === "N", "N");

const pool = [
  { pts: 50, ast: 50, fg3m: 50, reb: 50, stl: 40, blk: 40, tov: 50, fg_f1: 50, ft_f1: 50, off: 50, def: 50, eff: 50, o1: 50 },
  { pts: 60, ast: 40, fg3m: 70, reb: 30, stl: 20, blk: 80, tov: 50, fg_f1: 55, ft_f1: 45, off: 60, def: 40, eff: 50, o1: 55 },
];
const roster = [
  { pts: 90, ast: 40, fg3m: 20, reb: 80, stl: 10, blk: 90, tov: 50, fg_f1: 70, ft_f1: 30, off: 70, def: 60, eff: 50, o1: 80 },
];
const gaps = categoryGaps(roster, pool);
const stl = gaps.find((g) => g.key === "stl");
const blk = gaps.find((g) => g.key === "blk");
assert(stl && stl.gap != null && stl.gap < 0, "stl gap negative");
assert(blk && blk.gap != null && blk.gap > 0, "blk gap positive");

const candidates = [
  { player_id: "low", scores: { ...pool[0], stl: 10, blk: 10, o1: 40 } },
  { player_id: "stl-guy", scores: { ...pool[0], stl: 99, blk: 10, o1: 70 } },
  { player_id: "blk-guy", scores: { ...pool[0], stl: 10, blk: 99, o1: 70 } },
  { player_id: "drafted", scores: { ...pool[0], stl: 100, blk: 100, o1: 99 } },
];
const drafted = new Set(["drafted"]);
const cover = rankSuggestions(
  candidates.filter((c) => !drafted.has(c.player_id)),
  "cover",
  gaps
);
assert(!cover.some((c) => c.player_id === "drafted"), "drafted excluded");
assert(cover[0].player_id === "stl-guy", `cover top ${cover[0].player_id}`);
const stack = rankSuggestions(
  candidates.filter((c) => !drafted.has(c.player_id)),
  "stack",
  gaps
);
assert(stack[0].player_id === "blk-guy", `stack top ${stack[0].player_id}`);

const emptyGaps = categoryGaps([], pool);
const balanced = rankSuggestions(
  [
    { player_id: "a", scores: { ...pool[0], o1: 10, pts: 10 } },
    { player_id: "b", scores: { ...pool[0], o1: 90, pts: 90, ast: 90, fg3m: 90, reb: 90, stl: 90, blk: 90, tov: 90, fg_f1: 90, ft_f1: 90 } },
  ],
  "cover",
  emptyGaps
);
assert(balanced[0].player_id === "b", "empty roster balanced favors full vector");

const sd = populationStdev([null, 1, 3]);
assert(sd != null && Math.abs(sd - Math.sqrt(((1 - 2) ** 2 + (3 - 2) ** 2) / 2)) < 1e-9, "stdev ignores null");

console.log("PASS assert_draft_rules");
