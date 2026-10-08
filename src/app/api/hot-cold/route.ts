import { NextResponse } from "next/server";
import { getHotColdPayload } from "@/lib/loadHotCold";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hot-cold
 * player_hot_cold (2025-26 vs 2023-24..2025-26, reg_only) + baseline_teams (228 rows).
 * Published marts only. Nulls stay null. Team rollups are computed client-side
 * from the live roster (not stored).
 */
export async function GET() {
  try {
    const payload = await getHotColdPayload();
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, code: "HOT_COLD_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
