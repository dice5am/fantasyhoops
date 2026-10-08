import { InsightsLists } from "@/components/insights/InsightsLists";
import type { StatLineValues } from "@/components/StatLine";
import { getDraftBoard } from "@/lib/loadDraftBoard";
import { getInsightLists } from "@/lib/loadInsightLists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /insights — Analyst lists only (data/insights/insights.json).
 * Old Pulse/Briefs content lives at /insights/archive (no nav link).
 * Row 9-stat lines come from the same 2025-26 per-game averages as the Draft pick cards.
 */
export default async function InsightsPage() {
  const data = getInsightLists();
  const board = await getDraftBoard().catch(() => null);
  const avgs: Record<string, StatLineValues> = {};
  const directory: { player_id: string; full_name: string }[] = [];
  for (const p of board?.players ?? []) {
    avgs[p.player_id] = p.avgs;
    directory.push({ player_id: p.player_id, full_name: p.full_name });
  }
  return <InsightsLists data={data} avgs={avgs} directory={directory} />;
}
