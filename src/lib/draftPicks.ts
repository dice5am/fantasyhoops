/**
 * Draft-night local state beside the Team roster.
 * - fantasyhoops.teamRoster  : unchanged (Mine writes there via teamRoster.ts).
 * - fantasyhoops.draftTaken  : other teams' picks [{player_id, full_name}] (own key).
 * - fantasyhoops.draftHistory: ordered Mine/Taken actions for Undo [{t, player_id}].
 * - fantasyhoops.draftPrefs  : persisted Last/3yr window + Cover/Stack mode + sort.
 * Nothing is stored server-side.
 */

export const DRAFT_TAKEN_KEY = "fantasyhoops.draftTaken";
export const DRAFT_HISTORY_KEY = "fantasyhoops.draftHistory";
export const DRAFT_PREFS_KEY = "fantasyhoops.draftPrefs";

export type TakenPlayer = { player_id: string; full_name: string };
export type DraftAction = { t: "mine" | "taken"; player_id: string };
export type DraftPrefs = {
  windowMode: "last" | "three_yr";
  suggestMode: "cover" | "stack";
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function readTaken(): TakenPlayer[] {
  const v = readJson<unknown>(DRAFT_TAKEN_KEY, []);
  if (!Array.isArray(v)) return [];
  return v.filter(
    (p): p is TakenPlayer =>
      Boolean(p) && typeof p.player_id === "string" && typeof p.full_name === "string"
  );
}

export function writeTaken(list: TakenPlayer[]): TakenPlayer[] {
  writeJson(DRAFT_TAKEN_KEY, list);
  return list;
}

export function readHistory(): DraftAction[] {
  const v = readJson<unknown>(DRAFT_HISTORY_KEY, []);
  if (!Array.isArray(v)) return [];
  return v.filter(
    (a): a is DraftAction =>
      Boolean(a) && (a.t === "mine" || a.t === "taken") && typeof a.player_id === "string"
  );
}

export function writeHistory(list: DraftAction[]): DraftAction[] {
  writeJson(DRAFT_HISTORY_KEY, list.slice(-400));
  return list;
}

export function readPrefs(): DraftPrefs {
  const v = readJson<Partial<DraftPrefs>>(DRAFT_PREFS_KEY, {});
  return {
    windowMode: v.windowMode === "three_yr" ? "three_yr" : "last",
    suggestMode: v.suggestMode === "cover" ? "cover" : "stack",
  };
}

export function writePrefs(p: DraftPrefs) {
  writeJson(DRAFT_PREFS_KEY, p);
}
