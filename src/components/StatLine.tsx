import type { Band } from "@/lib/draftBands";
import { bandPillClass } from "@/lib/bandPill";
import styles from "./StatLine.module.css";

/**
 * Shared 9-stat average line (Draft pick cards, /insights rows).
 * Order: PTS REB AST STL BLK 3PM FG% FT% TOV. Real per-game averages only.
 * FG%/FT% take 0–1 rates and print as percent. Null → "n/a" (never 0).
 */
export type StatLineValues = {
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  fg3m: number | null;
  fg_pct: number | null;
  ft_pct: number | null;
  tov: number | null;
};

const CELLS: { key: keyof StatLineValues; label: string; pct?: boolean }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "fg3m", label: "3PM" },
  { key: "fg_pct", label: "FG%", pct: true },
  { key: "ft_pct", label: "FT%", pct: true },
  { key: "tov", label: "TOV" },
];

function fmt(v: number | null | undefined, pct?: boolean): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "n/a";
  return (pct ? v * 100 : v).toFixed(1);
}

export type StatLineBands = Partial<Record<keyof StatLineValues, Band | null>>;


export function StatLine({
  values,
  bands,
}: {
  values: StatLineValues | null | undefined;
  /** Draft v3 shading (brightness/weight only). Omit for the plain line. */
  bands?: StatLineBands | null;
}) {
  return (
    <dl className={styles.line} aria-label="Per-game averages">
      {CELLS.map((c) => {
        const text = fmt(values?.[c.key], c.pct);
        return (
          <div key={c.key} className={styles.cell}>
            <dt>{c.label}</dt>
            <dd
              className={
                text === "n/a"
                  ? bands
                    ? bandPillClass(null, true)
                    : styles.na
                  : bands?.[c.key]
                    ? bandPillClass(bands[c.key] as Band)
                    : undefined
              }
            >
              {text}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
