import { formatShortName } from "@/lib/formatName";
import type { InsightList, InsightListsPayload, InsightRow } from "@/lib/loadInsightLists";
import styles from "./InsightLists.module.css";

/**
 * Analyst insight lists (insights.json). Titles/methods come from the file.
 * Quiet "provisional" label when list.status is provisional or file status is preliminary.
 * Nulls render "n/a" — never 0.
 */

const PREVIEW_ROWS = 5;

function fmtNum(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "n/a";
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(2)));
}

function fmtAges(list: number[]): string {
  return list.length === 0 ? "none" : list.join(", ");
}

function Row({ row }: { row: InsightRow }) {
  const statEntries = Object.entries(row.stats);
  return (
    <li className={styles.row}>
      <span className={styles.rank}>{fmtNum(row.rank)}</span>
      <div className={styles.body}>
        <div className={styles.line}>
          <span className={styles.name}>{formatShortName(row.full_name)}</span>
          <span className={styles.value}>{fmtNum(row.value)}</span>
        </div>
        <div className={styles.sub}>
          <span>age {fmtNum(row.age)}</span>
          <span>yr {fmtNum(row.exp_year)}</span>
          {row.value_label ? <span className={styles.valueLabel}>{row.value_label}</span> : null}
        </div>
        {row.reason ? <p className={styles.reason}>{row.reason}</p> : null}
        {statEntries.length > 0 ? (
          <details className={styles.stats}>
            <summary>Stats</summary>
            <dl className={styles.statGrid}>
              {statEntries.map(([k, v]) => (
                <div key={k} className={styles.stat}>
                  <dt>{k}</dt>
                  <dd className={v == null ? styles.na : undefined}>{fmtNum(v)}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function List({ list, preliminary }: { list: InsightList; preliminary: boolean }) {
  const provisional = list.status === "provisional" || preliminary;
  const head = list.rows.slice(0, PREVIEW_ROWS);
  const rest = list.rows.slice(PREVIEW_ROWS);
  return (
    <section className={styles.card} aria-labelledby={`il-${list.id}`} data-list-id={list.id}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle} id={`il-${list.id}`}>
          {list.title}
        </h3>
        {provisional ? <span className={styles.prov}>provisional</span> : null}
      </div>
      {list.method ? <p className={styles.method}>{list.method}</p> : null}
      {list.metric_label ? <p className={styles.metric}>{list.metric_label}</p> : null}
      {list.rows.length === 0 ? (
        <p className={styles.method}>No rows.</p>
      ) : (
        <>
          <ol className={styles.rows}>
            {head.map((r, i) => (
              <Row key={`${r.player_id}-${i}`} row={r} />
            ))}
          </ol>
          {rest.length > 0 ? (
            <details className={styles.more}>
              <summary>Show all {list.rows.length}</summary>
              <ol className={styles.rows}>
                {rest.map((r, i) => (
                  <Row key={`${r.player_id}-${i + PREVIEW_ROWS}`} row={r} />
                ))}
              </ol>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

export function InsightLists({ data }: { data: InsightListsPayload }) {
  const preliminary = data.status === "preliminary";
  const leap = data.leap;
  return (
    <section className={styles.wrap} aria-label="Draft insight lists">
      {leap ? (
        <div className={styles.leap}>
          <div className={styles.cardHead}>
            <h2 className={styles.leapTitle}>Age &amp; leap</h2>
            {preliminary ? <span className={styles.prov}>provisional</span> : null}
          </div>
          <p className={styles.leapText}>{leap.summary}</p>
          <dl className={styles.leapGrid}>
            <div>
              <dt>Peak age</dt>
              <dd>{fmtNum(leap.peak_age)}</dd>
            </div>
            <div>
              <dt>Decline from age</dt>
              <dd>{fmtNum(leap.decline_start_age)}</dd>
            </div>
            <div>
              <dt>Decline from NBA yr</dt>
              <dd>{fmtNum(leap.decline_start_year)}</dd>
            </div>
            <div>
              <dt>Leap ages</dt>
              <dd>{fmtAges(leap.leap_ages)}</dd>
            </div>
            <div>
              <dt>Leap years</dt>
              <dd>{fmtAges(leap.leap_years)}</dd>
            </div>
            <div>
              <dt>Season pairs</dt>
              <dd>{fmtNum(leap.n_pairs)}</dd>
            </div>
          </dl>
          {leap.year3_verdict || leap.year7_verdict ? (
            <details className={styles.more}>
              <summary>Year 3 / year 7 checks</summary>
              <p className={styles.method}>Year 3: {leap.year3_verdict ?? "n/a"}</p>
              <p className={styles.method}>Year 7: {leap.year7_verdict ?? "n/a"}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      <div className={styles.lists}>
        {data.lists.map((l) => (
          <List key={l.id} list={l} preliminary={preliminary} />
        ))}
      </div>
    </section>
  );
}
