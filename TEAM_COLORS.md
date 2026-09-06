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

## Per-team (abbr → primary / accents / source)
See `src/lib/teamColors.ts` inline comments for per-team source tags (`sportsbrackets` / `coloracci`).
