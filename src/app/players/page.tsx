import { Suspense } from "react";
import { PlayersBoard } from "@/components/PlayersBoard";
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
  week?: string;
}>;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const season = parseSeason(sp.season);
  const scope = parseScope(sp.scope);
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
    <Suspense fallback={<main style={{ padding: "2rem" }}>Loading players…</main>}>
      <PlayersBoard
        rows={rows}
        season={season}
        scope={scope}
        hasPlayer={hasPlayer}
        outsideTop250={outsideTop250}
        playerId={playerId || null}
      />
    </Suspense>
  );
}
