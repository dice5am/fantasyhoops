import { NextRequest, NextResponse } from "next/server";
import {
  awaitingFantasyScoresPayload,
  fantasyScoreAvailable,
  fantasyScorePath,
  FantasyScoreUnavailableError,
  getFantasyScores,
} from "@/lib/loadFantasyScores";
import { parseScope, parseSeason } from "@/lib/scope";
import { parseTopPct } from "@/lib/top250";

export const runtime = "nodejs";

/**
 * GET /api/fantasy-scores?season=&scope=&topPct=
 * Consumes player_fantasy_scores.parquet (fantasy-score-v1).
 * topPct<100 → score_pool recompute on narrowed pool.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const season = parseSeason(searchParams.get("season"));
  const scope = parseScope(
    searchParams.get("scope") ?? searchParams.get("season_type_scope")
  );
  const topPct = parseTopPct(
    searchParams.get("topPct") ?? searchParams.get("top_pct")
  );
  const parquet_path = fantasyScorePath();

  if (!fantasyScoreAvailable()) {
    const awaiting = awaitingFantasyScoresPayload({
      season,
      season_type_scope: scope,
      topPct,
    });
    return NextResponse.json(
      {
        error:
          "Fantasy score mart not published yet — awaiting Data parquet",
        code: "FANTASY_SCORE_UNAVAILABLE",
        ...awaiting,
      },
      { status: 503 }
    );
  }

  try {
    const payload = await getFantasyScores({
      season,
      season_type_scope: scope,
      topPct,
    });
    if (!payload) {
      const awaiting = awaitingFantasyScoresPayload({
        season,
        season_type_scope: scope,
        topPct,
      });
      return NextResponse.json(
        {
          error: "Fantasy score mart unavailable",
          code: "FANTASY_SCORE_UNAVAILABLE",
          ...awaiting,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof FantasyScoreUnavailableError) {
      const awaiting = awaitingFantasyScoresPayload({
        season,
        season_type_scope: scope,
        topPct,
      });
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          ...awaiting,
          meta: { ...awaiting.meta, parquet_path: err.path },
        },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: message,
        mart_available: fantasyScoreAvailable(),
        parquet_path,
      },
      { status: 500 }
    );
  }
}
