"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SeasonId } from "@/types/season_player_averages";
import { MAX_SELECTED_SEASONS } from "@/types/season_player_averages";
import styles from "./SeasonSelect.module.css";

type Props = {
  options: readonly SeasonId[];
  value: SeasonId[];
  onChange: (next: SeasonId[]) => void;
  max?: number;
  /** Accessible name for the control */
  label?: string;
};

/**
 * Compact multi-select for chart seasons (max 5). Replaces large season tiles.
 * Mobile-friendly: 44px touch targets, full-width panel on small screens.
 */
export function SeasonMultiSelect({
  options,
  value,
  onChange,
  max = MAX_SELECTED_SEASONS,
  label = "Chart seasons",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary =
    value.length === 0
      ? "Select seasons"
      : value.length <= 2
        ? value.join(", ")
        : `${value[0]} +${value.length - 1}`;

  function toggle(s: SeasonId) {
    if (value.includes(s)) {
      if (value.length === 1) return;
      onChange(value.filter((x) => x !== s));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, s].sort() as SeasonId[]);
  }

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${value.join(", ") || "none"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.triggerLabel}>{summary}</span>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={listId}
          className={styles.panel}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
        >
          <p className={styles.hint}>
            Up to {max} seasons · {value.length}/{max} selected
          </p>
          {options.map((s) => {
            const on = value.includes(s);
            const atCap = !on && value.length >= max;
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={on}
                disabled={atCap}
                className={on ? styles.optionOn : styles.option}
                onClick={() => toggle(s)}
              >
                <span className={styles.check} aria-hidden>
                  {on ? "✓" : ""}
                </span>
                {s}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
