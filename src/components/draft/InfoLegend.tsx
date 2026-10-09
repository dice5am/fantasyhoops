"use client";

import { useEffect, useState } from "react";
import { ListIcon } from "@/components/draft/ListIcons";
import { bandPillClass } from "@/lib/bandPill";
import { BAND_LEVELS } from "@/lib/draftBands";
import type { ListMembership } from "@/lib/draftListMembership";
import styles from "./InfoLegend.module.css";

/**
 * Draft v4 ⓘ legend (Design V4 §4): 32px glass circle right of Sort.
 * Bottom sheet at <=640px, centred modal (max 560px) wider. Icons from `lists`, six sample pills.
 */
export function InfoLegend(props: { membership: ListMembership | null | undefined }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const lists = props.membership?.lists ?? [];
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.btn}
        aria-label="What the icons and shading mean"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5v.01" />
        </svg>
      </button>
      {open ? (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />
          <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Legend">
            <div className={styles.head}>
              <p className={styles.title}>Legend</p>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            {lists.length > 0 ? (
              <section>
                <p className={styles.group}>List icons</p>
                <ul className={styles.iconGrid}>
                  {lists.map((l) => (
                    <li key={l.id}>
                      <ListIcon id={l.id} title={l.title} size={18} />
                      <span>{l.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section>
              <p className={styles.group}>Stat shading</p>
              <ul className={styles.bands}>
                {BAND_LEVELS.map((l) => (
                  <li key={l.band}>
                    <span className={bandPillClass(l.band)}>{l.label}</span>
                    <span className={styles.range}>{l.range}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.note}>
                Percentile within the top 200 on the board, per view. TOV reversed; FG%/FT% by impact.
              </p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
