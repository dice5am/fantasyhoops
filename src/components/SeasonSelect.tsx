"use client";

import type { SeasonId } from "@/types/season_player_averages";
import styles from "./SeasonSelect.module.css";

type Props = {
  options: readonly SeasonId[];
  value: string;
  onChange: (next: SeasonId) => void;
  label?: string;
};

/** Compact single-season dropdown (Home / averages). Mobile-friendly native select. */
export function SeasonSelect({
  options,
  value,
  onChange,
  label = "Season",
}: Props) {
  return (
    <label className={styles.singleWrap}>
      <span className={styles.srOnly}>{label}</span>
      <select
        className={styles.nativeSelect}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value as SeasonId)}
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
