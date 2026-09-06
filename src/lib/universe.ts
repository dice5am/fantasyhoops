/**
 * Legacy Home Universe query support.
 * Universe chips were replaced by the topPct slider (see src/lib/top250.ts).
 * Any legacy `?universe=` value maps to topPct 100 (full top-250 pool).
 */

import { DEFAULT_TOP_PCT } from "@/lib/top250";

export type UniverseId = "all" | "min20" | "top10min";

/** @deprecated Universe presets removed; legacy URL only. */
export function parseUniverse(v: string | null | undefined): UniverseId | null {
  if (v === "all" || v === "min20" || v === "top10min") return v;
  return null;
}

/**
 * Legacy `universe` query → treat as topPct 100 (ignore preset semantics).
 * Prefer `?topPct=` when present.
 */
export function legacyUniverseToTopPct(
  universe: string | null | undefined
): number {
  void universe;
  return DEFAULT_TOP_PCT;
}
