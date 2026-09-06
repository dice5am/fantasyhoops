import { PlayerHub } from "@/components/PlayerHub";
import { getSeasonPlayerAverages } from "@/lib/loadMart";
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
  const rows = await getSeasonPlayerAverages({
    season,
    season_type_scope: scope,
  });
  const hasPlayer = Boolean(sp.player_id && String(sp.player_id).length > 0);

  return (
    <PlayerHub
      rows={rows}
      season={season}
      scope={scope}
      hasPlayer={hasPlayer}
    />
  );
}
