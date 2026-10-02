/**
 * Join season_schedule_2026_27 with Yahoo Game Week lookup.
 * Soft-empty when date outside YAHOO_WEEKS table.
 */
import type { SeasonScheduleRow } from "@/types/season_schedule";
import {
  CUP_FINAL_DATE_2026_27,
  eachDateInWeek,
  getYahooWeek,
  isCupChampionshipGame,
  weekForDate,
  type YahooWeek,
  YAHOO_WEEKS_2026_27,
} from "@/lib/yahooWeeks";

export type ClassifiedGame = SeasonScheduleRow & {
  fantasy_week_id: string | null;
  fantasy_week_number: number | null;
  counts_for_fantasy: boolean;
  is_cup_final: boolean;
  event_type: "regular" | "nba_cup" | "nba_cup_final" | "other";
};

export function classifyGame(
  row: SeasonScheduleRow & {
    game_subtype?: string | null;
    game_label?: string | null;
  }
): ClassifiedGame {
  const week = weekForDate(row.game_date);
  const cupFinal = isCupChampionshipGame({
    game_date: row.game_date,
    game_subtype: row.game_subtype,
    game_label: row.game_label,
  });
  const subtype = (row.game_subtype ?? "").toLowerCase();
  const label = (row.game_label ?? "").toLowerCase();
  let event_type: ClassifiedGame["event_type"] = "regular";
  if (cupFinal) event_type = "nba_cup_final";
  else if (label.includes("cup") || subtype.includes("in-season"))
    event_type = "nba_cup";
  else if (label || subtype) event_type = "other";

  return {
    ...row,
    fantasy_week_id: week?.fantasy_week_id ?? null,
    fantasy_week_number: week?.week_number ?? null,
    counts_for_fantasy: !cupFinal,
    is_cup_final: cupFinal,
    event_type,
  };
}

export type DayStripCell = {
  date: string;
  dow: string;
  games: ClassifiedGame[];
  counting_games: number;
};

export type RosterDensity = {
  player_id: string;
  full_name: string;
  team_abbreviation: string | null;
  games_this_week: number;
  home: number;
  away: number;
  /** Games that count for fantasy (excludes Cup final). */
  counting: number;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dow(dateIso: string): string {
  const d = new Date(`${dateIso.slice(0, 10)}T12:00:00Z`);
  return DOW[d.getUTCDay()] ?? "";
}

export function buildDayStrip(
  week: YahooWeek,
  games: ClassifiedGame[],
  opts?: {
    homeAway?: "all" | "home" | "away";
    teamAbbrs?: Set<string> | null;
  }
): DayStripCell[] {
  const ha = opts?.homeAway ?? "all";
  const teams = opts?.teamAbbrs ?? null;
  const dates = eachDateInWeek(week);
  return dates.map((date) => {
    let dayGames = games.filter((g) => g.game_date.slice(0, 10) === date);
    if (teams && teams.size > 0) {
      dayGames = dayGames.filter(
        (g) =>
          (g.home_team_abbreviation &&
            teams.has(g.home_team_abbreviation)) ||
          (g.away_team_abbreviation && teams.has(g.away_team_abbreviation))
      );
    }
    if (ha === "home" && teams) {
      dayGames = dayGames.filter(
        (g) =>
          g.home_team_abbreviation && teams.has(g.home_team_abbreviation)
      );
    } else if (ha === "away" && teams) {
      dayGames = dayGames.filter(
        (g) =>
          g.away_team_abbreviation && teams.has(g.away_team_abbreviation)
      );
    }
    return {
      date,
      dow: dow(date),
      games: dayGames,
      counting_games: dayGames.filter((g) => g.counts_for_fantasy).length,
    };
  });
}

/** Density for rostered players by their NBA team abbr this fantasy week. */
export function buildRosterDensity(
  week: YahooWeek,
  games: ClassifiedGame[],
  roster: {
    player_id: string;
    full_name: string;
    team_abbreviation: string | null;
  }[]
): RosterDensity[] {
  const inWeek = games.filter(
    (g) =>
      g.fantasy_week_number === week.week_number ||
      (g.game_date >= week.start_date && g.game_date <= week.end_date)
  );
  return roster.map((p) => {
    const abbr = p.team_abbreviation;
    if (!abbr) {
      return {
        player_id: p.player_id,
        full_name: p.full_name,
        team_abbreviation: null,
        games_this_week: 0,
        home: 0,
        away: 0,
        counting: 0,
      };
    }
    let home = 0;
    let away = 0;
    let counting = 0;
    for (const g of inWeek) {
      const isHome = g.home_team_abbreviation === abbr;
      const isAway = g.away_team_abbreviation === abbr;
      if (!isHome && !isAway) continue;
      if (isHome) home += 1;
      if (isAway) away += 1;
      if (g.counts_for_fantasy) counting += 1;
    }
    return {
      player_id: p.player_id,
      full_name: p.full_name,
      team_abbreviation: abbr,
      games_this_week: home + away,
      home,
      away,
      counting,
    };
  });
}

/** Games for one NBA team abbr in a date window (inclusive). */
export function teamGamesInRange(
  games: ClassifiedGame[],
  teamAbbr: string,
  start: string,
  end: string
): { home: number; away: number; counting: number; total: number } {
  let home = 0;
  let away = 0;
  let counting = 0;
  for (const g of games) {
    const d = g.game_date.slice(0, 10);
    if (d < start || d > end) continue;
    const isHome = g.home_team_abbreviation === teamAbbr;
    const isAway = g.away_team_abbreviation === teamAbbr;
    if (!isHome && !isAway) continue;
    if (isHome) home += 1;
    if (isAway) away += 1;
    if (g.counts_for_fantasy) counting += 1;
  }
  return { home, away, counting, total: home + away };
}

export function addDaysIso(dateIso: string, days: number): string {
  const t = new Date(`${dateIso.slice(0, 10)}T12:00:00Z`).getTime();
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

export { getYahooWeek, YAHOO_WEEKS_2026_27, CUP_FINAL_DATE_2026_27 };
