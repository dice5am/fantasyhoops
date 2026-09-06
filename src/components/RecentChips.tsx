"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  readRecentPlayers,
  type RecentPlayer,
} from "@/lib/recentPlayers";
import styles from "./RecentChips.module.css";

type Props = {
  activePlayerId?: string | null;
  accent?: string | null;
};

export function RecentChips({ activePlayerId, accent }: Props) {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentPlayer[]>([]);

  useEffect(() => {
    setRecent(readRecentPlayers());
    function onStorage() {
      setRecent(readRecentPlayers());
    }
    window.addEventListener("storage", onStorage);
    // Refresh when explorer updates localStorage in same tab
    const id = window.setInterval(() => {
      setRecent(readRecentPlayers());
    }, 1500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  if (recent.length === 0) return null;

  return (
    <div className={styles.recentRow} aria-label="Recent players">
      <span className={styles.recentLabel}>Recent</span>
      <div className={styles.recentChips}>
        {recent.map((p) => {
          const active = activePlayerId === p.player_id;
          return (
            <button
              key={p.player_id}
              type="button"
              className={`${styles.recentChip}${
                active ? ` ${styles.recentChipActive}` : ""
              }`}
              style={
                active && accent
                  ? ({
                      borderColor: accent,
                      boxShadow: `0 0 12px ${accent}55`,
                    } as CSSProperties)
                  : undefined
              }
              onClick={() => {
                const params = new URLSearchParams();
                params.set("player_id", p.player_id);
                if (p.full_name) params.set("name", p.full_name);
                router.replace(`/player?${params.toString()}`, { scroll: false });
              }}
            >
              {p.full_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
