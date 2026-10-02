import type { YahooWeek } from "@/lib/yahooWeeks";
import { doubleBannerKind, formatWeekRange } from "@/lib/yahooWeeks";
import styles from "./DoubleWeekBanner.module.css";

export function DoubleWeekBanner({ week }: { week: YahooWeek }) {
  if (!week.is_double_week) return null;
  const kind = doubleBannerKind(week);
  const context =
    kind === "cup"
      ? "NBA Cup knockout"
      : kind === "allstar"
        ? "All-Star break"
        : week.notes || "Extended Game Week";
  return (
    <aside className={styles.banner} aria-label="14-day Game Week">
      <div className={styles.copy}>
        <h3 className={styles.title}>14-day Game Week</h3>
        <p className={styles.body}>
          Stats accumulate across both calendar weeks · one H2H matchup
        </p>
        <p className={styles.context}>
          {context} · {formatWeekRange(week)}
          {kind === "cup"
            ? " · Cup Championship excluded from volume"
            : ""}
        </p>
      </div>
      <span className={styles.badge}>
        W{week.week_number}
        {week.week_number === 7 ? "–8" : ""}
      </span>
    </aside>
  );
}
