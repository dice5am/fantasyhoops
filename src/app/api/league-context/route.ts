import { NextRequest, NextResponse } from "next/server";
import { getLeagueContext } from "@/lib/loadMart";
import { parseScope, parseSeason } from "@/lib/scope";
import { parseUniverse } from "@/lib/universe";

export const runtime = "nodejs";

/**
 * GET /api/league-context?season=&scope=&universe=
 * Universe presets: all | min20 (default) | top10min — server-side avg_min filter.
 * Reserved (documented, optional): min_gp, min_min, top_pct
 * Any reg_plus_playoffs → reg_only.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const season = parseSeason(searchParams.get("season"));
  const scope = parseScope(
    searchParams.get("scope") ?? searchParams.get("season_type_scope")
  );
  const universe = parseUniverse(searchParams.get("universe"));

  const minGpRaw = searchParams.get("min_gp");
  const minMinRaw = searchParams.get("min_min");
  const topPctRaw = searchParams.get("top_pct");

  const min_gp =
    minGpRaw != null && minGpRaw !== "" && !Number.isNaN(Number(minGpRaw))
      ? Number(minGpRaw)
      : undefined;
  const min_min =
    minMinRaw != null && minMinRaw !== "" && !Number.isNaN(Number(minMinRaw))
      ? Number(minMinRaw)
      : undefined;
  const top_pct =
    topPctRaw != null && topPctRaw !== "" && !Number.isNaN(Number(topPctRaw))
      ? Number(topPctRaw)
      : undefined;

  try {
    const ctx = await getLeagueContext({
      season,
      season_type_scope: scope,
      universe,
      min_gp,
      min_min,
      top_pct,
    });
    return NextResponse.json(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
