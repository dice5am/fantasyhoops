"use client";

import { PlayerExplorer } from "@/components/PlayerExplorer";
import { PlayerTable } from "@/components/PlayerTable";
import type {
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";
import styles from "./PlayerHub.module.css";

type Props = {
  rows: SeasonPlayerAverage[];
  season: string;
  scope: SeasonTypeScope;
  hasPlayer: boolean;
  /** Soft note when deep-linked player is outside Top-250 pool. */
  outsideTop250?: boolean;
};

/**
 * Player tab IA: Recent → Season averages → Explorer charts
 * (Recent + table slotted into PlayerExplorer; one glass chrome).
 * Mobile (≤800): list ↔ detail drill-in via ?player_id=; desktop keeps both.
 */
export function PlayerHub({
  rows,
  season,
  scope,
  hasPlayer,
  outsideTop250 = false,
}: Props) {
  const averagesTable = (
    <PlayerTable
      rows={rows}
      season={season}
      scope={scope}
      compact
      filterBasePath="/player"
      selectInPlace
    />
  );

  return (
    <div
      className={`${hasPlayer ? styles.hubOpen : styles.hub} ${
        hasPlayer ? styles.hubDetail : styles.hubList
      }`}
      data-player-view={hasPlayer ? "detail" : "list"}
    >
      <PlayerExplorer
        averagesTable={averagesTable}
        outsideTop250={outsideTop250}
      />
    </div>
  );
}
