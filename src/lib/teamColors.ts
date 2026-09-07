/**
 * Shared NBA 30-team color tokens.
 * Hex from researched brand/identity sources — see TEAM_COLORS.md.
 * Sources:
 *  - sportsbrackets: https://sportsbrackets.net/2026/05/19/complete-nba-team-identity-guide-logos-colors-and-arenas-for-all-30-teams/
 *  - coloracci: https://coloracci.ai/blog/nba-team-colors-guide
 */

export type TeamAbbr =
  | "ATL"
  | "BKN"
  | "BOS"
  | "CHA"
  | "CHI"
  | "CLE"
  | "DAL"
  | "DEN"
  | "DET"
  | "GSW"
  | "HOU"
  | "IND"
  | "LAC"
  | "LAL"
  | "MEM"
  | "MIA"
  | "MIL"
  | "MIN"
  | "NOP"
  | "NYK"
  | "OKC"
  | "ORL"
  | "PHI"
  | "PHX"
  | "POR"
  | "SAC"
  | "SAS"
  | "TOR"
  | "UTA"
  | "WAS";

export type TeamColorToken = {
  abbr: TeamAbbr;
  name: string;
  /** Official / brand primary hex */
  primary: string;
  /** 1–2 accent hexes */
  accents: [string] | [string, string];
  /**
   * Stroke color for dark glass charts — hue-faithful; lightness nudged only
   * when primary would fail contrast on near-black backgrounds.
   */
  chartPrimary: string;
  /** Citation tag → TEAM_COLORS.md */
  source: "sportsbrackets" | "coloracci" | "sportsbrackets+coloracci";
};

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Nudge very-dark primaries up for dark-glass chart strokes; keep hue. */
export function chartPrimaryFromBrand(primary: string): string {
  const L = relativeLuminance(primary);
  // Target ~readable on #0c0e16 — if too dark, mix toward white ~55%
  if (L >= 0.12) return primary;
  const { r, g, b } = parseHex(primary);
  const t = 0.55;
  const nr = Math.round(r + (255 - r) * t);
  const ng = Math.round(g + (255 - g) * t);
  const nb = Math.round(b + (255 - b) * t);
  return `#${[nr, ng, nb]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
}

function T(
  abbr: TeamAbbr,
  name: string,
  primary: string,
  accents: [string] | [string, string],
  source: TeamColorToken["source"]
): TeamColorToken {
  return {
    abbr,
    name,
    primary,
    accents,
    chartPrimary: chartPrimaryFromBrand(primary),
    source,
  };
}

/** All 30 teams — keys = curated `team_abbreviation`. */
export const TEAM_COLORS: Record<TeamAbbr, TeamColorToken> = {
  ATL: T("ATL", "Atlanta Hawks", "#E03A3E", ["#C1D32F", "#26282A"], "sportsbrackets+coloracci"),
  BKN: T("BKN", "Brooklyn Nets", "#000000", ["#FFFFFF"], "sportsbrackets"),
  BOS: T("BOS", "Boston Celtics", "#007A33", ["#BA9653"], "sportsbrackets"),
  CHA: T("CHA", "Charlotte Hornets", "#1D1160", ["#00788C"], "sportsbrackets"),
  CHI: T("CHI", "Chicago Bulls", "#CE1141", ["#000000"], "sportsbrackets"),
  CLE: T("CLE", "Cleveland Cavaliers", "#860038", ["#FDBB30"], "sportsbrackets"),
  DAL: T("DAL", "Dallas Mavericks", "#00538C", ["#002B5E"], "sportsbrackets"),
  DEN: T("DEN", "Denver Nuggets", "#0E2240", ["#FEC524", "#8B2131"], "sportsbrackets+coloracci"),
  DET: T("DET", "Detroit Pistons", "#C8102E", ["#1D42BA"], "sportsbrackets"),
  GSW: T("GSW", "Golden State Warriors", "#1D428A", ["#FFC72C"], "sportsbrackets"),
  HOU: T("HOU", "Houston Rockets", "#CE1141", ["#000000"], "sportsbrackets"),
  IND: T("IND", "Indiana Pacers", "#002D62", ["#FDBB30"], "sportsbrackets"),
  LAC: T("LAC", "LA Clippers", "#C8102E", ["#1D428A"], "sportsbrackets"),
  LAL: T("LAL", "Los Angeles Lakers", "#552583", ["#FDB927"], "sportsbrackets"),
  MEM: T("MEM", "Memphis Grizzlies", "#5D76A9", ["#12173F", "#F5B112"], "sportsbrackets+coloracci"),
  MIA: T("MIA", "Miami Heat", "#98002E", ["#F9A01B"], "sportsbrackets"),
  MIL: T("MIL", "Milwaukee Bucks", "#00471B", ["#EEE1C6", "#0077C0"], "sportsbrackets+coloracci"),
  MIN: T("MIN", "Minnesota Timberwolves", "#0C2340", ["#236192"], "sportsbrackets"),
  NOP: T("NOP", "New Orleans Pelicans", "#0C2340", ["#C8102E"], "sportsbrackets"),
  NYK: T("NYK", "New York Knicks", "#006BB6", ["#F58426"], "sportsbrackets"),
  OKC: T("OKC", "Oklahoma City Thunder", "#007AC1", ["#EF3B24"], "sportsbrackets"),
  ORL: T("ORL", "Orlando Magic", "#0077C0", ["#C4CED4"], "sportsbrackets"),
  PHI: T("PHI", "Philadelphia 76ers", "#006BB6", ["#ED174C"], "sportsbrackets"),
  PHX: T("PHX", "Phoenix Suns", "#1D1160", ["#E56020"], "sportsbrackets"),
  POR: T("POR", "Portland Trail Blazers", "#E03A3E", ["#000000"], "sportsbrackets"),
  SAC: T("SAC", "Sacramento Kings", "#5A2D81", ["#63727A"], "sportsbrackets"),
  SAS: T("SAS", "San Antonio Spurs", "#C4CED4", ["#000000"], "sportsbrackets"),
  TOR: T("TOR", "Toronto Raptors", "#CE1141", ["#000000"], "sportsbrackets"),
  UTA: T("UTA", "Utah Jazz", "#002B5C", ["#00471B", "#F9A01B"], "sportsbrackets+coloracci"),
  WAS: T("WAS", "Washington Wizards", "#002B5C", ["#E31837"], "sportsbrackets"),
};

export function isTeamAbbr(v: string | null | undefined): v is TeamAbbr {
  return !!v && Object.prototype.hasOwnProperty.call(TEAM_COLORS, v);
}

export function getTeamColors(abbr: string | null | undefined): TeamColorToken | null {
  if (!isTeamAbbr(abbr)) return null;
  return TEAM_COLORS[abbr];
}

/** Hex → hue degrees for HSLA brightness stacking. */
export function hexToHue(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

/**
 * Among played games (min>0) for a season, pick team_abbreviation with most GP.
 * Ties → lexicographically first abbr (stable).
 */
export function primaryTeamForSeason(
  games: { season: string; min: number | null; team_abbreviation?: string | null }[],
  season: string
): TeamAbbr | null {
  const counts = new Map<string, number>();
  for (const g of games) {
    if (g.season !== season) continue;
    if (g.min == null || !(g.min > 0)) continue;
    const abbr = g.team_abbreviation?.trim();
    if (!abbr || !isTeamAbbr(abbr)) continue;
    counts.set(abbr, (counts.get(abbr) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: string | null = null;
  let bestN = -1;
  for (const [abbr, n] of counts) {
    if (n > bestN || (n === bestN && best != null && abbr < best)) {
      best = abbr;
      bestN = n;
    }
  }
  return best as TeamAbbr | null;
}

/** Most recent season’s primary team (for display / recent chips). */
export function primaryTeamRecent(
  games: { season: string; min: number | null; team_abbreviation?: string | null }[]
): TeamAbbr | null {
  const seasons = [...new Set(games.map((g) => g.season))].sort();
  for (let i = seasons.length - 1; i >= 0; i--) {
    const t = primaryTeamForSeason(games, seasons[i]);
    if (t) return t;
  }
  return null;
}

/** Fallback stroke when no primary team can be resolved. */
export const FALLBACK_CHART_STROKE = "#94a3b8";

/**
 * Recency brightness on a single hue (from team chartPrimary).
 * Brightness lock among selected seasons: newest = 100% opacity/brightness,
 * oldest = 50%, linear middles. Team hue unchanged (most-recent-team one hue).
 * Supports up to MAX_SELECTED_SEASONS (5).
 */
export function withRecencyBrightness(
  hex: string,
  rankFromNewest: number,
  seasonCount: number
): string {
  const hue = hexToHue(hex);
  const n = Math.max(1, seasonCount);
  const factor =
    n <= 1 ? 1 : 1 - (Math.max(0, rankFromNewest) / (n - 1)) * 0.5;
  // Fixed sat/light so the linear factor alone carries opacity/brightness.
  const sat = 88;
  const light = 58;
  return `hsla(${Math.round(hue)}, ${sat}%, ${light}%, ${factor})`;
}

/**
 * Same-player multi-season: ONE hue from **most recent team** primary, then
 * brightness-by-recency (newest brightest → older dimmer). Do not recolor each
 * season by that year's team.
 */
export function seasonTeamStrokeColors(
  games: { season: string; min: number | null; team_abbreviation?: string | null }[],
  seasons: string[]
): Record<string, string> {
  const sorted = [...seasons].sort();
  const n = sorted.length;
  const abbr =
    primaryTeamRecent(games) ??
    (sorted.length ? primaryTeamForSeason(games, sorted[sorted.length - 1]) : null);
  const token = getTeamColors(abbr);
  const hex = token?.chartPrimary ?? FALLBACK_CHART_STROKE;
  const out: Record<string, string> = {};
  sorted.forEach((season, idxFromOldest) => {
    const rankFromNewest = n - 1 - idxFromOldest;
    out[season] = withRecencyBrightness(hex, rankFromNewest, n);
  });
  return out;
}

/** Display / recent-chip accent = most recent season's team primary (brand, not chart nudge). */
export function displayTeamPrimary(
  games: { season: string; min: number | null; team_abbreviation?: string | null }[]
): string | null {
  const abbr = primaryTeamRecent(games);
  const token = getTeamColors(abbr);
  return token?.primary ?? null;
}

export function displayTeamChartPrimary(
  games: { season: string; min: number | null; team_abbreviation?: string | null }[]
): string | null {
  const abbr = primaryTeamRecent(games);
  const token = getTeamColors(abbr);
  return token?.chartPrimary ?? null;
}
