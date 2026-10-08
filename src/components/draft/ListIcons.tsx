"use client";

import { useState } from "react";
import { FALLBACK_ICON, ICON_ROW_CAP, LIST_ICONS } from "@/lib/listIcons";
import type { ListMembership } from "@/lib/draftListMembership";
import styles from "./DraftAssistant.module.css";

/**
 * Icon priority (Analyst, draft v3): risks first so a warning never hides behind +N,
 * then upside lists, then OFF/DEF/EFF (shading already shows those). Unknown ids follow in file order.
 */
export const ICON_PRIORITY: string[] = [
  "availability",
  "avoid",
  "prime_breakout",
  "comeback",
  "late_riser",
  "hot",
  "cold",
  "rarity",
  "young",
  "off",
  "def",
  "eff",
];

function ordered(ids: string[], fileOrder: string[]): string[] {
  const rank = (id: string) => {
    const p = ICON_PRIORITY.indexOf(id);
    return p >= 0 ? p : ICON_PRIORITY.length + fileOrder.indexOf(id);
  };
  return [...ids].sort((a, b) => rank(a) - rank(b));
}

export function ListIcon(props: { id: string; title: string; size?: number }) {
  const icon = LIST_ICONS[props.id];
  const def = icon ?? FALLBACK_ICON;
  const tone = !icon ? styles.iconFallback : def.tone === "risk" ? styles.iconRisk : styles.iconUp;
  const size = props.size ?? 16;
  return (
    <svg
      className={tone}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={props.title}
    >
      <path d={def.d} />
    </svg>
  );
}

export function ListIconRow(props: {
  playerId: string;
  membership: ListMembership | null | undefined;
  /** Pick cards skip Hot/Cold (the percent already says it there). */
  skip?: string[];
}) {
  const [tip, setTip] = useState<string | null>(null);
  const m = props.membership;
  if (!m) return null;
  const ids = (m.byPlayer[props.playerId] ?? []).filter((id) => !props.skip?.includes(id));
  if (ids.length === 0) return null;
  const fileOrder = m.lists.map((l) => l.id);
  const titleOf = (id: string) => m.lists.find((l) => l.id === id)?.title ?? id;
  const sorted = ordered(ids, fileOrder);
  const shown = sorted.slice(0, ICON_ROW_CAP);
  const rest = sorted.slice(ICON_ROW_CAP);
  function show(text: string) {
    setTip((t) => (t === text ? null : text));
  }
  return (
    <span className={styles.iconRow}>
      {shown.map((id) => (
        <button
          key={id}
          type="button"
          className={styles.iconBtn}
          onClick={(e) => {
            e.stopPropagation();
            show(titleOf(id));
          }}
          title={titleOf(id)}
          aria-label={titleOf(id)}
        >
          <ListIcon id={id} title={titleOf(id)} />
        </button>
      ))}
      {rest.length ? (
        <button
          type="button"
          className={styles.iconMore}
          onClick={(e) => {
            e.stopPropagation();
            show(rest.map(titleOf).join(", "));
          }}
          aria-label={`Also on: ${rest.map(titleOf).join(", ")}`}
        >
          +{rest.length}
        </button>
      ) : null}
      {tip ? <span className={styles.iconTip}>{tip}</span> : null}
    </span>
  );
}

export function ListIconLegend(props: { membership: ListMembership | null | undefined }) {
  const m = props.membership;
  if (!m) return null;
  return (
    <ul className={styles.legend} aria-label="List icons">
      {m.lists.map((l) => (
        <li key={l.id}>
          <ListIcon id={l.id} title={l.title} />
          <span>{l.title}</span>
        </li>
      ))}
    </ul>
  );
}
