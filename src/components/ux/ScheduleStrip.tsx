import type { DayStripCell } from "@/lib/scheduleWeek";
import type { YahooWeek } from "@/lib/yahooWeeks";
import { formatWeekRange } from "@/lib/yahooWeeks";
import { DoesntCountBadge } from "./DoesntCountBadge";
import styles from "./ScheduleStrip.module.css";

export function ScheduleStrip({
  week,
  days,
  title = "Matchup week",
  softEmpty,
}: {
  week: YahooWeek;
  days: DayStripCell[];
  title?: string;
  softEmpty?: boolean;
}) {
  if (softEmpty) {
    return (
      <section className={styles.wrap} aria-label={title}>
        <div className={styles.head}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.range}>{formatWeekRange(week)}</span>
        </div>
        <p className={styles.soft} role="status">
          No rostered teams with games in this fantasy week — soft empty, no
          invented boxes.
        </p>
      </section>
    );
  }
  return (
    <section className={styles.wrap} aria-label={title}>
      <div className={styles.head}>
        <h3 className={styles.title}>
          {title}
          {week.is_double_week
            ? " · 14-day"
            : week.is_partial_week
              ? " · short"
              : " · Mon–Sun"}
        </h3>
        <span className={styles.range}>{formatWeekRange(week)}</span>
      </div>
      <div className={styles.scroller}>
        {days.map((day) => {
          const cupFinal = day.games.some((g) => g.is_cup_final);
          const abbrs = [
            ...new Set(
              day.games.flatMap((g) =>
                [g.home_team_abbreviation, g.away_team_abbreviation].filter(
                  Boolean
                )
              )
            ),
          ] as string[];
          return (
            <div key={day.date} className={styles.day}>
              <div className={styles.dow}>{day.dow}</div>
              <div className={styles.count}>
                {day.counting_games}
                <span className={styles.g}>g</span>
              </div>
              <div className={styles.abbrs}>
                {abbrs.length === 0
                  ? "—"
                  : abbrs.slice(0, 6).join(" · ")}
              </div>
              {cupFinal ? (
                <div className={styles.badgeRow}>
                  <DoesntCountBadge label="Cup final · doesn't count" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
