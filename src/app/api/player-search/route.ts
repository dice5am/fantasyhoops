import { NextRequest, NextResponse } from "next/server";
import { getPlayerDirectory } from "@/lib/loadMart";
import { nameMatches } from "@/lib/normalize";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const all = await getPlayerDirectory();
    const rows = q.trim()
      ? all.filter((p) => nameMatches(p.full_name, q)).slice(0, 40)
      : all.slice(0, 40);
    return NextResponse.json({ q, count: rows.length, players: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
