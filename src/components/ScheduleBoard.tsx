import type { SeasonSchedulePayload } from "@/types/season_schedule";
import styles from "./ScheduleBoard.module.css";

function displayTime(v: string | null): string {
  return v?.trim() ? v : "TBD";
}

function displayLocation(v: string | null): string {
  return v?.trim() ? v : "—";
}

function availLabel(a: string): string {
  switch (a) {
    case "confirmed":
      return "Confirmed";
    case "time_tbd":
      return "Time TBD";
    case "location_tbd":
      return "Loc TBD";
    case "scheduled_incomplete":
      return "Incomplete";
    case "final":
      return "Final";
    default:
      return a;
  }
}

export function ScheduleBoard({
  payload,
}: {
  payload: SeasonSchedulePayload | null;
}) {
  const rows = payload?.rows ?? [];
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>2026–27 Schedule</h1>
        <p className={styles.sub}>
          Regular season only · playoffs OFF this bake · date · matchup · tip ·
          location · availability honesty
        </p>
        <p className={styles.meta}>
          {payload ? (
            <>
              <code>{payload.season}</code> · scope{" "}
              <code>{payload.season_type_scope}</code> · {payload.row_count}{" "}
              games
            </>
          ) : (
            <>Awaiting schedule mart</>
          )}
        </p>
      </header>

      <section className={styles.panel} aria-label="Season schedule">
        {!payload || rows.length === 0 ? (
          <div className={styles.empty} role="status">
            {payload
              ? "No Regular Season games in mart for this season."
              : "Schedule mart not published yet."}
          </div>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Matchup</th>
                  <th scope="col">Time</th>
                  <th scope="col">Location</th>
                  <th scope="col">Availability</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.game_id}>
                    <td>{r.game_date}</td>
                    <td className={styles.matchup}>{r.matchup}</td>
                    <td
                      className={
                        r.game_time ? undefined : styles.muted
                      }
                    >
                      {displayTime(r.game_time)}
                    </td>
                    <td
                      className={
                        r.location ? undefined : styles.muted
                      }
                    >
                      {displayLocation(r.location)}
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        data-avail={r.availability}
                      >
                        {availLabel(r.availability)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.foot}>
          Source: season_schedule_reg_only · TBA Cup slots show Incomplete —
          not invented. 2026–27 box scores fill as games complete.
        </p>
      </section>
    </div>
  );
}
