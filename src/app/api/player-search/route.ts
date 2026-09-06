import { NextRequest, NextResponse } from "next/server";
import { getPlayerDirectory } from "@/lib/loadMart";
import { nameMatches } from "@/lib/normalize";

export const runtime = "nodejs";

const MIN_Q = 2;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const trimmed = q.trim();
  try {
    // Empty / short q must not dump the directory (prevents typeahead flash).
    if (trimmed.length < MIN_Q) {
      return NextResponse.json({ q, count: 0, players: [] });
    }
    const all = await getPlayerDirectory();
    const rows = all.filter((p) => nameMatches(p.full_name, trimmed)).slice(0, 40);
    return NextResponse.json({ q, count: rows.length, players: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
