import styles from "./insight.module.css";

export const metadata = {
  title: "Insight — FantasyHoops",
  description: "Premium fantasy insights (content forthcoming)",
};

export default function InsightPage() {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <header className={styles.header}>
        <p className={styles.kicker}>Insight</p>
        <h1 className={styles.title}>Coming soon</h1>
        <p className={styles.subtitle}>
          Premium fantasy write-ups will land here. No articles yet — see{" "}
          <code>docs/INSIGHT_CONTENT.md</code> for the content contract.
        </p>
      </header>
      <section className={styles.card} aria-label="Empty insight feed">
        <p className={styles.empty}>No insights published.</p>
      </section>
    </main>
  );
}
