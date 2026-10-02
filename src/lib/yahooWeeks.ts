/**
 * Yahoo Fantasy NBA Game Week lookup — 2026-27 (embedded).
 * SoT: phase-ux-overhaul/shared/yahoo-fantasy-schedule-brief.md · YAHOO_WEEK_UX.md
 * NEVER treat ISO weeks as Yahoo Game Weeks.
 * Soft-empty when date falls outside this table.
 */

export type YahooWeek = {
  fantasy_week_id: string;
  season_id: string;
  week_number: number;
  label: string;
  start_date: string; // YYYY-MM-DD inclusive
  end_date: string;
  duration_days: number;
  is_double_week: boolean;
  is_partial_week: boolean;
  yahoo_asterisk: boolean;
  default_is_playoff_week: boolean;
  notes: string;
};

export const YAHOO_SEASON_ID = "2026-27";

/** Cup championship Fri Dec 11 — counts_for_fantasy=false (Yahoo Help + Yahoo Sports). */
export const CUP_FINAL_DATE_2026_27 = "2026-12-11";

/**
 * Documented 2026–27 Yahoo Game Weeks (23).
 * W1 partial Oct 20–25 · W7 Cup double Nov 30–Dec 13 · W17 All-Star Feb 15–28 ·
 * Thanksgiving W6 / Christmas W9 are NORMAL Mon–Sun (not double).
 * Default playoffs W20–22 Mar 15–Apr 4 · W23 Apr 5–11.
 */
export const YAHOO_WEEKS_2026_27: YahooWeek[] = [
  {
    fantasy_week_id: "2026-27-W01",
    season_id: YAHOO_SEASON_ID,
    week_number: 1,
    label: "Week 1",
    start_date: "2026-10-20",
    end_date: "2026-10-25",
    duration_days: 6,
    is_double_week: false,
    is_partial_week: true,
    yahoo_asterisk: true,
    default_is_playoff_week: false,
    notes: "Opening Night short week · Tue–Sun",
  },
  {
    fantasy_week_id: "2026-27-W02",
    season_id: YAHOO_SEASON_ID,
    week_number: 2,
    label: "Week 2",
    start_date: "2026-10-26",
    end_date: "2026-11-01",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W03",
    season_id: YAHOO_SEASON_ID,
    week_number: 3,
    label: "Week 3",
    start_date: "2026-11-02",
    end_date: "2026-11-08",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W04",
    season_id: YAHOO_SEASON_ID,
    week_number: 4,
    label: "Week 4",
    start_date: "2026-11-09",
    end_date: "2026-11-15",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W05",
    season_id: YAHOO_SEASON_ID,
    week_number: 5,
    label: "Week 5",
    start_date: "2026-11-16",
    end_date: "2026-11-22",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W06",
    season_id: YAHOO_SEASON_ID,
    week_number: 6,
    label: "Week 6",
    start_date: "2026-11-23",
    end_date: "2026-11-29",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "Thanksgiving · normal Mon–Sun (not double)",
  },
  {
    fantasy_week_id: "2026-27-W07",
    season_id: YAHOO_SEASON_ID,
    week_number: 7,
    label: "Week 7",
    start_date: "2026-11-30",
    end_date: "2026-12-13",
    duration_days: 14,
    is_double_week: true,
    is_partial_week: false,
    yahoo_asterisk: true,
    default_is_playoff_week: false,
    notes: "NBA Cup knockout · 14-day",
  },
  {
    fantasy_week_id: "2026-27-W08",
    season_id: YAHOO_SEASON_ID,
    week_number: 8,
    label: "Week 8",
    start_date: "2026-12-14",
    end_date: "2026-12-20",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W09",
    season_id: YAHOO_SEASON_ID,
    week_number: 9,
    label: "Week 9",
    start_date: "2026-12-21",
    end_date: "2026-12-27",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "Christmas · normal Mon–Sun (not double)",
  },
  {
    fantasy_week_id: "2026-27-W10",
    season_id: YAHOO_SEASON_ID,
    week_number: 10,
    label: "Week 10",
    start_date: "2026-12-28",
    end_date: "2027-01-03",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W11",
    season_id: YAHOO_SEASON_ID,
    week_number: 11,
    label: "Week 11",
    start_date: "2027-01-04",
    end_date: "2027-01-10",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W12",
    season_id: YAHOO_SEASON_ID,
    week_number: 12,
    label: "Week 12",
    start_date: "2027-01-11",
    end_date: "2027-01-17",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W13",
    season_id: YAHOO_SEASON_ID,
    week_number: 13,
    label: "Week 13",
    start_date: "2027-01-18",
    end_date: "2027-01-24",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W14",
    season_id: YAHOO_SEASON_ID,
    week_number: 14,
    label: "Week 14",
    start_date: "2027-01-25",
    end_date: "2027-01-31",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W15",
    season_id: YAHOO_SEASON_ID,
    week_number: 15,
    label: "Week 15",
    start_date: "2027-02-01",
    end_date: "2027-02-07",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W16",
    season_id: YAHOO_SEASON_ID,
    week_number: 16,
    label: "Week 16",
    start_date: "2027-02-08",
    end_date: "2027-02-14",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W17",
    season_id: YAHOO_SEASON_ID,
    week_number: 17,
    label: "Week 17",
    start_date: "2027-02-15",
    end_date: "2027-02-28",
    duration_days: 14,
    is_double_week: true,
    is_partial_week: false,
    yahoo_asterisk: true,
    default_is_playoff_week: false,
    notes: "All-Star break · 14-day",
  },
  {
    fantasy_week_id: "2026-27-W18",
    season_id: YAHOO_SEASON_ID,
    week_number: 18,
    label: "Week 18",
    start_date: "2027-03-01",
    end_date: "2027-03-07",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W19",
    season_id: YAHOO_SEASON_ID,
    week_number: 19,
    label: "Week 19",
    start_date: "2027-03-08",
    end_date: "2027-03-14",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "",
  },
  {
    fantasy_week_id: "2026-27-W20",
    season_id: YAHOO_SEASON_ID,
    week_number: 20,
    label: "Week 20",
    start_date: "2027-03-15",
    end_date: "2027-03-21",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: true,
    notes: "Default fantasy playoffs · QF",
  },
  {
    fantasy_week_id: "2026-27-W21",
    season_id: YAHOO_SEASON_ID,
    week_number: 21,
    label: "Week 21",
    start_date: "2027-03-22",
    end_date: "2027-03-28",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: true,
    notes: "Default fantasy playoffs · SF",
  },
  {
    fantasy_week_id: "2026-27-W22",
    season_id: YAHOO_SEASON_ID,
    week_number: 22,
    label: "Week 22",
    start_date: "2027-03-29",
    end_date: "2027-04-04",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: true,
    notes: "Default fantasy playoffs · Championship",
  },
  {
    fantasy_week_id: "2026-27-W23",
    season_id: YAHOO_SEASON_ID,
    week_number: 23,
    label: "Week 23",
    start_date: "2027-04-05",
    end_date: "2027-04-11",
    duration_days: 7,
    is_double_week: false,
    is_partial_week: false,
    yahoo_asterisk: false,
    default_is_playoff_week: false,
    notes: "Final NBA RS week · many leagues already crowned",
  },
];

const BY_NUMBER = new Map(
  YAHOO_WEEKS_2026_27.map((w) => [w.week_number, w])
);

export function getYahooWeek(weekNumber: number): YahooWeek | null {
  return BY_NUMBER.get(weekNumber) ?? null;
}

/** Join date (YYYY-MM-DD) → Yahoo week; null if outside table (soft-empty). */
export function weekForDate(dateIso: string): YahooWeek | null {
  const d = dateIso.slice(0, 10);
  for (const w of YAHOO_WEEKS_2026_27) {
    if (d >= w.start_date && d <= w.end_date) return w;
  }
  return null;
}

export function weekChipLabel(w: YahooWeek): string {
  if (w.is_partial_week) return `W${w.week_number} · short`;
  if (w.is_double_week) return `W${w.week_number} · 14-day`;
  return `W${w.week_number}`;
}

export function weekHelperCopy(w: YahooWeek): string {
  if (w.is_partial_week) return "Tue–Sun · 6 days";
  if (w.is_double_week) return "One matchup · ~14 days";
  if (w.default_is_playoff_week) return "Default playoff window";
  return "Mon–Sun";
}

export function formatWeekRange(w: YahooWeek): string {
  const fmt = (iso: string) => {
    const [, m, day] = iso.split("-").map(Number);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[(m ?? 1) - 1]} ${day}`;
  };
  return `${fmt(w.start_date)} – ${fmt(w.end_date)}`;
}

export function doubleBannerKind(
  w: YahooWeek
): "cup" | "allstar" | null {
  if (!w.is_double_week) return null;
  if (w.week_number === 7) return "cup";
  if (w.week_number === 17) return "allstar";
  return null;
}

/** Cup championship only — Yahoo Help scoring overview. */
export function isCupChampionshipGame(opts: {
  game_date: string;
  game_subtype?: string | null;
  game_label?: string | null;
}): boolean {
  const d = opts.game_date.slice(0, 10);
  if (d !== CUP_FINAL_DATE_2026_27) return false;
  const sub = (opts.game_subtype ?? "").toLowerCase();
  if (sub.includes("knockout") || sub.includes("championship")) return true;
  const label = (opts.game_label ?? "").toLowerCase();
  return label.includes("cup");
}

/** Default current week for UI — prefer first week containing today, else W1. */
export function defaultWeekNumber(todayIso?: string): number {
  const today =
    todayIso?.slice(0, 10) ??
    new Date().toISOString().slice(0, 10);
  const hit = weekForDate(today);
  if (hit) return hit.week_number;
  if (today < YAHOO_WEEKS_2026_27[0]!.start_date) return 1;
  return YAHOO_WEEKS_2026_27[YAHOO_WEEKS_2026_27.length - 1]!.week_number;
}

export function eachDateInWeek(w: YahooWeek): string[] {
  const out: string[] = [];
  const start = new Date(`${w.start_date}T12:00:00Z`);
  const end = new Date(`${w.end_date}T12:00:00Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function dowLabel(dateIso: string): string {
  const d = new Date(`${dateIso.slice(0, 10)}T12:00:00Z`);
  return DOW[d.getUTCDay()] ?? "";
}
