# NBA Team Colors

Shared 30-team palette for FantasyHoops charts/UI.

## Sources
Primary hex values taken from researched brand/identity tables (not invented):

1. **Sports Brackets — NBA Team Identity Guide (2026-27)**  
   https://sportsbrackets.net/2026/05/19/complete-nba-team-identity-guide-logos-colors-and-arenas-for-all-30-teams/  
   States hex values are sourced from each club’s current brand guidelines.

2. **Coloracci — NBA Team Colors Complete HEX Guide (2026)**  
   https://coloracci.ai/blog/nba-team-colors-guide  
   Cross-check / third accent where listed.

## Chart contrast note
Very dark primaries (e.g. Brooklyn black, deep navies) use a **lightness-nudged** `chartPrimary` for dark-glass line strokes while keeping hue faithful. Accents remain brand hexes.

## Resolution rules
- Per season: `team_abbreviation` with most GP among `min > 0` games that season (ties → lex first abbr).
- Display / recent accents: most recent season’s primary team.
- Chart/radar/metric season strokes: **most-recent-team** `chartPrimary` hue (one hue) + brightness lock among selected seasons (newest=100% → oldest=50%, linear middles; up to 5). Not player-hash hue; not app neon blue.

## All 30 teams

| Abbr | Team | Primary | Accents | Source |
|------|------|---------|---------|--------|
| ATL | Atlanta Hawks | `#E03A3E` | `#C1D32F`, `#26282A` | sportsbrackets+coloracci |
| BKN | Brooklyn Nets | `#000000` | `#FFFFFF` | sportsbrackets |
| BOS | Boston Celtics | `#007A33` | `#BA9653` | sportsbrackets |
| CHA | Charlotte Hornets | `#1D1160` | `#00788C` | sportsbrackets |
| CHI | Chicago Bulls | `#CE1141` | `#000000` | sportsbrackets |
| CLE | Cleveland Cavaliers | `#860038` | `#FDBB30` | sportsbrackets |
| DAL | Dallas Mavericks | `#00538C` | `#002B5E` | sportsbrackets |
| DEN | Denver Nuggets | `#0E2240` | `#FEC524`, `#8B2131` | sportsbrackets+coloracci |
| DET | Detroit Pistons | `#C8102E` | `#1D42BA` | sportsbrackets |
| GSW | Golden State Warriors | `#1D428A` | `#FFC72C` | sportsbrackets |
| HOU | Houston Rockets | `#CE1141` | `#000000` | sportsbrackets |
| IND | Indiana Pacers | `#002D62` | `#FDBB30` | sportsbrackets |
| LAC | LA Clippers | `#C8102E` | `#1D428A` | sportsbrackets |
| LAL | Los Angeles Lakers | `#552583` | `#FDB927` | sportsbrackets |
| MEM | Memphis Grizzlies | `#5D76A9` | `#12173F`, `#F5B112` | sportsbrackets+coloracci |
| MIA | Miami Heat | `#98002E` | `#F9A01B` | sportsbrackets |
| MIL | Milwaukee Bucks | `#00471B` | `#EEE1C6`, `#0077C0` | sportsbrackets+coloracci |
| MIN | Minnesota Timberwolves | `#0C2340` | `#236192` | sportsbrackets |
| NOP | New Orleans Pelicans | `#0C2340` | `#C8102E` | sportsbrackets |
| NYK | New York Knicks | `#006BB6` | `#F58426` | sportsbrackets |
| OKC | Oklahoma City Thunder | `#007AC1` | `#EF3B24` | sportsbrackets |
| ORL | Orlando Magic | `#0077C0` | `#C4CED4` | sportsbrackets |
| PHI | Philadelphia 76ers | `#006BB6` | `#ED174C` | sportsbrackets |
| PHX | Phoenix Suns | `#1D1160` | `#E56020` | sportsbrackets |
| POR | Portland Trail Blazers | `#E03A3E` | `#000000` | sportsbrackets |
| SAC | Sacramento Kings | `#5A2D81` | `#63727A` | sportsbrackets |
| SAS | San Antonio Spurs | `#C4CED4` | `#000000` | sportsbrackets |
| TOR | Toronto Raptors | `#CE1141` | `#000000` | sportsbrackets |
| UTA | Utah Jazz | `#002B5C` | `#00471B`, `#F9A01B` | sportsbrackets+coloracci |
| WAS | Washington Wizards | `#002B5C` | `#E31837` | sportsbrackets |

Canonical tokens: `src/lib/teamColors.ts`.
