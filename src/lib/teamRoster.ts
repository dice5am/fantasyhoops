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
