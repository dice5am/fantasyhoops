import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SCOPE,
  DEFAULT_SEASON,
  getPlayerDirectory,
  getSeasonPlayerAverages,
} from "@/lib/loadMart";
import { nameMatches } from "@/lib/normalize";
import { parseScope } from "@/lib/scope";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const directory = searchParams.get("directory");
  const q = searchParams.get("q") ?? "";

  try {
    // Phase 3: distinct player directory for search/select (unicode-aware)
    if (directory === "1" || directory === "true") {
      let players = await getPlayerDirectory();
      if (q.trim()) {
        players = players.filter((p) => nameMatches(p.full_name, q));
      }
      return NextResponse.json({
        count: players.length,
        players,
      });
    }

    const season = searchParams.get("season") || DEFAULT_SEASON;
    const season_type_scope = parseScope(
      searchParams.get("season_type_scope") ?? searchParams.get("scope")
    );

    const rows = await getSeasonPlayerAverages({ season, season_type_scope });
    const filtered = q.trim()
      ? rows.filter((r) => nameMatches(r.full_name, q))
      : rows;

    return NextResponse.json({
      season,
      season_type_scope,
      count: filtered.length,
      rows: filtered,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
