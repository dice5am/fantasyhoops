"use client";

import { useEffect, useState } from "react";
import { ListIcon } from "@/components/draft/ListIcons";
import type { ListMembership } from "@/lib/draftListMembership";
import type { SortKey } from "@/lib/draftMath";
import styles from "./DraftAssistant.module.css";

/** Draft v3 Sort by (Design §6): Overall, the 9 stats (3x3), then one row per Insights list. */
export const SORT_STATS: { key: SortKey; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "fg3m", label: "3PM" },
  { key: "fg_f1", label: "FG%" },
  { key: "ft_f1", label: "FT%" },
  { key: "tov", label: "TOV" },
];

export type SortChoice = { kind: "overall" } | { kind: "stat"; key: SortKey } | { kind: "list"; id: string };

export function sortChoiceLabel(c: SortChoice, membership: ListMembership | null | undefined): string {
  if (c.kind === "overall") return "Overall";
  if (c.kind === "stat") return SORT_STATS.find((s) => s.key === c.key)?.label ?? "Overall";
  return membership?.lists.find((l) => l.id === c.id)?.title ?? "Overall";
}

function Check() {
  return (
    <span className={styles.sortCheck} aria-hidden>
      ✓
    </span>
  );
}

export function SortControl(props: {
  choice: SortChoice;
  membership: ListMembership | null | undefined;
  onChoose: (c: SortChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const label = sortChoiceLabel(props.choice, props.membership);
  function choose(c: SortChoice) {
    props.onChoose(c);
    setOpen(false);
  }
  const c = props.choice;
  return (
    <div className={styles.sortWrap}>
      <button
        type="button"
        className={styles.sortBtn}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Sort by: ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.sortBtnText}>{label}</span>
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <>
          <div className={styles.sortBackdrop} onClick={() => setOpen(false)} aria-hidden />
          <div className={styles.sortSheet} role="dialog" aria-label="Sort by">
            <p className={styles.sortGroup}>Overall</p>
            <button type="button" className={styles.sortRow} onClick={() => choose({ kind: "overall" })}>
              <span>Overall</span>
              {c.kind === "overall" ? <Check /> : null}
            </button>
            <p className={styles.sortGroup}>Stats</p>
            <div className={styles.sortGrid}>
              {SORT_STATS.map((s) => {
                const on = c.kind === "stat" && c.key === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={on ? styles.sortPillOn : styles.sortPill}
                    aria-pressed={on}
                    onClick={() => choose({ kind: "stat", key: s.key })}
                  >
                    {s.label}
                    {on ? <Check /> : null}
                  </button>
                );
              })}
            </div>
            {props.membership?.lists.length ? (
              <>
                <p className={styles.sortGroup}>Lists</p>
                {props.membership.lists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={styles.sortRow}
                    onClick={() => choose({ kind: "list", id: l.id })}
                  >
                    <span className={styles.sortListName}>
                      <ListIcon id={l.id} title={l.title} />
                      {l.title}
                    </span>
                    {c.kind === "list" && c.id === l.id ? <Check /> : null}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
