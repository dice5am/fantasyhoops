import Link from "next/link";
import { notFound } from "next/navigation";
import { getInsightBySlug, getInsightSlugs } from "@/lib/insights";
import { renderMarkdownToHtml } from "@/lib/markdown";
import styles from "../insight.module.css";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getInsightSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getInsightBySlug(slug);
  if (!post) {
    return { title: "Insight — FantasyHoops" };
  }
  return {
    title: `${post.title} — Insight — FantasyHoops`,
    description: post.summary,
  };
}

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getInsightBySlug(slug);
  if (!post) notFound();

  const html = renderMarkdownToHtml(post.body);

  return (
    <main className={styles.page}>
      <p className={styles.back}>
        <Link href="/insight">← All insights</Link>
      </p>
      <article className={styles.article}>
        <header className={styles.header}>
          <p className={styles.kicker}>Insight</p>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.articleMeta}>
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
          <p className={styles.subtitle}>{post.summary}</p>
        </header>
        <div
          className={styles.prose}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </main>
  );
}
