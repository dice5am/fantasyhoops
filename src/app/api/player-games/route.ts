import { NextRequest, NextResponse } from "next/server";
import { getPlayerGameLogs } from "@/lib/loadGameLogs";
import { parseScope } from "@/lib/scope";
import { MAX_SELECTED_SEASONS, SEASON_OPTIONS } from "@/types/season_player_averages";

export const runtime = "nodejs";

function parseSeasons(v: string | null): string[] {
  if (!v) return [...SEASON_OPTIONS];
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set(SEASON_OPTIONS as string[]);
  const filtered = parts.filter((s) => allowed.has(s));
  const capped = (filtered.length > 0 ? filtered : [...SEASON_OPTIONS]).slice(0, MAX_SELECTED_SEASONS);
  return capped;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const player_id = searchParams.get("player_id");
  if (!player_id) {
    return NextResponse.json(
      { error: "player_id is required" },
      { status: 400 }
    );
  }

  const season_type_scope = parseScope(
    searchParams.get("season_type_scope") ?? searchParams.get("scope")
  );
  const seasons = parseSeasons(
    searchParams.get("seasons") ?? searchParams.get("season")
  );

  try {
    const rows = await getPlayerGameLogs({
      player_id,
      seasons,
      season_type_scope,
    });
    return NextResponse.json({
      player_id,
      seasons,
      season_type_scope,
      count: rows.length,
      rows,
      games: rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
