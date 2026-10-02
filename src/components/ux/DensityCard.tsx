import type { RosterDensity } from "@/lib/scheduleWeek";
import type { YahooWeek } from "@/lib/yahooWeeks";
import { formatShortName } from "@/lib/formatName";
import styles from "./DensityCard.module.css";

export function DensityCard({
  week,
  rows,
  softEmpty,
}: {
  week: YahooWeek;
  rows: RosterDensity[];
  softEmpty?: boolean;
}) {
  const totalGp = rows.reduce((s, r) => s + r.counting, 0);
  const totalH = rows.reduce((s, r) => s + r.home, 0);
  const totalA = rows.reduce((s, r) => s + r.away, 0);
  const maxG = Math.max(1, ...rows.map((r) => r.counting));

  return (
    <section className={styles.card} aria-label="Fantasy week density">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>C-PRIMARY · FANTASY WEEK VOLUME</p>
          <h3 className={styles.title}>
            Games per player · W{week.week_number}
          </h3>
          <p className={styles.sub}>
            Rostered only · H/A split · uneven GP visible · Cup final excluded
          </p>
        </div>
        <div className={styles.summary}>
          <span className={styles.gp}>{totalGp} gp</span>
          <span className={styles.ha}>
            {totalH}H · {totalA}A
          </span>
        </div>
      </div>

      {softEmpty || rows.length === 0 ? (
        <p className={styles.soft} role="status">
          Soft empty — add rostered players with known NBA teams to see density.
          No invented boxes.
        </p>
      ) : (
        <ul className={styles.list}>
          {[...rows]
            .sort((a, b) => b.counting - a.counting)
            .map((r) => (
              <li key={r.player_id} className={styles.row}>
                <div className={styles.name}>
                  {formatShortName(r.full_name)}
                  {r.team_abbreviation ? (
                    <span className={styles.abbr}>
                      {" "}
                      · {r.team_abbreviation}
                    </span>
                  ) : null}
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(r.counting / maxG) * 100}%` }}
                  />
                </div>
                <div className={styles.meta}>
                  <strong>{r.counting}g</strong>
                  <span>
                    {r.home}H {r.away}A
                  </span>
                </div>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
