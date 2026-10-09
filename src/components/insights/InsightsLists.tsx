"use client";

import { useMemo, useState } from "react";
import { StatLine, type StatLineValues } from "@/components/StatLine";
import { ListIcon, ListIconLegend } from "@/components/draft/ListIcons";
import { formatShortName } from "@/lib/formatName";
import type {
  InsightLeap,
  InsightList,
  InsightListsPayload,
  InsightRow,
} from "@/lib/loadInsightLists";
import { nameMatches } from "@/lib/normalize";
import styles from "./InsightsLists.module.css";

/**
 * Analyst lists. Titles + method notes come from insights.json.
 * Quiet "provisional" only when list.status is provisional or file status is preliminary.
 * 9-stat line = 2025-26 per-game averages by player_id (same data as Draft pick cards).
 * Nulls render "n/a" — never 0.
 */

const PREVIEW_ROWS = 5;

function fmtNum(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "n/a";
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(2)));
}

/**
 * Cheat-sheet value format: one decimal for scores, "%" when the list's
 * metric is a percent, whole numbers for count lists. null → "n/a", never 0.
 */
type ValueKind = "percent" | "count" | "score";

function valueKind(list: InsightList): ValueKind {
  const metric = (list.metric_label ?? "").trim();
  const label = (list.rows[0]?.value_label ?? "").trim();
  // Percent when the metric itself is a percent ("Breakout chance %", "% of team
  // games missed", "hot/cold (%)") — not when a % only appears in the method
  // (e.g. "OFF blend (50% 3yr + 50% 2025-26)").
  const pct = (t: string) => /(^%)|(%\s*$)|(\(%\))|(\bpercent\b)/i.test(t);
  if (pct(metric) || (!metric && pct(label))) return "percent";
  const vals = list.rows.map((r) => r.value).filter((v): v is number => typeof v === "number");
  if (/^(players|games|count)\b/i.test(metric) && vals.every(Number.isInteger)) return "count";
  return "score";
}

function fmtValue(v: number | null | undefined, kind: ValueKind): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "n/a";
  if (kind === "count") return String(Math.round(v));
  const s = v.toFixed(1);
  return kind === "percent" ? `${s}%` : s;
}

/** "2–4" for consecutive runs, else "2, 5, 7". */
function fmtRange(xs: number[]): string {
  if (xs.length === 0) return "";
  const s = [...xs].sort((a, b) => a - b);
  const consecutive = s.every((v, i) => i === 0 || v === s[i - 1] + 1);
  return consecutive && s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : s.join(", ");
}

function LeapBlock({ leap, preliminary }: { leap: InsightLeap; preliminary: boolean }) {
  const years = fmtRange(leap.leap_years);
  const ages = fmtRange(leap.leap_ages);
  const window =
    years || ages
      ? `Breakout window: ${[years ? `years ${years} in the league` : "", ages ? `ages ${ages}` : ""]
          .filter(Boolean)
          .join(", ")}`
      : null;
  return (
    <section className={styles.card} aria-label="Breakouts and age">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Breakouts and age</h2>
        {preliminary ? <span className={styles.prov}>provisional</span> : null}
      </div>
      {window ? <p className={styles.window}>{window}</p> : null}
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
          <dt>Decline from year</dt>
          <dd>{fmtNum(leap.decline_start_year)}</dd>
        </div>
      </dl>
      <p className={styles.reason}>{leap.summary}</p>
    </section>
  );
}

type Props = {
  data: InsightListsPayload | null;
  avgs: Record<string, StatLineValues>;
  directory: { player_id: string; full_name: string }[];
};

/**
 * Comeback (Analyst): the row's own `stats` are his last healthy season, so the 9-stat line reads
 * them, not the 2025-26 averages lookup (he may have no 2025-26 line at all).
 */
const OWN_STATS_LISTS = new Set(["comeback"]);

function ownStatLine(stats: InsightRow["stats"]): StatLineValues {
  const n = (k: string) => (typeof stats[k] === "number" ? (stats[k] as number) : null);
  return {
    pts: n("avg_pts"),
    reb: n("avg_reb"),
    ast: n("avg_ast"),
    stl: n("avg_stl"),
    blk: n("avg_blk"),
    fg3m: n("avg_fg3m"),
    fg_pct: n("fg_pct"),
    ft_pct: n("ft_pct"),
    tov: n("avg_tov"),
  };
}

/** "overall in 2024-25" → "2024-25" for the value tag. */
function seasonTag(label: string): string | null {
  const m = label.match(/\b(\d{4}-\d{2})\b/);
  return m ? m[1] : null;
}

function Row({
  row,
  listId,
  kind,
  avgs,
}: {
  row: InsightRow;
  listId: string;
  kind: ValueKind;
  avgs: Record<string, StatLineValues>;
}) {
  const missed = listId === "availability" ? row.stats.games_missed_3yr : undefined;
  const own = OWN_STATS_LISTS.has(listId);
  const tag = own ? seasonTag(row.value_label) : null;
  return (
    <li className={styles.row}>
      <span className={styles.rank}>{fmtNum(row.rank)}</span>
      <div className={styles.body}>
        <div className={styles.line}>
          <span className={styles.name}>{formatShortName(row.full_name)}</span>
          <span className={styles.value} title={own ? row.value_label : undefined}>
            {fmtValue(row.value, kind)}
            {tag ? <span className={styles.valueTag}> · {tag}</span> : null}
          </span>
        </div>
        {row.reason || missed !== undefined ? (
          <p className={styles.reason}>
            {row.reason}
            {!row.reason && missed !== undefined ? `missed ${fmtNum(missed)} games` : null}
          </p>
        ) : null}
        <StatLine values={own ? ownStatLine(row.stats) : (avgs[row.player_id] ?? null)} />
      </div>
    </li>
  );
}

function ListCard({
  list,
  preliminary,
  avgs,
}: {
  list: InsightList;
  preliminary: boolean;
  avgs: Record<string, StatLineValues>;
}) {
  const provisional = list.status === "provisional" || preliminary;
  const head = list.rows.slice(0, PREVIEW_ROWS);
  const kind = valueKind(list);
  const rest = list.rows.slice(PREVIEW_ROWS);
  return (
    <section className={styles.card} id={`list-${list.id}`} aria-labelledby={`t-${list.id}`} data-list-id={list.id}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id={`t-${list.id}`}>
          <span className={styles.titleIcon} aria-hidden="true">
            <ListIcon id={list.id} title={list.title} size={20} />
          </span>
          {list.title}
        </h2>
        {provisional ? <span className={styles.prov}>provisional</span> : null}
      </div>
      {list.method ? <p className={styles.method}>{list.method}</p> : null}
      {list.rows.length === 0 ? (
        <p className={styles.method}>No rows.</p>
      ) : (
        <>
          <ol className={styles.rows}>
            {head.map((r, i) => (
              <Row key={`${r.player_id}-${i}`} row={r} listId={list.id} kind={kind} avgs={avgs} />
            ))}
          </ol>
          {rest.length > 0 ? (
            <details className={styles.more}>
              <summary>Show all {list.rows.length}</summary>
              <ol className={styles.rows}>
                {rest.map((r, i) => (
                  <Row key={`${r.player_id}-${i + PREVIEW_ROWS}`} row={r} listId={list.id} kind={kind} avgs={avgs} />
                ))}
              </ol>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

export function InsightsLists({ data, avgs, directory }: Props) {
  const [query, setQuery] = useState("");
  const [iconsOpen, setIconsOpen] = useState(false);
  const lists = useMemo(() => data?.lists ?? [], [data]);
  const preliminary = data?.status === "preliminary";

  // player_id → [{list, row}] and a searchable name directory (lists ∪ 2025-26 board).
  const { hits, names } = useMemo(() => {
    const hitsMap = new Map<string, { list: InsightList; row: InsightRow }[]>();
    const nameMap = new Map<string, string>();
    for (const l of lists) {
      for (const r of l.rows) {
        const arr = hitsMap.get(r.player_id) ?? [];
        arr.push({ list: l, row: r });
        hitsMap.set(r.player_id, arr);
        nameMap.set(r.player_id, r.full_name);
      }
    }
    for (const d of directory) if (!nameMap.has(d.player_id)) nameMap.set(d.player_id, d.full_name);
    return { hits: hitsMap, names: [...nameMap.entries()] };
  }, [lists, directory]);

  const q = query.trim();
  const matches = useMemo(() => {
    if (q.length < 2) return [];
    return names
      .filter(([, n]) => nameMatches(n, q))
      .map(([id, n]) => ({ id, name: n, on: hits.get(id) ?? [] }))
      .sort((a, b) => b.on.length - a.on.length || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [q, names, hits]);

  if (!data || lists.length === 0) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Insights</h1>
        <p className={styles.method}>Lists aren&apos;t available right now.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <h1 className={styles.title}>Insights</h1>
        <input
          className={styles.search}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Find a player across lists"
          aria-label="Find a player across lists"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className={styles.iconsBtn}
          aria-expanded={iconsOpen}
          onClick={() => setIconsOpen((o) => !o)}
        >
          Icons
        </button>
        {iconsOpen ? (
          <ListIconLegend membership={{ lists: lists.map((l) => ({ id: l.id, title: l.title })), byPlayer: {}, order: {} }} />
        ) : null}
        <nav className={styles.jump} aria-label="Jump to list">
          {lists.map((l) => (
            <a key={l.id} href={`#list-${l.id}`} className={styles.jumpChip}>
              {l.title}
            </a>
          ))}
        </nav>
      </div>

      {q.length >= 2 ? (
        <section className={styles.results} aria-live="polite" aria-label="Search results">
          {matches.length === 0 ? (
            <p className={styles.none}>Not on any list</p>
          ) : (
            matches.map((m) => (
              <div key={m.id} className={styles.hit}>
                <div className={styles.hitName}>{formatShortName(m.name)}</div>
                {m.on.length === 0 ? (
                  <p className={styles.none}>Not on any list</p>
                ) : (
                  <ul className={styles.hitList}>
                    {m.on.map(({ list, row }) => (
                      <li key={list.id}>
                        <a href={`#list-${list.id}`} className={styles.hitLink}>
                          <span className={styles.hitTitle}>{list.title}</span>
                          <span className={styles.hitRank}>#{fmtNum(row.rank)}</span>
                          <span className={styles.hitValue}>{fmtValue(row.value, valueKind(list))}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>
      ) : null}

      {data.leap ? (
        <div className={styles.leapWrap}>
          <LeapBlock leap={data.leap} preliminary={preliminary} />
        </div>
      ) : null}

      <div className={styles.lists}>
        {lists.map((l) => (
          <ListCard key={l.id} list={l} preliminary={preliminary} avgs={avgs} />
        ))}
      </div>
    </div>
  );
}
