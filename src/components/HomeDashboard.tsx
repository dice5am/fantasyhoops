"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatAvg, formatPct } from "@/lib/format";
import { formatShortName } from "@/lib/formatName";
import type { LeagueContextPayload } from "@/lib/leagueAggregates";
import {
  RADAR_NORM_NOTE,
  RADAR_SPOKE_ORDER,
  STAT_LABEL,
  STAT_OPTIONS,
  normalizeRadarValue,
  type RadarStatKey,
} from "@/lib/radar";
import {
  SORT_CHIPS,
  SPECTRUM_BAND_LABEL,
  SPECTRUM_BAND_ORDER,
  buildO1Strip,
  buildSpectrum,
  enrichBoardRows,
  rankFieldForSort,
  scoreFieldForSort,
  type BoardRow,
  type ScoreSortKey,
} from "@/lib/homeScarcity";
import type { FantasyScoresPayload } from "@/types/fantasy_score";
import type { SeasonTypeScope } from "@/types/season_player_averages";
import { SCOPE_OPTIONS, SEASON_OPTIONS } from "@/types/season_player_averages";
import { SeasonSelect } from "@/components/SeasonSelect";
import {
  DEFAULT_TOP_PCT,
  TOP_PCT_MAX,
  TOP_PCT_MIN,
  TOP_PCT_STEP,
  topPctLabel,
} from "@/lib/top250";
import { TeamMarkPip } from "@/components/TeamMarkPip";
import { FALLBACK_CHART_STROKE } from "@/lib/teamColors";
import styles from "./HomeDashboard.module.css";

type Props = {
  context: LeagueContextPayload;
  season: string;
  scope: SeasonTypeScope;
  topPct: number;
  initialFantasy?: FantasyScoresPayload | null;
};

function fmtStat(key: RadarStatKey, v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  if (key === "fg_pct" || key === "ft_pct") return formatPct(v);
  return formatAvg(v);
}

function fmtScore(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toFixed(1);
}

const INSIGHT_LINKS = [
  { href: "/insight/fantasy-score-method", label: "Fantasy score method" },
  { href: "/insight/rank-stability-5yr", label: "Rank stability" },
  { href: "/insight/rank-stability-playoff", label: "Playoff stability" },
] as const;

const BOARD_LIMIT = 25;

function ScarcitySpectrum({
  rows,
  ready,
}: {
  rows: ReturnType<typeof buildSpectrum>;
  ready: boolean;
}) {
  return (
    <section
      className={`${styles.scorePanel} ${styles.scorePanelHero} ${styles.spectrumHero}`}
      aria-label="Scarcity Spectrum"
    >
      <div className={styles.spectrumHead}>
        <div>
          <h2 className={styles.panelTitle}>Scarcity Spectrum · COUNT</h2>
          <p className={styles.panelSub}>
            Bars = n players in score bands · ≥90 / ≥80 / mid(40–60) · not
            percentile % · recomputed on topPct
          </p>
        </div>
        <ul className={styles.spectrumLegend} aria-label="Score count bands">
          {SPECTRUM_BAND_ORDER.map((b) => (
            <li key={b}>
              <span
                className={styles.legendSwatch}
                data-band={b}
                aria-hidden
              />
              {SPECTRUM_BAND_LABEL[b]}
            </li>
          ))}
        </ul>
      </div>
      {!ready ? (
        <div className={styles.awaitingBox}>
          <p className={styles.awaitingTitle}>Awaiting scarcity pool</p>
        </div>
      ) : (
        <ul className={styles.spectrumList}>
          {rows.map((row) => {
            const label = `${row.n_ge_90}/${row.n_ge_80}/${row.n_in_40_60}`;
            return (
              <li key={row.metric} className={styles.spectrumRow}>
                <span className={styles.spectrumLabel}>
                  {row.metric === "TOV" ? "TOV†" : row.metric}
                </span>
                <div
                  className={styles.spectrumBar}
                  role="img"
                  aria-label={`${row.metric}: ${row.n_ge_90} ≥90, ${row.n_ge_80} ≥80, ${row.n_in_40_60} mid`}
                >
                  {SPECTRUM_BAND_ORDER.map((band) => {
                    const count = row.counts[band];
                    if (count <= 0) return null;
                    return (
                      <span
                        key={band}
                        className={styles.spectrumSeg}
                        data-band={band}
                        style={{ flexGrow: count, flexBasis: 0 }}
                        title={`${SPECTRUM_BAND_LABEL[band]}: ${count}`}
                      />
                    );
                  })}
                  {row.counts.other > 0 ? (
                    <span
                      className={styles.spectrumSeg}
                      data-band="other"
                      style={{ flexGrow: row.counts.other, flexBasis: 0 }}
                      title={`other: ${row.counts.other}`}
                    />
                  ) : null}
                </div>
                <span className={styles.spectrumMeta}>
                  <span
                    className={styles.ge80}
                    title="n≥90 / n≥80 / mid(40–60)"
                  >
                    {label}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.spectrumFoot}>
        Labels: n≥90 / n≥80 / mid · † TOV inverted (high score = low TOV risk —
        avoid elite language). Counts recompute when topPct / season / scope
        changes.
      </p>
    </section>
  );
}

function O1HeatStrip({
  strip,
  ready,
}: {
  strip: ReturnType<typeof buildO1Strip>;
  ready: boolean;
}) {
  if (!ready || !strip) {
    return (
      <section className={styles.o1Strip} aria-label="O1 percentile strip">
        <h3 className={styles.o1StripTitle}>O1 · pool strip</h3>
        <div className={styles.awaitingBox}>
          <p className={styles.awaitingTitle}>Awaiting O1 strip</p>
        </div>
      </section>
    );
  }
  const { min, max, p10, p25, p50, p75, p90 } = strip;
  const span = Math.max(max - min, 1e-6);
  const pct = (v: number) => `${((v - min) / span) * 100}%`;
  return (
    <section className={styles.o1Strip} aria-label="O1 percentile strip">
      <div className={styles.o1StripHead}>
        <h3 className={styles.o1StripTitle}>O1 · pool strip</h3>
        <p className={styles.panelSub}>
          Percentiles only · p50 {fmtScore(p50)} · p90 {fmtScore(p90)} · max{" "}
          {fmtScore(max)} · no ≥80 callouts
        </p>
      </div>
      <div className={styles.o1Track} aria-hidden>
        <span
          className={styles.o1Band}
          style={{ left: "0%", width: pct(p25) }}
          data-band="low"
        />
        <span
          className={styles.o1Band}
          style={{
            left: pct(p25),
            width: `${((p75 - p25) / span) * 100}%`,
          }}
          data-band="mid"
        />
        <span
          className={styles.o1Band}
          style={{
            left: pct(p75),
            width: `${((max - p75) / span) * 100}%`,
          }}
          data-band="high"
        />
        <span className={styles.o1Mark} style={{ left: pct(p10) }} title={`p10 ${fmtScore(p10)}`} />
        <span className={styles.o1Mark} style={{ left: pct(p50) }} data-strong title={`p50 ${fmtScore(p50)}`} />
        <span className={styles.o1Mark} style={{ left: pct(p90) }} data-strong title={`p90 ${fmtScore(p90)}`} />
        <span className={styles.o1Mark} style={{ left: pct(max) }} data-max title={`max ${fmtScore(max)}`} />
      </div>
      <div className={styles.o1Ticks}>
        <span>min {fmtScore(min)}</span>
        <span>p25 {fmtScore(p25)}</span>
        <span>p75 {fmtScore(p75)}</span>
        <span>max {fmtScore(max)}</span>
      </div>
    </section>
  );
}

function RarityBadge({
  label,
  rarity,
}: {
  label: string;
  rarity: "ELITE" | "SCARCE" | "SOLID";
}) {
  return (
    <span className={styles.rarityBadge} data-rarity={rarity}>
      {label} · {rarity}
    </span>
  );
}

export function HomeDashboard({
  context: initialContext,
  season: initialSeason,
  scope: initialScope,
  topPct: initialTopPct,
  initialFantasy = null,
}: Props) {
  const [context, setContext] = useState(initialContext);
  const [season, setSeason] = useState(initialSeason);
  const [scope, setScope] = useState(initialScope);
  const [topPct, setTopPct] = useState(
    Number.isFinite(initialTopPct) ? initialTopPct : DEFAULT_TOP_PCT
  );
  const [loading, setLoading] = useState(false);
  const [fantasy, setFantasy] = useState<FantasyScoresPayload | null>(
    initialFantasy
  );
  const [fantasyStatus, setFantasyStatus] = useState<
    "loading" | "awaiting" | "ready" | "error"
  >(
    initialFantasy?.meta?.mart_available && initialFantasy.rows.length > 0
      ? "ready"
      : "loading"
  );
  const [sortKey, setSortKey] = useState<ScoreSortKey>("o1");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "score_o1", desc: true },
  ]);
  const [showCats, setShowCats] = useState(false);
  const fetchGen = useRef(0);

  /** Best-effort chartPrimary from league leaders (TEAM_MARK_UX pips). */
  const colorByPlayer = useMemo(() => {
    const m = new Map<string, string>();
    const add = (
      entries: { player_id: string; chart_color?: string }[] | undefined
    ) => {
      if (!entries) return;
      for (const e of entries) {
        if (e.chart_color && !m.has(e.player_id)) {
          m.set(e.player_id, e.chart_color);
        }
      }
    };
    for (const key of Object.keys(context.leaders ?? {})) {
      add(context.leaders[key as keyof typeof context.leaders]);
    }
    add(context.stocks_leaders);
    return m;
  }, [context.leaders, context.stocks_leaders]);

  const teamByPlayer = useMemo(() => {
    const m = new Map<string, string>();
    const add = (
      entries:
        | { player_id: string; team_abbreviation?: string | null }[]
        | undefined
    ) => {
      if (!entries) return;
      for (const e of entries) {
        if (e.team_abbreviation && !m.has(e.player_id)) {
          m.set(e.player_id, e.team_abbreviation);
        }
      }
    };
    for (const key of Object.keys(context.leaders ?? {})) {
      add(context.leaders[key as keyof typeof context.leaders]);
    }
    add(context.stocks_leaders);
    return m;
  }, [context.leaders, context.stocks_leaders]);

  const scoresReady =
    fantasyStatus === "ready" && !!fantasy && fantasy.rows.length > 0;
  const poolRows = fantasy?.rows ?? [];

  const spectrum = useMemo(
    () => (scoresReady ? buildSpectrum(poolRows) : []),
    [scoresReady, poolRows]
  );
  const o1Strip = useMemo(
    () => (scoresReady ? buildO1Strip(poolRows) : null),
    [scoresReady, poolRows]
  );
  const boardRows = useMemo(
    () => (scoresReady ? enrichBoardRows(poolRows) : []),
    [scoresReady, poolRows]
  );

  const sortedBoard = useMemo(() => {
    const field = scoreFieldForSort(sortKey);
    const rankField = rankFieldForSort(sortKey);
    return [...boardRows]
      .sort((a, b) => {
        const ra = Number(a[rankField]);
        const rb = Number(b[rankField]);
        if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) {
          return ra - rb;
        }
        const sa = Number(a[field]);
        const sb = Number(b[field]);
        return sb - sa;
      })
      .slice(0, BOARD_LIMIT);
  }, [boardRows, sortKey]);

  const radarData = useMemo(() => {
    const avgs = fantasy?.pool_avgs;
    const source = avgs ?? {
      pts: context.league_avgs.pts,
      ast: context.league_avgs.ast,
      fg3m: context.league_avgs.fg3m,
      reb: context.league_avgs.reb,
      stl: context.league_avgs.stl,
      blk: context.league_avgs.blk,
      fg_pct: context.league_avgs.fg_pct,
      ft_pct: context.league_avgs.ft_pct,
      tov: context.league_avgs.tov,
    };
    return RADAR_SPOKE_ORDER.map((key) => {
      const raw = source[key];
      const opt = STAT_OPTIONS.find((s) => s.key === key);
      return {
        stat: opt?.label ?? key,
        key,
        league: normalizeRadarValue(key, raw),
        raw,
      };
    });
  }, [fantasy?.pool_avgs, context.league_avgs]);

  const scatterData = useMemo(() => {
    if (!poolRows.length) return [];
    return poolRows.map((r) => ({
      player_id: r.player_id,
      name: formatShortName(r.full_name),
      full_name: r.full_name,
      off: r.score_off,
      def: r.score_def,
      min: r.avg_min,
      color: colorByPlayer.get(r.player_id) ?? FALLBACK_CHART_STROKE,
    }));
  }, [poolRows, colorByPlayer]);

  const fetchFantasyScores = useCallback(
    async (
      nextSeason: string,
      nextScope: SeasonTypeScope,
      nextTopPct: number,
      gen: number
    ) => {
      try {
        const qs = new URLSearchParams();
        qs.set("season", nextSeason);
        qs.set("scope", nextScope);
        qs.set("topPct", String(nextTopPct));
        const res = await fetch(`/api/fantasy-scores?${qs.toString()}`);
        if (gen !== fetchGen.current) return;
        if (res.status === 503) {
          setFantasy(null);
          setFantasyStatus("awaiting");
          return;
        }
        if (!res.ok) {
          setFantasy(null);
          setFantasyStatus("error");
          return;
        }
        const data = (await res.json()) as FantasyScoresPayload;
        if (gen !== fetchGen.current) return;
        if (!data.meta?.mart_available) {
          setFantasy(data);
          setFantasyStatus("awaiting");
          return;
        }
        setFantasy(data);
        setFantasyStatus("ready");
      } catch {
        if (gen !== fetchGen.current) return;
        setFantasy(null);
        setFantasyStatus("error");
      }
    },
    []
  );

  useEffect(() => {
    if (initialFantasy?.meta?.mart_available && initialFantasy.rows.length > 0) {
      return;
    }
    const gen = ++fetchGen.current;
    void fetchFantasyScores(
      initialSeason,
      initialScope === "reg_plus_playoffs" ? "reg_only" : initialScope,
      Number.isFinite(initialTopPct) ? initialTopPct : DEFAULT_TOP_PCT,
      gen
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = useCallback(
    async (
      nextSeason: string,
      nextScope: SeasonTypeScope,
      nextTopPct: number
    ) => {
      const s = nextScope === "reg_plus_playoffs" ? "reg_only" : nextScope;
      const pct = Number.isFinite(nextTopPct) ? nextTopPct : DEFAULT_TOP_PCT;
      setSeason(nextSeason);
      setScope(s);
      setTopPct(pct);
      const params = new URLSearchParams();
      params.set("season", nextSeason);
      params.set("scope", s);
      params.set("topPct", String(pct));
      window.history.replaceState(
        window.history.state,
        "",
        `/?${params.toString()}`
      );

      const gen = ++fetchGen.current;
      setLoading(true);
      setFantasyStatus("loading");
      try {
        const qs = new URLSearchParams();
        qs.set("season", nextSeason);
        qs.set("scope", s);
        qs.set("topPct", String(pct));
        const [leagueRes] = await Promise.all([
          fetch(`/api/league-context?${qs.toString()}`),
          fetchFantasyScores(nextSeason, s, pct, gen),
        ]);
        if (!leagueRes.ok) throw new Error(`league-context ${leagueRes.status}`);
        const data = (await leagueRes.json()) as LeagueContextPayload;
        if (gen !== fetchGen.current) return;
        setContext(data);
      } catch {
        // keep prior
      } finally {
        if (gen === fetchGen.current) setLoading(false);
      }
    },
    [fetchFantasyScores]
  );

  const onSortChip = useCallback((key: ScoreSortKey) => {
    setSortKey(key);
    setSorting([{ id: scoreFieldForSort(key), desc: true }]);
  }, []);

  const columns = useMemo<ColumnDef<BoardRow>[]>(() => {
    const scoreCol = (
      id: keyof BoardRow,
      header: string,
      emphasize: boolean
    ): ColumnDef<BoardRow> => ({
      id: String(id),
      accessorFn: (r) => Number(r[id]),
      header,
      cell: (info) => (
        <span className={emphasize ? styles.scoreEmph : styles.scoreCell}>
          {fmtScore(info.getValue<number>())}
        </span>
      ),
    });

    return [
      {
        id: "rank",
        header: "#",
        accessorFn: (_r, i) => i + 1,
        cell: (info) => (
          <span className={styles.boardRank}>{info.getValue<number>()}</span>
        ),
        enableSorting: false,
      },
      {
        id: "player",
        accessorKey: "full_name",
        header: "Player",
        cell: (info) => {
          const r = info.row.original;
          const color =
            colorByPlayer.get(r.player_id) ?? FALLBACK_CHART_STROKE;
          const team = teamByPlayer.get(r.player_id);
          return (
            <Link
              href={`/player?player_id=${encodeURIComponent(r.player_id)}&name=${encodeURIComponent(r.full_name)}`}
              className={styles.boardPlayer}
              style={
                {
                  ["--leader-color" as string]: color,
                } as CSSProperties
              }
            >
              <TeamMarkPip color={color} size={7} />
              <span className={styles.leaderName}>
                {formatShortName(r.full_name)}
              </span>
              {team ? <span className={styles.teamAbbr}>{team}</span> : null}
            </Link>
          );
        },
      },
      scoreCol("score_o1", "O1", sortKey === "o1"),
      scoreCol("score_off", "OFF", sortKey === "off"),
      scoreCol("score_def", "DEF", sortKey === "def"),
      scoreCol("score_eff", "EFF", sortKey === "eff"),
      ...(showCats
        ? [
            scoreCol("score_pts", "PTS", sortKey === "pts"),
            scoreCol("score_ast", "AST", sortKey === "ast"),
            scoreCol("score_fg3m", "3PM", sortKey === "fg3m"),
            scoreCol("score_reb", "REB", sortKey === "reb"),
            scoreCol("score_stl", "STL", sortKey === "stl"),
            scoreCol("score_blk", "BLK", sortKey === "blk"),
            scoreCol("score_tov", "TOV", sortKey === "tov"),
            scoreCol("score_fg_f1", "FG", sortKey === "fg_f1"),
            scoreCol("score_ft_f1", "FT", sortKey === "ft_f1"),
          ]
        : []),
      {
        id: "rarity",
        header: "Rarity",
        enableSorting: false,
        cell: (info) => {
          const chips = info.row.original.rarity_chips;
          if (!chips.length) {
            return <span className={styles.rarityEmpty}>—</span>;
          }
          return (
            <span className={styles.rarityRow}>
              {chips.map((c) => (
                <RarityBadge
                  key={`${c.metric}-${c.rarity}`}
                  label={c.metric === "TOV" ? "TOV risk" : c.metric}
                  rarity={c.rarity}
                />
              ))}
            </span>
          );
        },
      },
    ];
  }, [colorByPlayer, teamByPlayer, sortKey, showCats]);

  const table = useReactTable({
    data: sortedBoard,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      const primary = next[0];
      if (primary?.id) {
        const match = SORT_CHIPS.find((c) => scoreFieldForSort(c.key) === primary.id);
        if (match) setSortKey(match.key);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });

  const uiScope: "reg_only" | "playoff_only" =
    scope === "playoff_only" ? "playoff_only" : "reg_only";
  const pct = Number.isFinite(topPct) ? topPct : DEFAULT_TOP_PCT;

  return (
    <div className={styles.wrap} data-loading={loading ? "1" : "0"}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>FantasyHoops</h1>
          <p className={styles.subtitle}>
            Scarcity spectrum · one board · OFF×DEF · Data mart scores
          </p>
        </div>
        <div className={styles.controls}>
          <SeasonSelect
            options={SEASON_OPTIONS}
            value={season}
            onChange={(s) => applyFilters(s, uiScope, pct)}
            label="Season"
          />
          <div className={styles.seg} role="group" aria-label="Season type scope">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={uiScope === opt.value ? styles.active : undefined}
                onClick={() => applyFilters(season, opt.value, pct)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className={styles.topPctControl}>
            <span className={styles.topPctLabel}>
              {topPctLabel(
                pct,
                fantasy?.meta.player_count ?? context.player_count
              )}
            </span>
            <input
              type="range"
              className={styles.topPctSlider}
              min={TOP_PCT_MIN}
              max={TOP_PCT_MAX}
              step={TOP_PCT_STEP}
              value={pct}
              aria-label="Top percent by minutes within top 250"
              onChange={(e) =>
                applyFilters(season, uiScope, Number(e.target.value))
              }
            />
          </label>
        </div>
      </header>

      <p className={styles.meta}>
        {fantasy?.meta.player_count ?? context.player_count} players · season{" "}
        <code>{season}</code> · scope <code>{uiScope}</code> · topPct{" "}
        <code>{pct}</code>
        {fantasy?.meta.rescored ? (
          <>
            {" · "}
            <code>rescored</code>
          </>
        ) : null}
        {" · "}
        <Link href="/player" className={styles.metaLink}>
          Browse players →
        </Link>
      </p>

      {/* Layout A: Spectrum hero → board → secondary scatter (mobile C stacks) */}
      <div className={styles.layoutA}>
        <ScarcitySpectrum rows={spectrum} ready={scoresReady} />

        <O1HeatStrip strip={o1Strip} ready={scoresReady} />

        <section
          className={`${styles.scorePanel} ${styles.boardPanel}`}
          aria-label="Home leaderboard"
        >
          <div className={styles.boardHead}>
            <div>
              <h2 className={styles.panelTitle}>Leaders · top 25</h2>
              <p className={styles.panelSub}>
                TanStack sort · F. Lastname + pip · rarity chips = within-pool
                percentile (not Spectrum hero)
              </p>
            </div>
            <div className={styles.sortChips} role="group" aria-label="Sort by">
              {SORT_CHIPS.filter((c) =>
                showCats
                  ? true
                  : c.key === "o1" ||
                    c.key === "off" ||
                    c.key === "def" ||
                    c.key === "eff"
              ).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={
                    sortKey === c.key ? styles.sortChipActive : styles.sortChip
                  }
                  onClick={() => onSortChip(c.key)}
                >
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                className={styles.sortChipMore}
                onClick={() => setShowCats((v) => !v)}
                aria-pressed={showCats}
              >
                {showCats ? "Fewer" : "Cats"}
              </button>
            </div>
          </div>

          {!scoresReady ? (
            <div className={styles.awaitingBox}>
              <p className={styles.awaitingTitle}>
                {fantasyStatus === "loading"
                  ? "Loading scores…"
                  : "Awaiting score mart"}
              </p>
              <p className={styles.awaitingBody}>
                One sortable board replaces the four leader tables.
              </p>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.boardTable}>
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} colSpan={h.colSpan}>
                          {h.isPlaceholder ? null : (
                            <button
                              type="button"
                              className={styles.thBtn}
                              disabled={!h.column.getCanSort()}
                              onClick={h.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                h.column.columnDef.header,
                                h.getContext()
                              )}
                              {{
                                asc: " ↑",
                                desc: " ↓",
                              }[h.column.getIsSorted() as string] ?? null}
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row, idx) => (
                    <tr key={row.id} data-rank={idx + 1}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.boardFoot}>
            Showing top {Math.min(BOARD_LIMIT, sortedBoard.length)} by {sortKey.toUpperCase()} ·
            tap name → Player · badges never mean “≥80 elite” on aggregates
          </p>
        </section>

        <section
          className={`${styles.scorePanel} ${styles.scatterPanel}`}
          aria-label="OFF vs DEF scatter"
        >
          <h2 className={styles.panelTitle}>OFF × DEF · secondary</h2>
          <p className={styles.panelSub}>
            Scatter · point size = avg_min · dots = chartPrimary when known
          </p>
          <div className={styles.histBox}>
            {scoresReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <XAxis
                    type="number"
                    dataKey="off"
                    name="OFF"
                    domain={[0, 100]}
                    tick={{ fill: "#D4C4AE", fontSize: 10 }}
                    label={{
                      value: "OFF",
                      position: "insideBottom",
                      offset: -2,
                      fill: "#D4C4AE",
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="def"
                    name="DEF"
                    domain={[0, 100]}
                    tick={{ fill: "#D4C4AE", fontSize: 10 }}
                    label={{
                      value: "DEF",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#D4C4AE",
                      fontSize: 10,
                    }}
                  />
                  <ZAxis
                    type="number"
                    dataKey="min"
                    range={[30, 220]}
                    name="MIN"
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "rgba(22, 22, 24, 0.92)",
                      border: "1px solid rgba(247, 231, 206, 0.35)",
                      borderRadius: 8,
                      color: "#FFFCF8",
                    }}
                    formatter={(value: number, name: string) => [
                      typeof value === "number" ? value.toFixed(1) : value,
                      name,
                    ]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as
                        | { name?: string }
                        | undefined;
                      return p?.name ?? "";
                    }}
                  />
                  <Scatter name="Players" data={scatterData}>
                    {scatterData.map((d) => (
                      <Cell key={d.player_id} fill={d.color} fillOpacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.awaitingBox}>
                <p className={styles.awaitingTitle}>Awaiting OFF×DEF</p>
              </div>
            )}
          </div>
        </section>

        {/* Demoted radar — tiny fingerprint, not hero */}
        <section
          className={`${styles.scorePanel} ${styles.radarDemoted}`}
          aria-label="Pool average radar demoted"
        >
          <h2 className={styles.panelTitle}>Pool fingerprint · 9-cat</h2>
          <p className={styles.panelSub}>Demoted · GP-weighted pool avgs</p>
          <div className={styles.radarBoxTiny}>
            {scoresReady || context.player_count > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="62%">
                  <PolarGrid stroke="rgba(247, 231, 206, 0.18)" />
                  <PolarAngleAxis
                    dataKey="stat"
                    tick={{ fill: "#D4C4AE", fontSize: 9 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Pool"
                    dataKey="league"
                    stroke="rgba(247, 231, 206, 0.85)"
                    fill="rgba(247, 231, 206, 0.22)"
                    fillOpacity={0.5}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(22, 22, 24, 0.92)",
                      border: "1px solid rgba(247, 231, 206, 0.35)",
                      borderRadius: 8,
                      color: "#FFFCF8",
                    }}
                    formatter={(value: number | string, _n, item) => {
                      const key = (item?.payload as { key?: RadarStatKey })?.key;
                      const raw = (item?.payload as { raw?: number | null })
                        ?.raw;
                      if (key) return [fmtStat(key, raw ?? null), STAT_LABEL[key]];
                      return [value, "Pool"];
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.awaitingBox}>
                <p className={styles.awaitingTitle}>Awaiting pool radar</p>
              </div>
            )}
          </div>
          <p className={styles.normNote}>{RADAR_NORM_NOTE}</p>
        </section>
      </div>

      <footer className={styles.insightFooter} aria-label="Insight posts">
        <span className={styles.insightLabel}>Why these numbers</span>
        <nav className={styles.insightLinks}>
          {INSIGHT_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.insightLink}>
              {l.label}
            </Link>
          ))}
          <Link href="/insight" className={styles.insightLink}>
            All insights →
          </Link>
        </nav>
      </footer>

      {!scoresReady && (
        <p className={styles.scoreBanner} role="status">
          Fantasy scores{" "}
          {fantasyStatus === "loading"
            ? "loading…"
            : fantasyStatus === "error"
              ? "probe error"
              : "awaiting mart"}{" "}
          · <code>player_fantasy_scores.parquet</code> ·{" "}
          <code>fantasy-score-v1</code>
        </p>
      )}
    </div>
  );
}
