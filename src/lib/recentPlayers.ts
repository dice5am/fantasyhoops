export type RecentPlayer = { player_id: string; full_name: string };

const KEY = "fantasyhoops.recentPlayers";
const MAX = 8;

export function readRecentPlayers(): RecentPlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentPlayer[];
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

export function pushRecentPlayer(p: RecentPlayer): RecentPlayer[] {
  if (typeof window === "undefined") return [];
  const next = [
    { player_id: String(p.player_id), full_name: p.full_name },
    ...readRecentPlayers().filter((x) => x.player_id !== String(p.player_id)),
  ].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}
