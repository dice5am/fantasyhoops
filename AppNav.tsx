"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppNav.module.css";

const TABS = [
  { href: "/", label: "Data", match: (p: string) => p === "/" || p.startsWith("/data") },
  { href: "/player", label: "Player", match: (p: string) => p.startsWith("/player") },
] as const;

export function AppNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className={styles.nav} aria-label="Primary">
      <div className={styles.brand}>
        <span className={styles.brandMark}>🏀</span>
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
    </nav>
  );
}
