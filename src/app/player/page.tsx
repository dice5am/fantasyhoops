import { PlayerHub } from "@/components/PlayerHub";
import {
  getSeasonPlayerAveragesTop250,
  isInTop250Pool,
} from "@/lib/loadMart";
import { parseScope, parseSeason } from "@/lib/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  scope?: string;
  season?: string;
  player_id?: string;
  name?: string;
  seasons?: string;
  stat?: string;
}>;

export default async function PlayerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const season = parseSeason(sp.season);
  const scope = parseScope(sp.scope);
  // Averages list: Top-250 pool only. Deep-link explorer still loads any player via APIs.
  const rows = await getSeasonPlayerAveragesTop250({
    season,
    season_type_scope: scope,
  });
  const playerId = sp.player_id ? String(sp.player_id) : "";
  const hasPlayer = Boolean(playerId.length > 0);

  let outsideTop250 = false;
  if (hasPlayer) {
    outsideTop250 = !(await isInTop250Pool({
      player_id: playerId,
      season,
      season_type_scope: scope,
    }));
  }

  return (
    <PlayerHub
      rows={rows}
      season={season}
      scope={scope}
      hasPlayer={hasPlayer}
      outsideTop250={outsideTop250}
    />
  );
}
