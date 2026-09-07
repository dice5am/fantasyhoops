/**
 * Fixed Y-axis domains for Player Explorer histogram charts.
 * Domain always starts at 0 with a locked ceiling + clean ticks.
 * Overflow spikes do NOT extend the axis — bars cap at ceiling; UI marks overflow.
 * Radar stays on its own 0–100 normalized domain.
 *
 * Ceilings locked CoS/Cavin Player UX pack (2026-09-07): pts 0–50/10, AST/REB 0–20/5,
 * STL/BLK/TOV 0–10/2, FG%/FT% 0–100/10, fg3m 0–12/2.
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
  pts: { min: 0, ceiling: 50, tick: 10 },
  reb: { min: 0, ceiling: 20, tick: 5 },
  ast: { min: 0, ceiling: 20, tick: 5 },
  stl: { min: 0, ceiling: 10, tick: 2 },
  blk: { min: 0, ceiling: 10, tick: 2 },
  tov: { min: 0, ceiling: 10, tick: 2 },
  fg3m: { min: 0, ceiling: 12, tick: 2 },
  fg_pct: { min: 0, ceiling: 100, tick: 10 },
  ft_pct: { min: 0, ceiling: 100, tick: 10 },
};

/** Fixed ceiling for a stat (display units). */
export function chartYCeiling(stat: RadarStatKey): number {
  return (CHART_Y_AXIS[stat] ?? { min: 0 as const, ceiling: 50, tick: 10 }).ceiling;
}

/**
 * Resolve [0, ceiling] domain for a stat.
 * Fixed ceiling only — overflow spikes never extend the axis.
 * `values` retained for call-site compatibility (ignored for domain).
 */
export function resolveChartYDomain(
  stat: RadarStatKey,
  _values?: Iterable<number | null | undefined>
): [number, number] {
  void _values;
  return [0, chartYCeiling(stat)];
}

/** Cap a display value at the fixed ceiling (null stays null / DNP gap). */
export function capChartYValue(
  stat: RadarStatKey,
  value: number | null | undefined
): { visual: number | null; raw: number | null; overflow: boolean } {
  if (value == null || !Number.isFinite(Number(value))) {
    return { visual: null, raw: null, overflow: false };
  }
  const raw = Number(value);
  const ceiling = chartYCeiling(stat);
  if (raw > ceiling) {
    return { visual: ceiling, raw, overflow: true };
  }
  return { visual: raw, raw, overflow: false };
}

/** Nice ticks from 0 → max inclusive at `tick` step. */
export function chartYTicks(stat: RadarStatKey, max: number): number[] {
  const spec = CHART_Y_AXIS[stat] ?? { min: 0 as const, ceiling: 50, tick: 10 };
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
