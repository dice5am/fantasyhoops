"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppNav.module.css";

/** Draft → Team → Players → Insights. No Home, no Schedule. */
const TABS = [
  {
    href: "/draft",
    label: "Draft",
    match: (p: string) => p.startsWith("/draft"),
  },
  {
    href: "/team",
    label: "Team",
    match: (p: string) => p.startsWith("/team"),
  },
  {
    href: "/players",
    label: "Players",
    match: (p: string) =>
      p.startsWith("/players") || p.startsWith("/player"),
  },
  {
    href: "/insights",
    label: "Insights",
    match: (p: string) =>
      p.startsWith("/insights") || p.startsWith("/insight"),
  },
] as const;

export function AppNav() {
  const pathname = usePathname() || "/team";

  return (
    <nav className={styles.nav} aria-label="Primary">
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden>
          ●
        </span>
        <span className={styles.brandText}>FantasyHoops</span>
      </div>
      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={active ? styles.tabActive : styles.tab}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className={styles.season} aria-label="Season">
        2026-27
      </div>
    </nav>
  );
}
