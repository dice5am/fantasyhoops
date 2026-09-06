import { HomeDashboard } from "@/components/HomeDashboard";
import { getLeagueContext } from "@/lib/loadMart";
import { parseScope, parseSeason } from "@/lib/scope";
import { parseTopPct } from "@/lib/top250";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  scope?: string;
  season?: string;
  topPct?: string;
  /** @deprecated legacy — maps to topPct 100 */
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
  const topPct =
    sp.topPct != null && sp.topPct !== ""
      ? parseTopPct(sp.topPct)
      : sp.universe != null && sp.universe !== ""
        ? 100
        : parseTopPct(undefined);
  const context = await getLeagueContext({
    season,
    season_type_scope: scope,
    topPct,
  });

  return (
    <HomeDashboard
      context={context}
      season={season}
      scope={scope}
      topPct={topPct}
    />
  );
}
