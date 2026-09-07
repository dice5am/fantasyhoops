import { NextRequest, NextResponse } from "next/server";
import {
  denseSeriesAvailable,
  denseSeriesPath,
  DenseSeriesUnavailableError,
  denseScopeForUi,
  getDensePlayerGames,
} from "@/lib/loadDenseSeries";
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
  return (filtered.length > 0 ? filtered : [...SEASON_OPTIONS]).slice(0, MAX_SELECTED_SEASONS);
}

/**
 * Dense game-index series for PlayerExplorer.
 * - 503 when parquet is not on disk (no silent curated / played-sequence fallback).
 * - 200 + empty rows when parquet exists but player/season has no slots.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const player_id = searchParams.get("player_id");
  if (!player_id) {
    return NextResponse.json(
      { error: "player_id is required", dense_available: false },
      { status: 400 }
    );
  }

  const season_type_scope = parseScope(
    searchParams.get("season_type_scope") ?? searchParams.get("scope")
  );
  const dense_scope = denseScopeForUi(season_type_scope);
  const seasons = parseSeasons(
    searchParams.get("seasons") ?? searchParams.get("season")
  );
  const parquet_path = denseSeriesPath();

  if (!denseSeriesAvailable()) {
    return NextResponse.json(
      {
        error:
          "Dense game series not published yet — awaiting Data parquet at NBA_DENSE_SERIES_PATH",
        code: "DENSE_SERIES_UNAVAILABLE",
        dense_available: false,
        source: null,
        parquet_path,
        player_id,
        seasons,
        season_type_scope: dense_scope,
        count: 0,
        rows: [],
      },
      { status: 503 }
    );
  }

  try {
    const rows = await getDensePlayerGames({
      player_id,
      seasons,
      season_type_scope,
    });
    return NextResponse.json({
      player_id,
      seasons,
      season_type_scope: dense_scope,
      count: rows.length,
      played_count: rows.filter((r) => r.is_played).length,
      rows,
      source: "dense",
      dense_available: true,
      parquet_path,
    });
  } catch (err) {
    if (err instanceof DenseSeriesUnavailableError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          dense_available: false,
          source: null,
          parquet_path: err.path,
          player_id,
          seasons,
          season_type_scope: dense_scope,
          count: 0,
          rows: [],
        },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, dense_available: denseSeriesAvailable() },
      { status: 500 }
    );
  }
}
