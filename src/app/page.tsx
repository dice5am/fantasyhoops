import { HomeDashboard } from "@/components/HomeDashboard";
import { getLeagueContext } from "@/lib/loadMart";
import { parseScope, parseSeason } from "@/lib/scope";
import { parseUniverse } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  scope?: string;
  season?: string;
  universe?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const season = parseSeason(sp.season);
  const scope = parseScope(sp.scope);
  // API/deep-link only this BUILD — no Home universe filter chrome
  const universe = parseUniverse(sp.universe);
  const context = await getLeagueContext({
    season,
    season_type_scope: scope,
    universe,
  });

  return (
    <HomeDashboard context={context} season={season} scope={scope} />
  );
}
