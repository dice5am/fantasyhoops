import pill from "@/components/bandPill.module.css";
import type { Band } from "@/lib/draftBands";

/** Class list for a six-level pill; null band (n/a or unshaded) gets the dim n/a style. */
export function bandPillClass(band: Band | null | undefined, na = false): string {
  if (na) return `${pill.pill} ${pill.na}`;
  return `${pill.pill} ${band ? pill[band] : pill.avg}`;
}
