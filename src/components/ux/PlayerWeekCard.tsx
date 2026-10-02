import Link from "next/link";
import styles from "./PlayerWeekCard.module.css";

export function PlayerWeekCard({
  playerName,
  teamAbbr,
  onRoster,
  thisWeek,
  next7,
  handoffHref,
}: {
  playerName: string;
  teamAbbr?: string | null;
  onRoster?: boolean;
  thisWeek: { total: number; home: number; away: number; weekLabel: string };
  next7: { total: number };
  handoffHref: string;
}) {
  return (
    <section className={styles.card} aria-label="Player week card">
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>
            {playerName}
            {teamAbbr ? ` · ${teamAbbr}` : ""}
          </h3>
          <p className={styles.sub}>
            Compact week lens · no full-league slate here
          </p>
        </div>
        {onRoster ? <span className={styles.onRoster}>On roster</span> : null}
      </div>
      <div className={styles.grid}>
        <div className={styles.box}>
          <p className={styles.boxLabel}>This week</p>
          <p className={styles.big}>{thisWeek.total}</p>
          <p className={styles.boxMeta}>
            {thisWeek.home}H · {thisWeek.away}A · {thisWeek.weekLabel}
          </p>
        </div>
        <div className={styles.box}>
          <p className={styles.boxLabel}>Next 7</p>
          <p className={styles.big}>{next7.total}</p>
          <p className={styles.boxMeta}>Rolling calendar · not fantasy week</p>
        </div>
      </div>
      <Link href={handoffHref} className={styles.cta}>
        Open in Team week →
      </Link>
    </section>
  );
}
