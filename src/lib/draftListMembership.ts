import { getInsightLists } from "@/lib/loadInsightLists";

/** Server-side: which Insights lists each player is on (bundled insights.json, by player_id). */
export type ListMembership = {
  lists: { id: string; title: string }[];
  byPlayer: Record<string, string[]>;
  /** List id → player ids in list rank order (for Sort by a list). */
  order: Record<string, string[]>;
};

export function getListMembership(): ListMembership | null {
  const payload = getInsightLists();
  if (!payload) return null;
  const byPlayer: Record<string, string[]> = {};
  const order: Record<string, string[]> = {};
  for (const list of payload.lists) {
    order[list.id] = list.rows.map((r) => String(r.player_id));
    for (const row of list.rows) {
      const id = String(row.player_id);
      (byPlayer[id] ??= []).includes(list.id) || byPlayer[id].push(list.id);
    }
  }
  return { lists: payload.lists.map((l) => ({ id: l.id, title: l.title })), byPlayer, order };
}
