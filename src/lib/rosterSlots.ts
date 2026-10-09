/**
 * Draft v4 Yahoo slots, computed from the saved roster on every change (never stored).
 * Positions come from Analyst positions.json (NBA listings, PM mapping). A player with no
 * listing fits Util and BN only. The whole roster is re-fit each time with a maximum matching
 * (augmenting paths, earlier picks placed first), so an early Util pick never locks out a later C.
 */

export const STARTER_SLOTS = ["PG", "SG", "G", "SF", "PF", "F", "C", "C", "Util", "Util"] as const;
export const BENCH_SLOTS = 3;

export type SlotRow = { slot: string; bench: boolean; playerId: string | null };

export function fitSlots(
  picks: { player_id: string; slots: string[] | null }[]
): SlotRow[] {
  const elig = picks.map((p) => new Set(p.slots && p.slots.length ? p.slots : ["Util", "BN"]));
  const slotOwner: (number | null)[] = STARTER_SLOTS.map(() => null);

  const tryPlace = (pi: number, seen: boolean[]): boolean => {
    for (let si = 0; si < STARTER_SLOTS.length; si++) {
      if (seen[si] || !elig[pi].has(STARTER_SLOTS[si])) continue;
      seen[si] = true;
      const cur = slotOwner[si];
      if (cur == null || tryPlace(cur, seen)) {
        slotOwner[si] = pi;
        return true;
      }
    }
    return false;
  };
  for (let pi = 0; pi < picks.length; pi++) tryPlace(pi, STARTER_SLOTS.map(() => false));

  const started = new Set(slotOwner.filter((v): v is number => v != null));

  // Same starters, tidier slots: in pick order, each starter takes the most specific slot
  // (PG before G before Util) that still leaves a full fit for the rest.
  const order = [...started].sort((a, b) => a - b);
  const final: (number | null)[] = STARTER_SLOTS.map(() => null);
  const feasible = (rest: number[], free: boolean[]): boolean => {
    if (rest.length === 0) return true;
    const [pi, ...more] = rest;
    for (let si = 0; si < STARTER_SLOTS.length; si++) {
      if (!free[si] || !elig[pi].has(STARTER_SLOTS[si])) continue;
      free[si] = false;
      const ok = feasible(more, free);
      free[si] = true;
      if (ok) return true;
    }
    return false;
  };
  const free = STARTER_SLOTS.map(() => true);
  order.forEach((pi, k) => {
    for (let si = 0; si < STARTER_SLOTS.length; si++) {
      if (!free[si] || !elig[pi].has(STARTER_SLOTS[si])) continue;
      free[si] = false;
      if (feasible(order.slice(k + 1), free)) {
        final[si] = pi;
        return;
      }
      free[si] = true;
    }
  });
  for (let si = 0; si < final.length; si++) slotOwner[si] = final[si];
  const bench = picks.map((_, i) => i).filter((i) => !started.has(i));
  const rows: SlotRow[] = STARTER_SLOTS.map((slot, si) => ({
    slot,
    bench: false,
    playerId: slotOwner[si] == null ? null : picks[slotOwner[si] as number].player_id,
  }));
  const benchCount = Math.max(BENCH_SLOTS, bench.length);
  for (let b = 0; b < benchCount; b++) {
    rows.push({ slot: "BN", bench: true, playerId: b < bench.length ? picks[bench[b]].player_id : null });
  }
  return rows;
}
