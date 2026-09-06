import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SCOPE,
  DEFAULT_SEASON,
  getPlayerDirectoryTop250,
} from "@/lib/loadMart";
import { nameMatches } from "@/lib/normalize";
import { parseScope } from "@/lib/scope";

export const runtime = "nodejs";

const MIN_Q = 2;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const trimmed = q.trim();
  const season = searchParams.get("season") || DEFAULT_SEASON;
  const season_type_scope = parseScope(
    searchParams.get("season_type_scope") ?? searchParams.get("scope")
  );
  try {
    // Empty / short q must not dump the directory (prevents typeahead flash).
    if (trimmed.length < MIN_Q) {
      return NextResponse.json({ q, count: 0, players: [] });
    }
    // Restrict hits to Top-250 of request season+scope (else default 2025-26 reg_only)
    const all = await getPlayerDirectoryTop250({ season, season_type_scope });
    const rows = all.filter((p) => nameMatches(p.full_name, trimmed)).slice(0, 40);
    return NextResponse.json({
      q,
      count: rows.length,
      players: rows,
      season,
      season_type_scope,
      pool: "top250",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
