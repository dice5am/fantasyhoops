import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SCOPE,
  DEFAULT_SEASON,
  getPlayerDirectoryTop250,
  getSeasonPlayerAveragesTop250,
} from "@/lib/loadMart";
import { nameMatches } from "@/lib/normalize";
import { parseScope } from "@/lib/scope";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const directory = searchParams.get("directory");
  const q = searchParams.get("q") ?? "";

  try {
    const season = searchParams.get("season") || DEFAULT_SEASON;
    const season_type_scope = parseScope(
      searchParams.get("season_type_scope") ?? searchParams.get("scope")
    );

    // Directory / typeahead: Top-250 pool for season+scope (default 2025-26 reg_only)
    if (directory === "1" || directory === "true") {
      let players = await getPlayerDirectoryTop250({
        season,
        season_type_scope,
      });
      if (q.trim()) {
        players = players.filter((p) => nameMatches(p.full_name, q));
      }
      return NextResponse.json({
        count: players.length,
        players,
        season,
        season_type_scope,
        pool: "top250",
      });
    }

    // Averages list: Top-250 for season+scope (full mart still available via player-averages)
    const rows = await getSeasonPlayerAveragesTop250({
      season,
      season_type_scope,
    });
    const filtered = q.trim()
      ? rows.filter((r) => nameMatches(r.full_name, q))
      : rows;

    return NextResponse.json({
      season,
      season_type_scope,
      count: filtered.length,
      rows: filtered,
      pool: "top250",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
