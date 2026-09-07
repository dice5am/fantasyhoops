/**
 * Shared NBA 30-team color tokens.
 * Hex from researched brand/identity sources — see TEAM_COLORS.md (per-team citations).
 * Prefer official club brand / NBA media style guides; secondary: Wikipedia brand names,
 * teampalettes, coloracci, sportsbrackets identity tables.
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
  /** Citation tag → TEAM_COLORS.md per-team row */
  source: string;
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
  source: string
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
  // ATL Hawks Red + Volt Green + Charcoal — brand / sportsbrackets + coloracci
  ATL: T("ATL", "Atlanta Hawks", "#E03A3E", ["#C1D32F", "#26282A"], "brand:sportsbrackets+coloracci+teampalettes"),
  // BKN black/white — brand
  BKN: T("BKN", "Brooklyn Nets", "#000000", ["#FFFFFF"], "brand:sportsbrackets+teampalettes"),
  // BOS Celtics Green + Gold — brand (#007A33 not wiki #008348)
  BOS: T("BOS", "Boston Celtics", "#007A33", ["#BA9653"], "brand:sportsbrackets+teampalettes+coloracci"),
  // CHA Hornets Purple + Teal — brand (purple primary)
  CHA: T("CHA", "Charlotte Hornets", "#1D1160", ["#00788C"], "brand:sportsbrackets+coloracci"),
  // CHI Bulls Red + Black
  CHI: T("CHI", "Chicago Bulls", "#CE1141", ["#000000"], "brand:sportsbrackets+teampalettes"),
  // CLE Wine + Gold (+ Navy in brand; gold is chart accent)
  CLE: T("CLE", "Cleveland Cavaliers", "#860038", ["#FDBB30", "#041E42"], "brand:sportsbrackets+coloracci"),
  // DAL Royal Blue + Navy
  DAL: T("DAL", "Dallas Mavericks", "#00538C", ["#002B5E"], "brand:sportsbrackets+coloracci"),
  // DEN Midnight Blue + Sunshine Yellow + Flatirons Red
  DEN: T("DEN", "Denver Nuggets", "#0E2240", ["#FEC524", "#8B2131"], "brand:sportsbrackets+coloracci"),
  // DET Red + Royal Blue
  DET: T("DET", "Detroit Pistons", "#C8102E", ["#1D42BA"], "brand:sportsbrackets+teampalettes"),
  // GSW Warriors Blue + Golden Yellow
  GSW: T("GSW", "Golden State Warriors", "#1D428A", ["#FFC72C"], "brand:sportsbrackets+teampalettes"),
  // HOU Rockets Red + Black
  HOU: T("HOU", "Houston Rockets", "#CE1141", ["#000000"], "brand:sportsbrackets+teampalettes"),
  // IND Pacers Blue + Yellow
  IND: T("IND", "Indiana Pacers", "#002D62", ["#FDBB30"], "brand:sportsbrackets+teampalettes"),
  // LAC Red + Blue
  LAC: T("LAC", "LA Clippers", "#C8102E", ["#1D428A"], "brand:sportsbrackets+teampalettes"),
  // LAL Purple + Gold (PMS 526 C / #552583)
  LAL: T("LAL", "Los Angeles Lakers", "#552583", ["#FDB927"], "brand:teamcolorcodes+teampalettes"),
  // MEM Beale Street Blue + Navy + Yellow
  MEM: T("MEM", "Memphis Grizzlies", "#5D76A9", ["#12173F", "#F5B112"], "brand:sportsbrackets+coloracci"),
  // MIA Red + Yellow (flame)
  MIA: T("MIA", "Miami Heat", "#98002E", ["#F9A01B"], "brand:sportsbrackets+coloracci"),
  // MIL Good Land Green (forest/olive PMS 350 C) + Cream City Cream + Great Lakes Blue — NOT neon
  MIL: T("MIL", "Milwaukee Bucks", "#00471B", ["#EEE1C6", "#0077C0"], "brand:nba-bucks-guidelines+teamcolorsguide"),
  // MIN Midnight Blue + Lake Blue + Aurora Green (2017 brand)
  MIN: T("MIN", "Minnesota Timberwolves", "#0C2340", ["#236192", "#78BE20"], "brand:nba-wolves-2017+brandcolorcode"),
  // NOP Navy + Red (+ Gold)
  NOP: T("NOP", "New Orleans Pelicans", "#0C2340", ["#C8102E", "#85714D"], "brand:sportsbrackets+coloracci"),
  // NYK Blue + Orange
  NYK: T("NYK", "New York Knicks", "#006BB6", ["#F58426"], "brand:sportsbrackets+teampalettes"),
  // OKC Thunder Blue + Sunset Orange
  OKC: T("OKC", "Oklahoma City Thunder", "#007AC1", ["#EF3B24"], "brand:sportsbrackets+teampalettes"),
  // ORL Magic Blue + Silver
  ORL: T("ORL", "Orlando Magic", "#0077C0", ["#C4CED4"], "brand:sportsbrackets+coloracci"),
  // PHI Blue + Red
  PHI: T("PHI", "Philadelphia 76ers", "#006BB6", ["#ED174C"], "brand:sportsbrackets+teampalettes"),
  // PHX Purple + Orange
  PHX: T("PHX", "Phoenix Suns", "#1D1160", ["#E56020"], "brand:sportsbrackets+coloracci"),
  // POR Red + Black
  POR: T("POR", "Portland Trail Blazers", "#E03A3E", ["#000000"], "brand:sportsbrackets+teampalettes"),
  // SAC Purple + Gray
  SAC: T("SAC", "Sacramento Kings", "#5A2D81", ["#63727A"], "brand:sportsbrackets+teampalettes"),
  // SAS Silver + Black (silver primary for chart readability; black accent)
  SAS: T("SAS", "San Antonio Spurs", "#C4CED4", ["#000000"], "brand:sportsbrackets+coloracci"),
  // TOR Red + Black
  TOR: T("TOR", "Toronto Raptors", "#CE1141", ["#000000"], "brand:sportsbrackets+teampalettes"),
  // UTA Navy + Green + Yellow (post-2022 mountain palette; not purple era)
  UTA: T("UTA", "Utah Jazz", "#002B5C", ["#00471B", "#F9A01B"], "brand:sportsbrackets+coloracci+teampalettes"),
  // WAS Navy + Red
  WAS: T("WAS", "Washington Wizards", "#002B5C", ["#E31837"], "brand:sportsbrackets+teampalettes"),
};

export function isTeamAbbr(v: string | null | undefined): v is TeamAbbr {
  return !!v && Object.prototype.hasOwnProperty.call(TEAM_COLORS, v);
}

export function getTeamColors(abbr: string | null | undefined): TeamColorToken | null {
  if (!isTeamAbbr(abbr)) return null;
  return TEAM_COLORS[abbr];
}

/**
 * Official NBA stats team_id → curated TeamAbbr (TEAM_COLORS.md keys).
 * Used when dense parquet has team_id but no team_abbreviation column.
 * IDs are stable league identifiers (16106127xx).
 */
export const NBA_TEAM_ID_TO_ABBR: Readonly<Record<string, TeamAbbr>> = {
  "1610612737": "ATL",
  "1610612738": "BOS",
  "1610612739": "CLE",
  "1610612740": "NOP",
  "1610612741": "CHI",
  "1610612742": "DAL",
  "1610612743": "DEN",
  "1610612744": "GSW",
  "1610612745": "HOU",
  "1610612746": "LAC",
  "1610612747": "LAL",
  "1610612748": "MIA",
  "1610612749": "MIL",
  "1610612750": "MIN",
  "1610612751": "BKN",
  "1610612752": "NYK",
  "1610612753": "ORL",
  "1610612754": "IND",
  "1610612755": "PHI",
  "1610612756": "PHX",
  "1610612757": "POR",
  "1610612758": "SAC",
  "1610612759": "SAS",
  "1610612760": "OKC",
  "1610612761": "TOR",
  "1610612762": "UTA",
  "1610612763": "MEM",
  "1610612764": "WAS",
  "1610612765": "DET",
  "1610612766": "CHA",
};

/** Resolve TeamAbbr from NBA team_id string/number; null if unknown. */
export function teamAbbrFromTeamId(
  teamId: string | number | null | undefined
): TeamAbbr | null {
  if (teamId == null) return null;
  const key = String(teamId).trim();
  if (!key) return null;
  return NBA_TEAM_ID_TO_ABBR[key] ?? null;
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
