"use client";

import { useState } from "react";
import Link from "next/link";
import { HomeDashboard } from "@/components/HomeDashboard";
import { InsightLists } from "@/components/InsightLists";
import type { InsightListsPayload } from "@/lib/loadInsightLists";
import type { LeagueContextPayload } from "@/lib/leagueAggregates";
import type { FantasyScoresPayload } from "@/types/fantasy_score";
import type { SeasonTypeScope } from "@/types/season_player_averages";
import styles from "./InsightsBoard.module.css";

export type InsightPostMeta = {
  slug: string;
  title: string;
  summary: string;
  date: string;
  author?: string;
  tags?: string[];
};

type Props = {
  context: LeagueContextPayload;
  season: string;
  scope: SeasonTypeScope;
  topPct: number;
  initialFantasy?: FantasyScoresPayload | null;
  posts: InsightPostMeta[];
  initialSegment?: "pulse" | "briefs";
  /** Analyst lists (validated). Null → section hidden. */
  insightLists?: InsightListsPayload | null;
};

export function InsightsBoard({
  context,
  season,
  scope,
  topPct,
  initialFantasy,
  posts,
  initialSegment = "pulse",
  insightLists = null,
}: Props) {
  const [seg, setSeg] = useState<"pulse" | "briefs">(initialSegment);

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.kicker}>Insights</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{seg === "pulse" ? "Pulse" : "Briefs"}</h1>
          <div className={styles.seg} role="tablist" aria-label="Insights segment">
            <button
              type="button"
              role="tab"
              aria-selected={seg === "pulse"}
              className={seg === "pulse" ? styles.segOn : styles.segBtn}
              onClick={() => setSeg("pulse")}
            >
              Pulse
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={seg === "briefs"}
              className={seg === "briefs" ? styles.segOn : styles.segBtn}
              onClick={() => setSeg("briefs")}
            >
              Briefs
            </button>
          </div>
        </div>
        <p className={styles.note}>No full-league slate · Team owns schedule</p>
      </header>

      {insightLists ? <InsightLists data={insightLists} /> : null}

      {seg === "pulse" ? (
        <div className={styles.pulse}>
          <HomeDashboard
            context={context}
            season={season}
            scope={scope}
            topPct={topPct}
            initialFantasy={initialFantasy}
          />
        </div>
      ) : (
        <div className={styles.briefs}>
          {posts.length === 0 ? (
            <p className={styles.empty}>No insights published.</p>
          ) : (
            <ul className={styles.feed} aria-label="Insight briefs">
              {posts.map((post) => (
                <li key={post.slug} className={styles.feedItem}>
                  <Link
                    href={`/insights/${post.slug}`}
                    className={styles.feedCard}
                  >
                    <div className={styles.feedMeta}>
                      <time dateTime={post.date}>{post.date}</time>
                      {post.author ? (
                        <span>{post.author}</span>
                      ) : null}
                    </div>
                    <h2 className={styles.feedTitle}>{post.title}</h2>
                    <p className={styles.feedSummary}>{post.summary}</p>
                    <span className={styles.feedCta}>Read brief →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
