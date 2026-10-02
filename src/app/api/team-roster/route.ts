/**
 * Team roster averages — Analyst TEAM-COMPARE-RULES.md
 * SoT: skyscraper/.../TEAM-COMPARE-RULES.md (mirror nba-phase1/docs/)
 *
 * Locks: both legs reg_only · averages only · avg_fg3m only · no invented zeros.
 * Never sum_fg3m/gp fallback. Never fantasy scores.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSeasonPlayerAverages } from "@/lib/loadMart";
import { getPrimaryTeamMap } from "@/lib/loadGameLogs";
import {
  TEAM_DEFAULT_SEASON,
  TEAM_PRIOR_SEASON,
  TEAM_DEFAULT_SCOPE,
  SEASON_OPTIONS,
} from "@/types/season_player_averages";
import type { SeasonPlayerAverage } from "@/types/season_player_averages";
import { getTeamColors } from "@/lib/teamColors";

export const runtime = "nodejs";

function pickMetrics(row: SeasonPlayerAverage | null) {
  if (!row) return null;
  return {
    player_id: row.player_id,
    full_name: row.full_name,
    season: row.season,
    season_type_scope: row.season_type_scope,
    gp: row.gp,
    avg_min: row.avg_min,
    avg_pts: row.avg_pts,
    avg_reb: row.avg_reb,
    avg_ast: row.avg_ast,
    avg_stl: row.avg_stl,
    avg_blk: row.avg_blk,
    avg_tov: row.avg_tov,
    /** Mart avg_fg3m only — never sum_fg3m/gp. */
    avg_fg3m: row.avg_fg3m ?? null,
    fg_pct: row.fg_pct,
    ft_pct: row.ft_pct,
  };
}

function parsePlayerIds(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].slice(0, 20);
}

function parseSeasonOr(raw: string | null, fallback: string): string {
  if (raw && (SEASON_OPTIONS as string[]).includes(raw)) return raw;
  return fallback;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const playerIds = parsePlayerIds(searchParams.get("player_ids"));
  const season = parseSeasonOr(
    searchParams.get("season"),
    TEAM_DEFAULT_SEASON
  );
  const priorSeason = parseSeasonOr(
    searchParams.get("prior_season"),
    TEAM_PRIOR_SEASON
  );
  // Analyst lock: Team compare never reads playoff scopes.
  const scope = TEAM_DEFAULT_SCOPE;

  if (playerIds.length === 0) {
    return NextResponse.json({
      season,
      prior_season: priorSeason,
      season_type_scope: scope,
      players: [],
    });
  }

  try {
    const [currentRows, priorRows, teamMapCurrent, teamMapPrior] =
      await Promise.all([
        getSeasonPlayerAverages({ season, season_type_scope: scope }),
        getSeasonPlayerAverages({
          season: priorSeason,
          season_type_scope: scope,
        }),
        getPrimaryTeamMap({ season, season_type_scope: scope }),
        getPrimaryTeamMap({
          season: priorSeason,
          season_type_scope: scope,
        }),
      ]);

    const currentById = new Map(currentRows.map((r) => [r.player_id, r]));
    const priorById = new Map(priorRows.map((r) => [r.player_id, r]));

    // Preserve request (roster) order — Analyst §5.
    const players = playerIds.map((player_id) => {
      const current = pickMetrics(currentById.get(player_id) ?? null);
      const prior = pickMetrics(priorById.get(player_id) ?? null);
      // Prefer prior-season team when current boxes empty (early 2026-27).
      const team_abbreviation =
        teamMapCurrent.get(player_id) ??
        teamMapPrior.get(player_id) ??
        null;
      const token = getTeamColors(team_abbreviation);
      const full_name = current?.full_name ?? prior?.full_name ?? null;
      return {
        player_id,
        full_name,
        team_abbreviation,
        chart_primary: token?.chartPrimary ?? null,
        current,
        prior,
      };
    });

    return NextResponse.json({
      season,
      prior_season: priorSeason,
      season_type_scope: scope,
      players,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
