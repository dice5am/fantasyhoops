/** Display helpers honoring the Phase 1 read-only contract. */

export function formatAvg(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toFixed(1);
}

/** pct stored 0–1; display ×100 with 1 decimal; null → em dash (never 0%). */
export function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}
