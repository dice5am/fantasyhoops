"use client";

import { useEffect, useState } from "react";
import { PlayerHub } from "@/components/PlayerHub";
import { PlayerWeekCard } from "@/components/ux/PlayerWeekCard";
import {
  readTeamRoster,
  rosterHasPlayer,
} from "@/lib/teamRoster";
import { defaultWeekNumber, weekChipLabel, getYahooWeek } from "@/lib/yahooWeeks";
import type {
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";
import styles from "./PlayersBoard.module.css";

type Props = {
  rows: SeasonPlayerAverage[];
  season: string;
  scope: SeasonTypeScope;
  hasPlayer: boolean;
  outsideTop250?: boolean;
  playerId: string | null;
};

export function PlayersBoard({
  rows,
  season,
  scope,
  hasPlayer,
  outsideTop250 = false,
  playerId,
}: Props) {
  const [onRoster, setOnRoster] = useState(false);
  const [weekCard, setWeekCard] = useState<{
    name: string;
    team: string | null;
    thisWeek: { total: number; home: number; away: number; weekLabel: string };
    next7: { total: number };
    weekNum: number;
  } | null>(null);

  useEffect(() => {
    if (!playerId) {
      setWeekCard(null);
      setOnRoster(false);
      return;
    }
    const roster = readTeamRoster();
    setOnRoster(rosterHasPlayer(roster, playerId));
    const row = rows.find((r) => String(r.player_id) === String(playerId));
    const name = row?.full_name ?? "Player";
    const weekNum = defaultWeekNumber();
    const week = getYahooWeek(weekNum);

    async function load() {
      try {
        const qs = new URLSearchParams({
          week: String(weekNum),
          player_id: String(playerId),
        });
        const res = await fetch(`/api/fantasy-week?${qs}`);
        const data = await res.json();
        const pw = data.player_week;
        const team = pw?.team ?? null;
        setWeekCard({
          name,
          team,
          thisWeek: {
            total: pw?.this_week?.counting ?? pw?.this_week?.total ?? 0,
            home: pw?.this_week?.home ?? 0,
            away: pw?.this_week?.away ?? 0,
            weekLabel:
              pw?.this_week?.week_label ??
              (week ? weekChipLabel(week) : `W${weekNum}`),
          },
          next7: { total: pw?.next_7?.counting ?? pw?.next_7?.total ?? 0 },
          weekNum,
        });
      } catch {
        setWeekCard({
          name,
          team: null,
          thisWeek: {
            total: 0,
            home: 0,
            away: 0,
            weekLabel: week ? weekChipLabel(week) : `W${weekNum}`,
          },
          next7: { total: 0 },
          weekNum,
        });
      }
    }
    void load();
  }, [playerId, rows]);

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.kicker}>Players</p>
        <h1 className={styles.title}>
          {weekCard?.name
            ? weekCard.name
                .split(" ")
                .map((p, i, a) =>
                  i === 0 && a.length > 1 ? `${p[0]}.` : p
                )
                .join(" ")
            : "Players"}
        </h1>
      </header>

      {hasPlayer && weekCard ? (
        <div className={styles.weekSlot}>
          <PlayerWeekCard
            playerName={weekCard.name}
            teamAbbr={weekCard.team}
            onRoster={onRoster}
            thisWeek={weekCard.thisWeek}
            next7={weekCard.next7}
            handoffHref={`/team?view=matchup&week=${weekCard.weekNum}&player_id=${encodeURIComponent(playerId || "")}`}
          />
        </div>
      ) : null}

      <PlayerHub
        rows={rows}
        season={season}
        scope={scope}
        hasPlayer={hasPlayer}
        outsideTop250={outsideTop250}
      />
    </div>
  );
}
