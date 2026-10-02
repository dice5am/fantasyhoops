import { InsightsBoard } from "@/components/InsightsBoard";
import { getLeagueContext } from "@/lib/loadMart";
import { getFantasyScores } from "@/lib/loadFantasyScores";
import { parseScope, parseSeason } from "@/lib/scope";
import { parseTopPct } from "@/lib/top250";
import { getInsightPosts } from "@/lib/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  scope?: string;
  season?: string;
  topPct?: string;
  universe?: string;
  segment?: string;
}>;

export default async function InsightsPage({
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

  const [context, fantasy] = await Promise.all([
    getLeagueContext({
      season,
      season_type_scope: scope,
      topPct,
    }),
    getFantasyScores({
      season,
      season_type_scope: scope,
      topPct,
    }).catch(() => null),
  ]);

  const posts = getInsightPosts().map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    date: p.date,
    author: p.author,
    tags: p.tags,
  }));

  return (
    <InsightsBoard
      context={context}
      season={season}
      scope={scope}
      topPct={topPct}
      initialFantasy={fantasy}
      posts={posts}
      initialSegment={sp.segment === "briefs" ? "briefs" : "pulse"}
    />
  );
}
