/**
 * Fixed Y-axis domains for Player Explorer line charts.
 * Domain always starts at 0; fixed ceiling + clean ticks.
 * Rare exceed: keep ceiling when possible; else extend max by one tick step only.
 * Radar stays on its own 0–100 normalized domain.
 *
 * Ceilings locked CoS/Cavin APPLY (2026-09-06) — NOT the rejected 40/20/15/6 set.
 */

import type { RadarStatKey } from "@/lib/radar";

export type ChartYAxisSpec = {
  /** Inclusive floor — always 0 for player charts. */
  min: 0;
  /** Default ceiling (display units: counting raw, pct as 0–100). */
  ceiling: number;
  /** Preferred tick step. */
  tick: number;
};

/** Locked ceilings / ticks per CoS/Cavin APPLY. */
export const CHART_Y_AXIS: Record<RadarStatKey, ChartYAxisSpec> = {
  pts: { min: 0, ceiling: 60, tick: 10 },
  reb: { min: 0, ceiling: 30, tick: 5 },
  ast: { min: 0, ceiling: 25, tick: 5 },
  stl: { min: 0, ceiling: 10, tick: 2 },
  blk: { min: 0, ceiling: 10, tick: 2 },
  tov: { min: 0, ceiling: 12, tick: 2 },
  fg3m: { min: 0, ceiling: 12, tick: 2 },
  fg_pct: { min: 0, ceiling: 100, tick: 10 },
  ft_pct: { min: 0, ceiling: 100, tick: 10 },
};

/**
 * Resolve [0, max] domain for a stat given observed series values.
 * Does NOT auto-fit to series min/max — ceiling is fixed unless a value
 * exceeds it, in which case max grows by exactly one tick step only.
 */
export function resolveChartYDomain(
  stat: RadarStatKey,
  values: Iterable<number | null | undefined>
): [number, number] {
  const spec = CHART_Y_AXIS[stat] ?? { min: 0 as const, ceiling: 60, tick: 10 };
  let dataMax = 0;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > dataMax) {
      dataMax = v;
    }
  }
  let max = spec.ceiling;
  if (dataMax > max) {
    // Prefer keep ceiling; else extend by one tick step only (no loop).
    max = spec.ceiling + spec.tick;
  }
  return [0, max];
}

/** Nice ticks from 0 → max inclusive at `tick` step. */
export function chartYTicks(stat: RadarStatKey, max: number): number[] {
  const spec = CHART_Y_AXIS[stat] ?? { min: 0 as const, ceiling: 60, tick: 10 };
  const step = spec.tick;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max);
  }
  return ticks;
}
