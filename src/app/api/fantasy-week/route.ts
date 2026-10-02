import { NextRequest, NextResponse } from "next/server";
import {
  DRAFT_PREP_SEASON,
  getSeasonScheduleForFantasy,
  seasonScheduleAvailable,
} from "@/lib/loadSeasonSchedule";
import {
  buildDayStrip,
  buildRosterDensity,
  classifyGame,
  teamGamesInRange,
  addDaysIso,
} from "@/lib/scheduleWeek";
import {
  defaultWeekNumber,
  getYahooWeek,
  YAHOO_WEEKS_2026_27,
  weekChipLabel,
  formatWeekRange,
} from "@/lib/yahooWeeks";
import { getPrimaryTeamMap } from "@/lib/loadGameLogs";
import { TEAM_PRIOR_SEASON } from "@/types/season_player_averages";

export const runtime = "nodejs";

/**
 * GET /api/fantasy-week?week=7&teams=DAL,DEN&homeAway=all
 * Yahoo Game Week join against season_schedule_2026_27.
 * Soft-empty when week/date outside embedded lookup.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const weekParam = sp.get("week");
  const weekNum = weekParam
    ? Number.parseInt(weekParam, 10)
    : defaultWeekNumber();
  const week = getYahooWeek(weekNum);
  if (!week) {
    return NextResponse.json(
      {
        soft_empty: true,
        reason: "Week outside Yahoo 2026-27 lookup table",
        weeks: YAHOO_WEEKS_2026_27.map((w) => ({
          week_number: w.week_number,
          label: weekChipLabel(w),
          start_date: w.start_date,
          end_date: w.end_date,
          is_double_week: w.is_double_week,
          is_partial_week: w.is_partial_week,
        })),
      },
      { status: 200 }
    );
  }

  if (!seasonScheduleAvailable()) {
    return NextResponse.json({
      soft_empty: true,
      reason: "Schedule mart not published",
      week,
      range_label: formatWeekRange(week),
      weeks: YAHOO_WEEKS_2026_27,
    });
  }

  const payload = await getSeasonScheduleForFantasy({ season: DRAFT_PREP_SEASON });
  const classified = payload.rows.map(classifyGame);
  const inWeek = classified.filter(
    (g) =>
      g.game_date >= week.start_date && g.game_date <= week.end_date
  );

  const teamsRaw = sp.get("teams")?.trim() ?? "";
  const teamAbbrs = teamsRaw
    ? new Set(
        teamsRaw
          .split(",")
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
      )
    : null;

  const rosterRaw = sp.get("roster")?.trim() ?? "";
  // roster=player_id|Name|ABBR;...
  const roster = rosterRaw
    ? rosterRaw.split(";").map((part) => {
        const [player_id, full_name, team_abbreviation] = part.split("|");
        return {
          player_id: player_id ?? "",
          full_name: full_name ?? player_id ?? "",
          team_abbreviation: team_abbreviation || null,
        };
      }).filter((r) => r.player_id)
    : [];

  const homeAway = (sp.get("homeAway") as "all" | "home" | "away") || "all";
  const days = buildDayStrip(week, inWeek, {
    homeAway,
    teamAbbrs,
  });
  const density =
    roster.length > 0 ? buildRosterDensity(week, inWeek, roster) : [];

  let playerTeam = sp.get("player_team")?.trim().toUpperCase() || null;
  const playerId = sp.get("player_id")?.trim() || null;
  if (!playerTeam && playerId) {
    const map = await getPrimaryTeamMap({
      season: TEAM_PRIOR_SEASON,
      season_type_scope: "reg_only",
    });
    playerTeam = map.get(playerId)?.toUpperCase() || null;
  }
  let player_week = null;
  if (playerTeam) {
    const tw = teamGamesInRange(
      classified,
      playerTeam,
      week.start_date,
      week.end_date
    );
    const today = new Date().toISOString().slice(0, 10);
    const n7end = addDaysIso(today, 6);
    const next7 = teamGamesInRange(classified, playerTeam, today, n7end);
    player_week = {
      team: playerTeam,
      player_id: playerId,
      this_week: {
        ...tw,
        week_label: weekChipLabel(week),
        week_number: week.week_number,
      },
      next_7: next7,
    };
  }

  return NextResponse.json({
    soft_empty: false,
    week,
    range_label: formatWeekRange(week),
    days,
    density,
    player_week,
    game_count: inWeek.length,
    counting_game_count: inWeek.filter((g) => g.counts_for_fantasy).length,
    weeks: YAHOO_WEEKS_2026_27.map((w) => ({
      week_number: w.week_number,
      label: weekChipLabel(w),
      start_date: w.start_date,
      end_date: w.end_date,
      is_double_week: w.is_double_week,
      is_partial_week: w.is_partial_week,
      notes: w.notes,
    })),
  });
}
