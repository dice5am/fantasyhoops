import { PlayerTable } from "@/components/PlayerTable";
import {
  DEFAULT_SCOPE,
  DEFAULT_SEASON,
  getSeasonPlayerAverages,
} from "@/lib/loadMart";
import type { SeasonTypeScope } from "@/types/season_player_averages";
import { SEASON_OPTIONS } from "@/types/season_player_averages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ scope?: string; season?: string }>;

function parseScope(v: string | undefined): SeasonTypeScope {
  if (v === "reg_plus_playoffs") return "reg_plus_playoffs";
  if (v === "playoff_only") return "playoff_only";
  if (v === "reg_only") return "reg_only";
  return DEFAULT_SCOPE;
}

function parseSeason(v: string | undefined): string {
  if (v && (SEASON_OPTIONS as string[]).includes(v)) return v;
  return DEFAULT_SEASON;
}

export default async function Home({
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

  return <PlayerTable rows={rows} scope={scope} season={season} />;
}
