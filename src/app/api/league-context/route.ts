import { NextRequest, NextResponse } from "next/server";
import { getLeagueContext } from "@/lib/loadMart";
import { parseScope, parseSeason } from "@/lib/scope";
import { parseTopPct } from "@/lib/top250";

export const runtime = "nodejs";

/**
 * GET /api/league-context?season=&scope=&topPct=
 * topPct: integer 10–100 (default 100) — Top X% by minutes within top-250.
 * Legacy ?universe= → treated as topPct 100.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const season = parseSeason(searchParams.get("season"));
  const scope = parseScope(
    searchParams.get("scope") ?? searchParams.get("season_type_scope")
  );

  const topPctRaw = searchParams.get("topPct") ?? searchParams.get("top_pct");
  const universeRaw = searchParams.get("universe");
  const topPct =
    topPctRaw != null && topPctRaw !== ""
      ? parseTopPct(topPctRaw)
      : universeRaw != null && universeRaw !== ""
        ? 100
        : parseTopPct(undefined);

  const minGpRaw = searchParams.get("min_gp");
  const minMinRaw = searchParams.get("min_min");

  const min_gp =
    minGpRaw != null && minGpRaw !== "" && !Number.isNaN(Number(minGpRaw))
      ? Number(minGpRaw)
      : undefined;
  const min_min =
    minMinRaw != null && minMinRaw !== "" && !Number.isNaN(Number(minMinRaw))
      ? Number(minMinRaw)
      : undefined;

  try {
    const ctx = await getLeagueContext({
      season,
      season_type_scope: scope,
      topPct,
      min_gp,
      min_min,
    });
    return NextResponse.json(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
