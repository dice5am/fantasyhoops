"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
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
import type {
  FantasyScoresPayload,
  PlayerFantasyScore,
  ScoreBoardKey,
} from "@/types/fantasy_score";
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

const BOARD_META: {
  key: ScoreBoardKey;
  title: string;
  score: (r: PlayerFantasyScore) => number;
  rank: (r: PlayerFantasyScore) => number;
}[] = [
  { key: "o1", title: "Overall · O1", score: (r) => r.score_o1, rank: (r) => r.rank_o1 },
  { key: "off", title: "OFF", score: (r) => r.score_off, rank: (r) => r.rank_off },
  { key: "def", title: "DEF", score: (r) => r.score_def, rank: (r) => r.rank_def },
  { key: "eff", title: "EFF", score: (r) => r.score_eff, rank: (r) => r.rank_eff },
];

const BOARD_TOP_N = 8;

function CondensedScoreBoard({
  title,
  rows,
  scoreOf,
  rankOf,
  colorByPlayer,
}: {
  title: string;
  rows: PlayerFantasyScore[];
  scoreOf: (r: PlayerFantasyScore) => number;
  rankOf: (r: PlayerFantasyScore) => number;
  colorByPlayer?: Map<string, string>;
}) {
  const top = useMemo(() => {
    return [...rows]
      .sort((a, b) => rankOf(a) - rankOf(b))
      .slice(0, BOARD_TOP_N);
  }, [rows, rankOf]);

  return (
    <section className={styles.scorePanelCompact} aria-label={title}>
      <h2 className={styles.triTitle}>{title}</h2>
      {top.length === 0 ? (
        <p className={styles.emptyLeaders}>No scores yet</p>
      ) : (
        <ol className={styles.leaderList}>
          {top.map((r) => {
            const color =
              colorByPlayer?.get(r.player_id) ?? FALLBACK_CHART_STROKE;
            return (
              <li key={`${title}-${r.player_id}`}>
                <Link
                  href={`/player?player_id=${encodeURIComponent(r.player_id)}&name=${encodeURIComponent(r.full_name)}`}
                  className={styles.leaderLink}
                  style={
                    {
                      ["--leader-color" as string]: color,
                    } as CSSProperties
                  }
                >
                  <span className={styles.leaderRank}>{rankOf(r)}</span>
                  <TeamMarkPip color={color} size={7} />
                  <span className={styles.leaderName}>
                    {formatShortName(r.full_name)}
                  </span>
                  <span className={styles.leaderVal}>{fmtScore(scoreOf(r))}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
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
  const fetchGen = useRef(0);

  /** Best-effort chartPrimary from league leaders (TEAM_MARK_UX pips). */
  const colorByPlayer = useMemo(() => {
    const m = new Map<string, string>();
    const add = (entries: { player_id: string; chart_color?: string }[] | undefined) => {
      if (!entries) return;
      for (const e of entries) {
        if (e.chart_color && !m.has(e.player_id)) m.set(e.player_id, e.chart_color);
      }
    };
    for (const key of Object.keys(context.leaders ?? {})) {
      add(context.leaders[key as keyof typeof context.leaders]);
    }
    add(context.stocks_leaders);
    return m;
  }, [context.leaders, context.stocks_leaders]);

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
    if (!fantasy?.rows.length) return [];
    return fantasy.rows.map((r) => ({
      player_id: r.player_id,
      name: formatShortName(r.full_name),
      full_name: r.full_name,
      off: r.score_off,
      def: r.score_def,
      min: r.avg_min,
    }));
  }, [fantasy]);

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

  const uiScope: "reg_only" | "playoff_only" =
    scope === "playoff_only" ? "playoff_only" : "reg_only";
  const pct = Number.isFinite(topPct) ? topPct : DEFAULT_TOP_PCT;
  const scoresReady = fantasyStatus === "ready" && fantasy && fantasy.rows.length > 0;
  const rows = fantasy?.rows ?? [];

  return (
    <div className={styles.wrap} data-loading={loading ? "1" : "0"}>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>FantasyHoops</h1>
          <p className={styles.subtitle}>
            Score-ranked boards · OFF/DEF/EFF/O1 · Data mart
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

      {/* Condensed O1 / OFF / DEF / EFF boards */}
      <div className={styles.scoreBoards} aria-label="Fantasy score boards">
        {scoresReady
          ? BOARD_META.map((b) => (
              <CondensedScoreBoard
                key={b.key}
                title={b.title}
                rows={rows}
                scoreOf={b.score}
                rankOf={b.rank}
                colorByPlayer={colorByPlayer}
              />
            ))
          : BOARD_META.map((b) => (
              <section
                key={b.key}
                className={styles.scorePanelCompact}
                aria-label={b.title}
                data-awaiting="1"
              >
                <h2 className={styles.triTitle}>{b.title}</h2>
                <div className={styles.awaitingBox}>
                  <p className={styles.awaitingTitle}>
                    {fantasyStatus === "loading"
                      ? "Loading scores…"
                      : "Awaiting score mart"}
                  </p>
                  <p className={styles.awaitingBody}>
                    Condensed {b.title} board — Data scores only.
                  </p>
                </div>
              </section>
            ))}
      </div>

      {/* Distributions */}
      <div className={styles.scoreViz} aria-label="Fantasy score distributions">
        <section className={styles.scorePanel} aria-label="Overall histogram">
          <h2 className={styles.panelTitle}>Overall · O1 distribution</h2>
          <p className={styles.panelSub}>
            Active pool O1 scores · {fantasy?.meta.rescored ? "rescored for topPct" : "published mart"}
          </p>
          <div className={styles.histBox}>
            {scoresReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fantasy!.o1_hist}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#D4C4AE", fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={42}
                  />
                  <YAxis
                    tick={{ fill: "#D4C4AE", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(22, 22, 24, 0.92)",
                      border: "1px solid rgba(247, 231, 206, 0.35)",
                      borderRadius: 8,
                      color: "#FFFCF8",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Players"
                    fill="rgba(247, 231, 206, 0.75)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.awaitingBox}>
                <p className={styles.awaitingTitle}>Awaiting O1 hist</p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.scorePanel} aria-label="OFF vs DEF scatter">
          <h2 className={styles.panelTitle}>OFF vs DEF</h2>
          <p className={styles.panelSub}>
            Scatter · point size = avg_min · Data pillar scores
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
                  <ZAxis type="number" dataKey="min" range={[30, 220]} name="MIN" />
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
                  <Scatter name="Players" data={scatterData} fill="rgba(247, 231, 206, 0.7)">
                    {scatterData.map((d) => (
                      <Cell
                        key={d.player_id}
                        fill="rgba(247, 231, 206, 0.65)"
                      />
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

        <section className={styles.scorePanel} aria-label="EFF histogram">
          <h2 className={styles.panelTitle}>EFF distribution</h2>
          <p className={styles.panelSub}>EFF = mean(FG F1, FT F1, TOV T1)</p>
          <div className={styles.histBox}>
            {scoresReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fantasy!.eff_hist}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#D4C4AE", fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={42}
                  />
                  <YAxis
                    tick={{ fill: "#D4C4AE", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(22, 22, 24, 0.92)",
                      border: "1px solid rgba(247, 231, 206, 0.35)",
                      borderRadius: 8,
                      color: "#FFFCF8",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Players"
                    fill="rgba(247, 231, 206, 0.8)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.awaitingBox}>
                <p className={styles.awaitingTitle}>Awaiting EFF hist</p>
              </div>
            )}
          </div>
        </section>

        <section className={`${styles.scorePanel} ${styles.scorePanelHero}`} aria-label="Pool average radar">
          <h2 className={styles.panelTitle}>Pool average · 9-cat</h2>
          <p className={styles.panelSub}>
            GP-weighted pool avgs for active topPct slice · same radar ranges as Player
          </p>
          <div className={styles.radarBox} style={{ height: 240, minHeight: 220 }}>
            {scoresReady || context.player_count > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                  <PolarGrid stroke="rgba(247, 231, 206, 0.18)" />
                  <PolarAngleAxis
                    dataKey="stat"
                    tick={{ fill: "#D4C4AE", fontSize: 11 }}
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
                    stroke="rgba(247, 231, 206, 0.95)"
                    fill="rgba(247, 231, 206, 0.28)"
                    fillOpacity={0.55}
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
                      const raw = (item?.payload as { raw?: number | null })?.raw;
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
