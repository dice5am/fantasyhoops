/**
 * Shared 9-cat radar ranges + normalization (Home league radar + PlayerExplorer).
 * Locked fantasy ranges — not league percentile.
 */

export type RadarStatKey =
  | "pts"
  | "ast"
  | "fg3m"
  | "reb"
  | "stl"
  | "blk"
  | "fg_pct"
  | "ft_pct"
  | "tov";

export const STAT_OPTIONS: {
  key: RadarStatKey;
  label: string;
  pct?: boolean;
}[] = [
  { key: "pts", label: "PTS" },
  { key: "ast", label: "AST" },
  { key: "fg3m", label: "3PM" },
  { key: "reb", label: "REB" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "fg_pct", label: "FG%", pct: true },
  { key: "ft_pct", label: "FT%", pct: true },
  { key: "tov", label: "TOV" },
];

/** Spoke order for radar (matches STAT_OPTIONS). */
export const RADAR_SPOKE_ORDER: RadarStatKey[] = STAT_OPTIONS.map((s) => s.key);

/** Fixed fantasy ranges for radar (0–100 display). TOV is inverted. */
export const RADAR_RANGES: Record<
  RadarStatKey,
  { min: number; max: number; invert?: boolean; pct?: boolean }
> = {
  pts: { min: 0, max: 35 },
  ast: { min: 0, max: 12 },
  fg3m: { min: 0, max: 5 },
  reb: { min: 0, max: 14 },
  stl: { min: 0, max: 2.5 },
  blk: { min: 0, max: 2.5 },
  fg_pct: { min: 0.4, max: 0.6, pct: true },
  ft_pct: { min: 0.65, max: 0.95, pct: true },
  tov: { min: 0, max: 5, invert: true },
};

export const RADAR_NORM_NOTE =
  "Radar normalization: each spoke is scaled to a fixed fantasy range (not league %ile) — PTS 0–35, AST 0–12, 3PM 0–5, REB 0–14, STL/BLK 0–2.5, FG% 40–60, FT% 65–95, TOV 0–5 inverted (lower TOV → larger spoke). 3PM uses mart avg_fg3m only.";

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Map raw mart average → 0–100 radar score for one category. */
export function normalizeRadarValue(
  key: RadarStatKey,
  raw: number | null | undefined
): number | null {
  if (raw == null || Number.isNaN(Number(raw))) return null;
  const { min, max, invert } = RADAR_RANGES[key];
  const t = (Number(raw) - min) / (max - min);
  const scored = invert ? 1 - t : t;
  return clamp01(scored * 100);
}

/** Triptych panel groupings (Home Hybrid A1+A3). */
export const TRIPTYCH = {
  OFF: ["pts", "ast", "fg3m"] as const,
  DEF: ["reb", "stl", "blk"] as const,
  EFF: ["fg_pct", "ft_pct", "tov"] as const,
};

export const STAT_LABEL: Record<RadarStatKey, string> = {
  pts: "PTS",
  ast: "AST",
  fg3m: "3PM",
  reb: "REB",
  stl: "STL",
  blk: "BLK",
  fg_pct: "FG%",
  ft_pct: "FT%",
  tov: "TOV",
};
