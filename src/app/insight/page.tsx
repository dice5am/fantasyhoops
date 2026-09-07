import Link from "next/link";
import { getInsightPosts } from "@/lib/insights";
import styles from "./insight.module.css";

export const metadata = {
  title: "Insight — FantasyHoops",
  description: "Premium fantasy insights",
};

export default function InsightPage() {
  const posts = getInsightPosts();

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <header className={styles.header}>
        <p className={styles.kicker}>Insight</p>
        <h1 className={styles.title}>
          {posts.length ? "Insights" : "Coming soon"}
        </h1>
        <p className={styles.subtitle}>
          {posts.length
            ? "Premium fantasy write-ups and league notes."
            : "Premium fantasy write-ups will land here. No articles yet — see docs/INSIGHT_CONTENT.md for the content contract."}
        </p>
      </header>

      {posts.length === 0 ? (
        <section className={styles.card} aria-label="Empty insight feed">
          <p className={styles.empty}>No insights published.</p>
        </section>
      ) : (
        <ul className={styles.feed} aria-label="Insight posts">
          {posts.map((post) => (
            <li key={post.slug} className={styles.feedItem}>
              <Link href={`/insight/${post.slug}`} className={styles.feedCard}>
                <div className={styles.feedMeta}>
                  <time dateTime={post.date}>{post.date}</time>
                  {post.author ? (
                    <span className={styles.author}>{post.author}</span>
                  ) : null}
                  {post.tags?.length ? (
                    <span className={styles.tags}>
                      {post.tags.map((t) => (
                        <span key={t} className={styles.tag}>
                          {t}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
                <h2 className={styles.feedTitle}>{post.title}</h2>
                <p className={styles.feedSummary}>{post.summary}</p>
                <span className={styles.feedCta}>Read insight →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
