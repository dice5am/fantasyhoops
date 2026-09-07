# NBA Team Colors

Shared 30-team palette for FantasyHoops charts/UI. Hexes are **not invented** — each row cites the source(s) used.

## Source corpus (prefer in order)
1. **Official club / NBA media brand** — named brand colors + hex/Pantone where published (e.g. Bucks “Good Land green”, Wolves 2017 midnight/lake/aurora).
2. **Sports Brackets — NBA Team Identity Guide (2026-27)** — claims hex from each club’s current brand guidelines:  
   https://sportsbrackets.net/2026/05/19/complete-nba-team-identity-guide-logos-colors-and-arenas-for-all-30-teams/
3. **Coloracci — NBA Team Colors Complete HEX Guide (2026)** — named primaries + third accents:  
   https://coloracci.ai/blog/nba-team-colors-guide
4. **Team Color Palettes (NBA index)** — cross-check: https://teampalettes.com/nba
5. **Wikipedia** — team page “Team colors” names + `Module:Sports_color/basketball` hex (display/wiki; prefer brand over wiki when they diverge).  
   https://en.wikipedia.org/wiki/Module:Sports_color/basketball

## Chart UI main (`chartPrimary`) — LOCKED
**Source of truth:** `/workspace/nba-branding/CHART_UI_MAINS.md` (Cavin lock 2026-09-06).  
Brand `primary` stays for chips / denser identity fills. **`chartPrimary` is the Chart UI main hex as-is — no invented hexes, no lighten/wash.**

### Wash ban (critical)
1. Do **not** derive `chartPrimary` via `chartPrimaryFromBrand` lighten — set locked hex in `T(..., chartPrimary)`.
2. Do **not** recolor identity strokes with `withRecencyBrightness` hsla(88%/58%). `seasonTeamStrokeColors` returns the **exact** `chartPrimary` hex; recency is **opacity-only** (`seasonTeamStrokeOpacities`, 1.0 → 0.5).
3. Marks UX (no logos): name-adjacent pip + soft glow from the same hex — see `/workspace/nba-branding/TEAM_MARK_UX.md`.

### Locked Chart UI main map
| Abbr | chartPrimary | Abbr | chartPrimary |
|------|--------------|------|--------------|
| ATL | `#E03A3E` | BKN | `#FFFFFF` |
| BOS | `#007A33` | CHA | `#00788C` |
| CHI | `#CE1141` | CLE | `#860038` |
| DAL | `#00538C` | DEN | `#FEC524` |
| DET | `#C8102E` | GSW | `#FFC72C` |
| HOU | `#CE1141` | IND | `#FDBB30` |
| LAC | `#C8102E` | LAL | `#FDB927` |
| MEM | `#5D76A9` | MIA | `#98002E` |
| MIL | `#00471B` | MIN | `#78BE20` |
| NOP | `#85714D` | NYK | `#F58426` |
| OKC | `#007AC1` | ORL | `#0077C0` |
| PHI | `#006BB6` | PHX | `#E56020` |
| POR | `#E03A3E` | SAC | `#5A2D81` |
| SAS | `#C4CED4` | TOR | `#CE1141` |
| UTA | `#F9A01B` | WAS | `#E31837` |

## Resolution rules
- Per season: `team_abbreviation` with most GP among `min > 0` games that season (ties → lex first abbr).
- Display / recent chips: most recent season’s brand `primary`.
- Chart/radar/metric season strokes + name pips: **most-recent-team** exact `chartPrimary` + opacity-only recency (newest=1.0 → oldest=0.5; up to 5).

## All 30 teams (primary + accents + citation)

| Abbr | Team | Primary | Accents | Source citation |
|------|------|---------|---------|-----------------|
| ATL | Atlanta Hawks | `#E03A3E` Hawks Red | `#C1D32F` Volt, `#26282A` Charcoal | sportsbrackets primary/secondary; coloracci names; teampalettes |
| BKN | Brooklyn Nets | `#000000` | `#FFFFFF` | sportsbrackets; teampalettes; wiki |
| BOS | Boston Celtics | `#007A33` Celtics Green | `#BA9653` Gold | sportsbrackets/teampalettes/coloracci brand green (**not** wiki `#008348`) |
| CHA | Charlotte Hornets | `#1D1160` Purple | `#00788C` Teal | sportsbrackets + coloracci (purple primary, teal secondary) |
| CHI | Chicago Bulls | `#CE1141` | `#000000` | sportsbrackets; teampalettes |
| CLE | Cleveland Cavaliers | `#860038` Wine | `#FDBB30` Gold, `#041E42` Navy | sportsbrackets wine/gold; coloracci navy tertiary |
| DAL | Dallas Mavericks | `#00538C` Royal Blue | `#002B5E` Navy | sportsbrackets + coloracci |
| DEN | Denver Nuggets | `#0E2240` Midnight Blue | `#FEC524` Yellow, `#8B2131` Flatirons Red | sportsbrackets + coloracci named landscape palette |
| DET | Detroit Pistons | `#C8102E` Red | `#1D42BA` Royal Blue | sportsbrackets; teampalettes (red primary) |
| GSW | Golden State Warriors | `#1D428A` Warriors Blue | `#FFC72C` Golden Yellow | sportsbrackets; teampalettes |
| HOU | Houston Rockets | `#CE1141` | `#000000` | sportsbrackets; teampalettes |
| IND | Indiana Pacers | `#002D62` | `#FDBB30` | sportsbrackets; teampalettes |
| LAC | LA Clippers | `#C8102E` | `#1D428A` | sportsbrackets; teampalettes |
| LAL | Los Angeles Lakers | `#552583` Purple (PMS 526 C) | `#FDB927` Gold | teamcolorcodes / teampalettes “official brand”; sportsbrackets |
| MEM | Memphis Grizzlies | `#5D76A9` Beale Street Blue | `#12173F` Navy, `#F5B112` Yellow | sportsbrackets primary; coloracci accents |
| MIA | Miami Heat | `#98002E` | `#F9A01B` Yellow | sportsbrackets + coloracci flame palette |
| MIL | Milwaukee Bucks | `#00471B` **Good Land Green** (forest/olive, PMS 350 C) | `#EEE1C6` Cream City Cream, `#0077C0` Great Lakes Blue | Wikipedia team colors + Bucks.com visual identity (2015); teamcolorsguide / bestcolorcodes Good Land Green — **not neon** |
| MIN | Minnesota Timberwolves | `#0C2340` Midnight Blue | `#236192` Lake Blue, `#78BE20` Aurora Green | NBA.com Wolves 2017 logo unveil + brandcolorcode / sportcolorcodes |
| NOP | New Orleans Pelicans | `#0C2340` Navy | `#C8102E` Red, `#85714D` Gold | sportsbrackets navy/red; coloracci gold |
| NYK | New York Knicks | `#006BB6` | `#F58426` Orange | sportsbrackets; teampalettes (**not** wiki `#1D428A` as primary) |
| OKC | Oklahoma City Thunder | `#007AC1` | `#EF3B24` Sunset Orange | sportsbrackets; teampalettes |
| ORL | Orlando Magic | `#0077C0` | `#C4CED4` Silver | sportsbrackets + coloracci |
| PHI | Philadelphia 76ers | `#006BB6` | `#ED174C` | sportsbrackets; teampalettes |
| PHX | Phoenix Suns | `#1D1160` Purple | `#E56020` Orange | sportsbrackets + coloracci (purple primary) |
| POR | Portland Trail Blazers | `#E03A3E` | `#000000` | sportsbrackets; teampalettes |
| SAC | Sacramento Kings | `#5A2D81` | `#63727A` Gray | sportsbrackets; teampalettes |
| SAS | San Antonio Spurs | `#C4CED4` Silver | `#000000` | sportsbrackets + coloracci (silver as chart primary) |
| TOR | Toronto Raptors | `#CE1141` | `#000000` | sportsbrackets; teampalettes |
| UTA | Utah Jazz | `#002B5C` Navy | `#00471B` Green, `#F9A01B` Yellow | sportsbrackets/teampalettes post-rebrand mountain palette (**not** wiki purple `#4E008E`) |
| WAS | Washington Wizards | `#002B5C` | `#E31837` | sportsbrackets; teampalettes |

### Spot-check notes
- **MIL**: Good Land Green `#00471B` is deep forest/olive (hue ~142°). Neon/lime greens are incorrect for current brand.
- **BOS / LAL / GSW / CHI / NYK / OKC / CLE**: matched brand tables above; wiki module differs on BOS (`#008348`), LAL (`#31006F`), NYK (`#1D428A`), UTA (purple era) — brand hexes win.
- **MIN**: keep Midnight Blue primary (not Aurora Green as primary — green is accent).

Canonical tokens: `src/lib/teamColors.ts` (`primary` + locked `chartPrimary`).
Player line Y-axis fixed domains: `src/lib/chartYAxis.ts` (raised ceilings: pts 60, reb 30, …).
