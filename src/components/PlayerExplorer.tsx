"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAvg, formatPct } from "@/lib/format";
import type {
  SeasonId,
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";
import {
  SCOPE_CHART_LABELS,
  SCOPE_OPTIONS,
  SEASON_OPTIONS,
} from "@/types/season_player_averages";
import styles from "./PlayerExplorer.module.css";

type PlayerHit = { player_id: string; full_name: string };

type GameRow = {
  game_id: string;
  player_id: string;
  full_name: string;
  season: string;
  season_type: string;
  game_date: string;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  fg_pct: number | null;
  ft_pct: number | null;
};

type StatKey =
  | "pts"
  | "ast"
  | "fg3m"
  | "reb"
  | "stl"
  | "blk"
  | "fg_pct"
  | "ft_pct"
  | "tov";

const STAT_OPTIONS: { key: StatKey; label: string; pct?: boolean }[] = [
  { key: "pts", label: "PTS" },
  { key: "ast", label: "AST" },
  { key: "fg3m", label: "3PM" },
  { key: "reb", label: "REB" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "fg_pct", label: "FG%", pct: true },
  { key: "ft_pct", label: "FT%", pct: true },
  { key: "tov", label: "TOV" },
];

const SEASON_COLORS: Record<string, string> = {
  "2023-24": "#22d3ee",
  "2024-25": "#e879f9",
  "2025-26": "#f97316",
};

/** Fixed fantasy ranges for radar (0–100 display). TOV is inverted. */
const RADAR_RANGES: Record<
  StatKey,
  { min: number; max: number; invert?: boolean; pct?: boolean }
> = {
  pts: { min: 0, max: 35 },
  ast: { min: 0, max: 12 },
  fg3m: { min: 0, max: 5 },
  reb: { min: 0, max: 14 },
  stl: { min: 0, max: 2.5 },
  blk: { min: 0, max: 2.5 },
  fg_pct: { min: 0.4, max: 0.6, pct: true },
  ft_pct: { min: 0.65, max: 0.95, pct: true },
  tov: { min: 0, max: 5, invert: true },
};

const RADAR_NORM_NOTE =
  "Radar normalization: each spoke is scaled to a fixed fantasy range (not league %ile) — PTS 0–35, AST 0–12, 3PM 0–5, REB 0–14, STL/BLK 0–2.5, FG% 40–60, FT% 65–95, TOV 0–5 inverted (lower TOV → larger spoke). 3PM uses mart avg_fg3m only.";

function gameStat(g: GameRow, key: StatKey): number | null {
  if (key === "fg_pct" || key === "ft_pct") {
    const v = g[key];
    if (v == null || Number.isNaN(v)) return null;
    return v * 100;
  }
  return g[key];
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Map raw mart average → 0–100 radar score for one category. */
function normalizeRadarValue(
  key: StatKey,
  raw: number | null | undefined
): number | null {
  if (raw == null || Number.isNaN(Number(raw))) return null;
  const { min, max, invert } = RADAR_RANGES[key];
  const t = (Number(raw) - min) / (max - min);
  const scored = invert ? 1 - t : t;
  return clamp01(scored * 100);
}

function avgForStat(
  row: SeasonPlayerAverage | null | undefined,
  avgFg3m: number | null | undefined,
  key: StatKey
): number | null {
  if (!row) return null;
  switch (key) {
    case "pts":
      return row.avg_pts;
    case "ast":
      return row.avg_ast;
    case "fg3m":
      // Client contract: mart avg_fg3m only.
      return avgFg3m ?? row.avg_fg3m ?? null;
    case "reb":
      return row.avg_reb;
    case "stl":
      return row.avg_stl;
    case "blk":
      return row.avg_blk;
    case "fg_pct":
      return row.fg_pct;
    case "ft_pct":
      return row.ft_pct;
    case "tov":
      return row.avg_tov;
    default:
      return null;
  }
}

type SeasonAvgBundle = {
  row: SeasonPlayerAverage | null;
  avg_fg3m: number | null;
};

export function PlayerExplorer() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlayerHit | null>(null);

  const [chartSeasons, setChartSeasons] = useState<SeasonId[]>(["2025-26"]);
  const [chartScope, setChartScope] = useState<SeasonTypeScope>("reg_only");
  const [stat, setStat] = useState<StatKey>("pts");

  const [games, setGames] = useState<GameRow[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [avgBySeason, setAvgBySeason] = useState<
    Partial<Record<SeasonId, SeasonAvgBundle>>
  >({});
  const [avgLoading, setAvgLoading] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const res = await fetch(
      `/api/player-search?q=${encodeURIComponent(q)}`
    );
    if (!res.ok) return;
    const data = await res.json();
    setHits(data.players ?? []);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Load games when player / chart controls change
  useEffect(() => {
    if (!selected) {
      setGames([]);
      return;
    }
    let cancelled = false;
    setGamesLoading(true);
    const seasons = chartSeasons.join(",");
    const url = `/api/player-games?player_id=${encodeURIComponent(
      selected.player_id
    )}&seasons=${encodeURIComponent(seasons)}&scope=${encodeURIComponent(
      chartScope
    )}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setGames(
          Array.isArray(data.rows)
            ? data.rows
            : Array.isArray(data.games)
              ? data.games
              : []
        );
      })
      .catch(() => {
        if (!cancelled) setGames([]);
      })
      .finally(() => {
        if (!cancelled) setGamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, chartSeasons, chartScope]);

  // Load mart averages for each chartSeason @ chartScope (radar + metric cards)
  useEffect(() => {
    if (!selected) {
      setAvgBySeason({});
      return;
    }
    let cancelled = false;
    setAvgLoading(true);
    const seasons = [...chartSeasons];
    Promise.all(
      seasons.map(async (season) => {
        const url = `/api/player-averages?player_id=${encodeURIComponent(
          selected.player_id
        )}&season=${encodeURIComponent(season)}&scope=${encodeURIComponent(
          chartScope
        )}`;
        const res = await fetch(url);
        const data = await res.json();
        // 3PM: mart avg_fg3m only (no client fallbacks).
        const avg_fg3m =
          data.avg_fg3m != null
            ? Number(data.avg_fg3m)
            : data.row?.avg_fg3m != null
              ? Number(data.row.avg_fg3m)
              : null;
        return {
          season,
          bundle: {
            row: (data.row as SeasonPlayerAverage | null) ?? null,
            avg_fg3m,
          } satisfies SeasonAvgBundle,
        };
      })
    )
      .then((results) => {
        if (cancelled) return;
        const next: Partial<Record<SeasonId, SeasonAvgBundle>> = {};
        for (const r of results) next[r.season] = r.bundle;
        setAvgBySeason(next);
      })
      .catch(() => {
        if (!cancelled) setAvgBySeason({});
      })
      .finally(() => {
        if (!cancelled) setAvgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, chartSeasons, chartScope]);

  function pickPlayer(p: PlayerHit) {
    setSelected(p);
    setQuery(p.full_name);
    setOpen(false);
  }

  function toggleSeason(s: SeasonId) {
    setChartSeasons((prev) => {
      if (prev.includes(s)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== s);
      }
      if (prev.length >= 3) return prev;
      return [...prev, s].sort() as SeasonId[];
    });
  }

  /**
   * Line chart: X = game_num (1…N per season).
   * Sort each season's games by game_date, assign index; overlay ≤3 seasons
   * on the same game-number axis (lines may cross / end at different N).
   */
  const chartData = useMemo(() => {
    const bySeason = new Map<string, GameRow[]>();
    for (const g of games) {
      let list = bySeason.get(g.season);
      if (!list) {
        list = [];
        bySeason.set(g.season, list);
      }
      list.push(g);
    }
    let maxN = 0;
    const indexed = new Map<string, Map<number, GameRow>>();
    for (const season of chartSeasons) {
      const list = (bySeason.get(season) ?? [])
        .slice()
        .sort((a, b) => {
          if (a.game_date < b.game_date) return -1;
          if (a.game_date > b.game_date) return 1;
          return a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : 0;
        });
      const m = new Map<number, GameRow>();
      list.forEach((g, i) => {
        const game_num = i + 1;
        m.set(game_num, g);
      });
      indexed.set(season, m);
      if (list.length > maxN) maxN = list.length;
    }
    const rows: Record<string, string | number | null>[] = [];
    for (let game_num = 1; game_num <= maxN; game_num++) {
      const row: Record<string, string | number | null> = { game_num };
      for (const season of chartSeasons) {
        const g = indexed.get(season)?.get(game_num);
        row[season] = g ? gameStat(g, stat) : null;
        row[`date_${season}`] = g ? g.game_date : null;
      }
      rows.push(row);
    }
    return rows;
  }, [games, chartSeasons, stat]);

  const radarData = useMemo(() => {
    return STAT_OPTIONS.map((opt) => {
      const point: Record<string, string | number | null> = {
        cat: opt.label,
        catKey: opt.key,
      };
      for (const season of chartSeasons) {
        const bundle = avgBySeason[season];
        const raw = avgForStat(bundle?.row, bundle?.avg_fg3m, opt.key);
        point[season] = normalizeRadarValue(opt.key, raw);
      }
      return point;
    });
  }, [avgBySeason, chartSeasons]);

  const isPct = STAT_OPTIONS.find((s) => s.key === stat)?.pct === true;
  const hasAnyAvg = chartSeasons.some((s) => avgBySeason[s]?.row);

  function formatCardValue(key: StatKey, raw: number | null): string {
    if (raw == null) return "—";
    if (key === "fg_pct" || key === "ft_pct") return formatPct(raw);
    return formatAvg(raw);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.glowOrange} aria-hidden />
      <div className={styles.glowCyan} aria-hidden />
      <div className={styles.glowMagenta} aria-hidden />

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Player Explorer</h1>
          <p className={styles.subtitle}>
            Game-by-game · radar · 9-cat · Phase 3
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.searchWrap} ref={searchRef}>
            <label>
              <span className={styles.srOnly}>Search players</span>
              <input
                type="search"
                placeholder="Search players (e.g. doncic)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                autoComplete="off"
              />
            </label>
            {open && hits.length > 0 && (
              <div className={styles.dropdown} role="listbox">
                {hits.map((p) => (
                  <button
                    key={p.player_id}
                    type="button"
                    role="option"
                    aria-selected={selected?.player_id === p.player_id}
                    onClick={() => pickPlayer(p)}
                  >
                    {p.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {!selected ? (
        <div className={styles.panel}>
          <p className={styles.empty}>
            Search and select a player from the mart to load charts.
          </p>
        </div>
      ) : (
        <>
          {/* 1) Line chart — X = game_num */}
          <section className={styles.panel} aria-label="Game chart">
            <h2 className={styles.panelTitle}>
              {selected.full_name} · game-by-game
            </h2>
            <p className={styles.meta}>
              Scope <code>{SCOPE_CHART_LABELS[chartScope]}</code> · up to 3
              seasons · skip <code>min≤0</code> · x-axis{" "}
              <code>game_num</code>
            </p>

            <div className={`${styles.controls} ${styles.chartControls}`}>
              <div className={styles.seg} role="group" aria-label="Chart seasons">
                {SEASON_OPTIONS.map((s) => {
                  const on = chartSeasons.includes(s);
                  const atCap = !on && chartSeasons.length >= 3;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={on ? styles.active : undefined}
                      disabled={atCap}
                      onClick={() => toggleSeason(s)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div
                className={styles.seg}
                role="group"
                aria-label="Chart: raw curated per-game · scope"
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={
                      chartScope === opt.value ? styles.active : undefined
                    }
                    onClick={() => setChartScope(opt.value)}
                  >
                    {SCOPE_CHART_LABELS[opt.value]}
                  </button>
                ))}
              </div>
              <div className={styles.seg} role="group" aria-label="Stat">
                {STAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={stat === opt.key ? styles.active : undefined}
                    onClick={() => setStat(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {gamesLoading ? (
              <p className={styles.empty}>Loading games…</p>
            ) : chartData.length === 0 ? (
              <p className={styles.empty}>
                No games for this player / season / scope.
              </p>
            ) : (
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 4, bottom: 12 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="game_num"
                      type="number"
                      domain={[1, "dataMax"]}
                      allowDecimals={false}
                      stroke="#cbd5e1"
                      tick={{ fill: "#cbd5e1", fontSize: 10 }}
                      minTickGap={20}
                      label={{
                        value: "Game #",
                        position: "insideBottomRight",
                        offset: -2,
                        fill: "#94a3b8",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      width={36}
                      stroke="#cbd5e1"
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                      domain={isPct ? [0, 100] : ["auto", "auto"]}
                      tickFormatter={(v) =>
                        isPct ? `${Number(v).toFixed(0)}` : String(v)
                      }
                    />
                    <Tooltip
                      wrapperStyle={{ maxWidth: 280, zIndex: 20 }}
                      contentStyle={{
                        background: "rgba(12,14,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        color: "#f1f5f9",
                      }}
                      formatter={(value: number | string, name: string) => {
                        if (value == null || value === "") return ["—", name];
                        const n = Number(value);
                        const series =
                          isPct
                            ? `${name} (single-game rate)`
                            : name;
                        if (isPct) return [`${n.toFixed(1)}%`, series];
                        return [
                          Number.isInteger(n) ? n : n.toFixed(1),
                          series,
                        ];
                      }}
                      labelFormatter={(label, payload) => {
                        const dates = (payload ?? [])
                          .map((p) => {
                            const season = String(p.dataKey ?? p.name ?? "");
                            const row = p.payload as Record<
                              string,
                              string | number | null
                            >;
                            const d = row[`date_${season}`];
                            return d ? `${season}: ${d}` : null;
                          })
                          .filter(Boolean);
                        const extra =
                          dates.length > 0 ? ` · ${dates.join(" · ")}` : "";
                        return `Game #${label}${extra}`;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, maxWidth: "100%" }}
                    />
                    {chartSeasons.map((s) => (
                      <Line
                        key={s}
                        type="monotone"
                        dataKey={s}
                        name={s}
                        stroke={SEASON_COLORS[s] || "#fdba74"}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className={styles.meta} style={{ marginTop: "0.75rem" }}>
              {games.length} games loaded · x-axis <code>game_num</code>{" "}
              (1…N per season, sorted by date) · counting stats are per-game;
              FG%/FT% are single-game rates
            </p>
          </section>

          {/* 2) Radar — Recharts RadarChart, ≤3 season polygons */}
          <section className={styles.panel} aria-label="9-cat radar">
            <h2 className={styles.panelTitle}>9-cat radar</h2>
            <p className={styles.meta}>
              Mart averages · <code>{SCOPE_CHART_LABELS[chartScope]}</code> ·
              seasons match line chart · 3PM = <code>avg_fg3m</code>
            </p>
            {avgLoading ? (
              <p className={styles.empty}>Loading averages…</p>
            ) : !hasAnyAvg ? (
              <p className={styles.empty}>
                No mart rows for selected seasons /{" "}
                <code>{chartScope}</code>.
              </p>
            ) : (
              <div className={styles.radarBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis
                      dataKey="cat"
                      tick={(props) => {
                        const { x, y, payload, textAnchor } = props;
                        const label = String(payload?.value ?? "");
                        const opt = STAT_OPTIONS.find((o) => o.label === label);
                        const highlighted = opt?.key === stat;
                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor={textAnchor}
                            fill={highlighted ? "#fdba74" : "#cbd5e1"}
                            fontSize={highlighted ? 13 : 11}
                            fontWeight={highlighted ? 700 : 500}
                            style={{
                              cursor: "pointer",
                              textShadow: highlighted
                                ? "0 0 10px rgba(249,115,22,0.65)"
                                : undefined,
                            }}
                            onClick={() => opt && setStat(opt.key)}
                          >
                            {label}
                          </text>
                        );
                      }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    {chartSeasons.map((s) => (
                      <Radar
                        key={s}
                        name={s}
                        dataKey={s}
                        stroke={SEASON_COLORS[s] || "#fdba74"}
                        fill={SEASON_COLORS[s] || "#fdba74"}
                        fillOpacity={0.22}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: 12, maxWidth: "100%" }}
                    />
                    <Tooltip
                      wrapperStyle={{ maxWidth: 280, zIndex: 20 }}
                      contentStyle={{
                        background: "rgba(12,14,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        color: "#f1f5f9",
                      }}
                      formatter={(value: number | string, name: string) => {
                        if (value == null || value === "") return ["—", name];
                        return [`${Number(value).toFixed(0)} / 100`, name];
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className={styles.normNote}>{RADAR_NORM_NOTE}</p>
          </section>

          {/* 3) Metric cards — toggles update cards + highlight radar spoke */}
          <section className={styles.panel} aria-label="9-cat metric cards">
            <h2 className={styles.panelTitle}>9-cat metrics</h2>
            <p className={styles.meta}>
              Select a card to highlight that radar spoke and set the line-chart
              stat · values from <code>/api/player-averages</code> (
              <code>avg_fg3m</code> for 3PM)
            </p>
            {avgLoading ? (
              <p className={styles.empty}>Loading averages…</p>
            ) : !hasAnyAvg ? (
              <p className={styles.empty}>No mart averages to show.</p>
            ) : (
              <div className={styles.metricGrid}>
                {STAT_OPTIONS.map((opt) => {
                  const active = stat === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={`${styles.metricCard}${
                        active ? ` ${styles.metricCardActive}` : ""
                      }`}
                      onClick={() => setStat(opt.key)}
                      aria-pressed={active}
                    >
                      <span className={styles.metricLabel}>{opt.label}</span>
                      <div className={styles.metricValues}>
                        {chartSeasons.map((s) => {
                          const bundle = avgBySeason[s];
                          const raw = avgForStat(
                            bundle?.row,
                            bundle?.avg_fg3m,
                            opt.key
                          );
                          return (
                            <div key={s} className={styles.metricSeasonRow}>
                              <span
                                className={styles.metricDot}
                                style={{
                                  background: SEASON_COLORS[s] || "#fdba74",
                                }}
                                aria-hidden
                              />
                              <span className={styles.metricSeason}>{s}</span>
                              <span className={styles.metricVal}>
                                {formatCardValue(opt.key, raw)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
