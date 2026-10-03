/**
 * Team tab roster — localStorage persistence (Spec board 02).
 * No live draft sync.
 */

export type RosterPlayer = {
  player_id: string;
  full_name: string;
  /** Best-effort prior-season abbr when known. */
  team_abbreviation?: string | null;
};

const KEY = "fantasyhoops.teamRoster";
const MAX = 15;

export function readTeamRoster(): RosterPlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RosterPlayer[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p &&
          typeof p.player_id === "string" &&
          typeof p.full_name === "string" &&
          p.player_id.length > 0
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function writeTeamRoster(players: RosterPlayer[]): RosterPlayer[] {
  if (typeof window === "undefined") return [];
  const next = players
    .map((p) => ({
      player_id: String(p.player_id),
      full_name: p.full_name,
      team_abbreviation: p.team_abbreviation ?? null,
    }))
    .slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function rosterHasPlayer(
  roster: RosterPlayer[],
  player_id: string
): boolean {
  return roster.some((p) => p.player_id === String(player_id));
}

export const TEAM_ROSTER_KEY = KEY;
export const TEAM_ROSTER_MAX = MAX;

export type RosterUpsertResult =
  | { ok: true; roster: RosterPlayer[]; added: boolean }
  | { ok: false; reason: "cap"; roster: RosterPlayer[] };

/**
 * Draft → Team write-through (DRAFT-RULES §5).
 * Upsert by player_id. Reject a new add at max 15 — never silent-drop someone else.
 */
export function upsertTeamRosterPlayer(
  player: RosterPlayer
): RosterUpsertResult {
  const current = readTeamRoster();
  const id = String(player.player_id);
  const idx = current.findIndex((p) => p.player_id === id);
  if (idx >= 0) {
    const next = current.slice();
    next[idx] = {
      player_id: id,
      full_name: player.full_name,
      team_abbreviation:
        player.team_abbreviation ?? next[idx]?.team_abbreviation ?? null,
    };
    return { ok: true, roster: writeTeamRoster(next), added: false };
  }
  if (current.length >= MAX) {
    return { ok: false, reason: "cap", roster: current };
  }
  return {
    ok: true,
    roster: writeTeamRoster([
      ...current,
      {
        player_id: id,
        full_name: player.full_name,
        team_abbreviation: player.team_abbreviation ?? null,
      },
    ]),
    added: true,
  };
}

export function removeTeamRosterPlayer(player_id: string): RosterPlayer[] {
  const id = String(player_id);
  return writeTeamRoster(readTeamRoster().filter((p) => p.player_id !== id));
}

export function clearTeamRoster(): RosterPlayer[] {
  return writeTeamRoster([]);
}
