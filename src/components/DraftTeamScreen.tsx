"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { DraftAssistant, DRAFT_SETUP_EVENT, DRAFT_SETUP_KEY } from "@/components/draft/DraftAssistant";
import { TeamBoard } from "@/components/TeamBoard";
import { TeamRollupPanel } from "@/components/team/TeamRollupPanel";
import { validateSetup, type DraftSetup } from "@/lib/draftMath";
import {
  readTeamRoster,
  TEAM_ROSTER_EVENT,
  TEAM_ROSTER_KEY,
  TEAM_ROSTER_MAX,
  type RosterPlayer,
} from "@/lib/teamRoster";
import { isDraftComplete } from "@/lib/teamRollup";
import styles from "./DraftTeamScreen.module.css";

/**
 * Draft + Team on one screen (/draft and /team both land here).
 * Until every pick in the setup is made (or the roster is full), the Draft board
 * is on top and Team sits below. After the draft, Team is on top and Draft drops lower.
 * Roster storage is unchanged: localStorage fantasyhoops.teamRoster, same shape.
 */

function readSetup(): DraftSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSetup;
    return validateSetup(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export function DraftTeamScreen() {
  const [hydrated, setHydrated] = useState(false);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [setup, setSetup] = useState<DraftSetup | null>(null);

  const sync = useCallback(() => {
    setRoster(readTeamRoster());
    setSetup(readSetup());
  }, []);

  useEffect(() => {
    sync();
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === TEAM_ROSTER_KEY || e.key === DRAFT_SETUP_KEY || e.key == null) sync();
    };
    window.addEventListener(TEAM_ROSTER_EVENT, sync);
    window.addEventListener(DRAFT_SETUP_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TEAM_ROSTER_EVENT, sync);
      window.removeEventListener(DRAFT_SETUP_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);

  const done = hydrated && isDraftComplete(setup, roster.length, TEAM_ROSTER_MAX);

  const picked = roster.length > 0;
  const team = (
    <div className={styles.team} id="team">
      {/* While drafting at desktop width, the full You/Avg/Slot table + chart sit on top. */}
      <div className={done ? undefined : picked ? styles.rollupBelowNarrow : styles.rollupBelow}>
        <TeamRollupPanel roster={roster} setup={setup} />
      </div>
      <Suspense fallback={<div className={styles.loading}>Loading team…</div>}>
        <TeamBoard />
      </Suspense>
    </div>
  );
  const draft = (
    <div className={styles.draft} id="draft">
      <DraftAssistant />
    </div>
  );

  return (
    <div className={styles.screen} data-draft-state={done ? "done" : "drafting"}>
      {done ? (
        <>
          {team}
          {draft}
        </>
      ) : (
        <>
          <div className={picked ? styles.stripNarrow : styles.stripTop}>
            <TeamRollupPanel roster={roster} setup={setup} compact />
          </div>
          {picked ? (
            <div className={styles.rollupTopWide}>
              <TeamRollupPanel roster={roster} setup={setup} />
            </div>
          ) : null}
          {draft}
          {team}
        </>
      )}
    </div>
  );
}
