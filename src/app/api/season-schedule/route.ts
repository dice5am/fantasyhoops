import { NextRequest, NextResponse } from "next/server";
import {
  DRAFT_PREP_SEASON,
  getSeasonSchedule,
  seasonScheduleAvailable,
  seasonSchedulePath,
} from "@/lib/loadSeasonSchedule";

export const runtime = "nodejs";

/**
 * GET /api/season-schedule?season=2026-27
 * Returns Regular Season rows only (Draft Prep reg_only).
 */
export async function GET(req: NextRequest) {
  const season =
    req.nextUrl.searchParams.get("season")?.trim() || DRAFT_PREP_SEASON;

  if (!seasonScheduleAvailable()) {
    return NextResponse.json(
      {
        error: "Season schedule mart not published",
        code: "SCHEDULE_UNAVAILABLE",
        parquet_path: seasonSchedulePath(),
      },
      { status: 503 }
    );
  }

  const payload = await getSeasonSchedule({ season });
  return NextResponse.json(payload);
}
